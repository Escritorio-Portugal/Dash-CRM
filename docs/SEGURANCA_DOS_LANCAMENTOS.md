# Segurança dos lançamentos

Método de proteção e revisão dos lançamentos do Dash CRM (desde 29/09/2026).
Objetivo: nenhum lançamento some sem deixar rasto, nenhum lançamento novo entra
com erro, e qualquer erro que já exista aparece para o gestor corrigir.

## As 5 camadas

| # | Camada | Onde | O que faz |
|---|---|---|---|
| 1 | **Aviso no formulário** | painel | Antes de gravar, avisa: data com ano errado, data no futuro, pagamento antes da venda. |
| 2 | **Validação no banco** | gatilhos `validar_*` | Recusa lançamentos **novos ou alterados** com erro, mesmo que venham de outro lugar (outro navegador, versão antiga do painel, script). Lançamentos antigos que não forem mexidos continuam editáveis. |
| 3 | **Histórico** | `auditoria.historico` | Toda inclusão, alteração e exclusão em vendas, recorrências, parcelas, pagamentos personalizados e configurações (custos, serviços, vendedores, meta) fica guardada: quem, quando, antes e depois. |
| 4 | **Proteção contra queda** | gatilhos `proteger_*` | O painel não consegue excluir mais de 3 vendas/recorrências numa operação, nem apagar mais de 3 custos/serviços/vendedores de uma vez, nem esvaziar essas listas, nem apagar a configuração. |
| 5 | **Verificador** | `verificar_integridade()` + aba *Segurança dos dados* | Procura erros que já estão na base (lista abaixo). Corre sozinho ao entrar como gestor; se houver erro crítico num lançamento alterado nos últimos 7 dias, aparece um aviso na Visão Geral. |

Os **testes automáticos** (`tests/audit/`) podem correr no GitHub em cada mudança de
código: copie `docs/ci/testes.yml` para `.github/workflows/testes.yml` (exige permissão `workflow` no GitHub). Uma mudança que estrague um cálculo fica a vermelho.

## O que o banco recusa

- Data da venda antes de **01/01/2026** (início dos lançamentos do escritório) ou no futuro.
- Parcela marcada como paga **sem data**, com data **antes da venda** ou no futuro.
- Pagamento personalizado antes da venda ou no futuro.
- Venda com valor total ≤ 0 ou recebido maior que o total; contrato ≤ 0.
- Mudar a data da venda para depois de uma parcela já paga.
- Nomes de cliente com espaços sobrando são corrigidos automaticamente.

## O que o verificador procura

| Código | Gravidade | Erro |
|---|---|---|
| LANC-01 | crítica | Venda ligada a uma recorrência que não existe (fica invisível em todos os totais) |
| LANC-02 | crítica | Data fora do período ou no futuro (erro no ano) |
| LANC-03 | crítica | Nº de parcelas diferente das parcelas gravadas |
| PAG-01 | crítica | Pagamento antes da data da venda (entra no mês errado) |
| PAG-02 | crítica | Parcela paga sem data (não entra no caixa de nenhum mês) |
| PAG-03 | crítica | Recebido acima do contrato |
| PAG-04 | média | Parcela paga com uma anterior em aberto (parcela errada marcada?) |
| PAG-05 | média | Venda "paga integralmente" com recebido menor que o total |
| DUP-01/02 | média | Possíveis duplicados |
| CAD-01 | média | Vendedor inexistente |
| CAD-02 | baixa | Serviço fora do catálogo |
| CUS-01 | baixa | Custo com valor zero / fixo sem vencimento |
| HIST-01 | informação | Exclusões dos últimos 30 dias |

## Rotina do gestor

- **Toda semana**: Configurações → *Segurança dos dados* → *Verificar agora*. Corrigir os críticos.
- **Excluiu algo por engano**: mesma aba → *Lançamentos excluídos* → *Restaurar* (volta com parcelas e pagamentos).
- **Fecho do mês**: verificar que não há críticos no mês antes de pagar comissões.
- **O banco recusou uma gravação**: a mensagem diz o motivo (ex.: "é anterior a 01/01/2026: confira o ano"). Nada foi gravado pela metade.

## Técnico

- Migrações: `supabase/migrations/20260929_seguranca_dos_lancamentos.sql` e `20260929b_seguranca_validar_so_o_que_mudou.sql` (desfazer no fim do primeiro ficheiro).
- `auditoria` não é exposto pela API; só as funções `verificar_integridade`, `listar_exclusoes` e `restaurar_exclusao` (todas só para gestor).
- Mudar o início do período: `create or replace function public.dash_inicio_lancamentos() ... date 'AAAA-MM-DD'` e a constante `INICIO_LANCAMENTOS` no `index.html`.
- Testado no banco real dentro de transações desfeitas (ROLLBACK): 21 + 7 cenários.
