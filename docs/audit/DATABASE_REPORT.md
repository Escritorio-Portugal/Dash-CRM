# Relatório de banco — 2026-09-24 (read-only)

Projeto `wtanyagjmgjedszivsfu` ("Base da dados Escritorio"), via conector Supabase. Só SELECT.

## Estado
- 166 vendas · 84 recorrências · 115 parcelas · 5 pagamentos extras · 4 profiles · 97 custos (20 variáveis, 77 fixos).
- Linhas relacionais criadas em bloco em 2026-09-16 17:51 a partir dos blobs JSON.
- Blobs legados `crm:sales*`, `crm:recurrences*` continuam em `app_state` (sem uso pelo app atual).
- **Não existe `supabase_migrations`**: SQL aplicado manualmente.
- Migração 20260922184119 **aplicada**: 4 CHECKs válidos, `search_path` fixado, 0 GRANTs para anon, RLS ligado em todas as tabelas.
- `crm:meta` contém todas as flags das migrações JS → DATA-001 latente, não disparado.

## Reprodução dos cards
`harness.js` (scratchpad) executa as funções reais de `index.html` sobre um dump do banco.
Validação: reproduz os valores de 22/09 para agosto (fixos card €10.401,75, lista €7.851,75, pendências €3.362,61).

| Mês | Vendido | Faturamento | Pendências | Conversão (tela) | Fixos card | Fixos lista | Dif. | Variáveis | Impostos | Lucro |
|---|---|---|---|---|---|---|---|---|---|---|
| 2026-05 | 28.373,58 | 15.946,69 | 2.269,00 | 87,1% | 5.890,76 | 5.890,76 | 0 | 633,65 | 3.190,59 | 6.231,69 |
| 2026-06 | 21.475,41 | 13.114,28 | 1.187,61 | 46,5% | 5.940,26 | 5.940,26 | 0 | 570,13 | 2.609,32 | 3.994,57 |
| 2026-07 | 15.886,55 | 14.150,28 | 1.331,62 | 58,4% | 6.267,19 | 6.267,19 | 0 | 862,55 | 3.204,63 | 3.815,91 |
| 2026-08 | 14.345,08 | 15.887,17 | 3.362,61 | 26,1% | **10.401,75** | 7.851,75 | **2.550** | 826,52 | 3.526,22 | 1.132,67 |
| 2026-09 | 6.457,24 | 6.831,23 | 2.713,61 | 21,8% | **7.002,00** | 3.252,00 | **3.750** | 85,00 | 1.305,77 | −1.561,54 |

Agosto mudou desde 22/09 (+€750 vendido, +€350 faturamento) por causa de `rec-1790244030939` (CHARLES ABIOLA), criada em 24/09 com data 18/08.

## Evidências por finding

| Finding | Resultado no banco |
|---|---|
| FIN-001/002 custos fixos | Agosto: PABLO (`cst-025` pagoPorMes + `cst-1789732197528`) e CONTABILISTA (`cst-010` + `cst-1789732731715`) = +€2.550. Setembro: `cst-025` e `cst-024` pagos com vencimento em setembro contam no card enquanto a lista mostra os registos pendentes de 18/09 = +€3.750. Em 18/09, lançamentos manuais retroativos jan–ago de PABLO/FERNANDA/ESTACIONAMENTO; 4 registos PABLO em setembro (3 pendentes criados com minutos de diferença); LARISSA jul com 3 registos €240 (2 pendentes duplicados); LARISSA com valor 0 e sem vencimento; ESTACIONAMENTO e CONTABILISTA com pagoPorMes booleano. |
| FIN-004 parcelas inferidas | Parcelas pagas: 22 com valor, **25 com data e valor NULL** (inferido: mar 262,50 · abr 466,54 · mai 1.670,64 · jun 1.275,78 · **jul 3.862,28 = 100% das parcelas de julho** · ago 1.274,65), **22 pagas sem data** (€7.661,50 inferidos, em nenhum mês mas abatem pendências). |
| FIN-006/007 conversão | Funil diário só existe para **agosto** (119 conversas). Mai/jun/jul/set usam 101 fixo (conversasIniciadas) → conversões desses meses **sem base**. Maio: 88 fechamentos, 30 são espelhos. |
| CODE-001 duplicados | Nenhuma duplicata exata em vendas, recorrências ou extras. |
| CODE-006 resíduos JS | **Rejeitado** para julho: só vendas `jul26-*` (46). |
| INT (órfãos, nº parcelas, composição, sobrepagamento) | Todos OK: 0 órfãos, 0 divergências de nº de parcelas, composição fecha, nenhum contrato com recebido gravado > contrato. |
| SEC-001 | RLS ligado em todas as tabelas; políticas só para `authenticated`. **Colaborador só tem SELECT em `parcelas`/`pagamentos_extras`** → ver CODE-007. |

## Novos findings
- **CODE-007 (HIGH)** — Colaborador cria recorrência (`openAddRecModal`/`openQuickAddModal` com `forColaborador`) → `persistRecorrencia` grava `recorrencias` (permitido) e falha em `parcelas` (só SELECT) → recorrência sem parcelas + erro (toast global; o STATE local já foi alterado). Contraprova Codex: colaborador não tem fluxo de pagamento de parcela, então só a criação é afetada. Hoje não há recorrências sem parcelas (INV-INT-3 = 0), portanto nenhum colaborador conseguiu fazê-lo até agora (ou nunca tentou).
- **DATA-002 (a confirmar)** — NILZA MARA (15/06: €350 + €200, VND-06-025/027) × NILZA MARA VIEIRA (15/05: €200 + €350, VND-05-044/045): mesmos serviços e valores, nome e mês diferentes. Possível venda registada nas duas planilhas mensais (padrão já visto no caso RAVENA). A de 15/06 de €200 é "integral" com €0 pago (€200 em pendências).
- **DATA-003 (a confirmar)** — CHARLES ABIOLA: venda €350 (consulta) e entrada €350 de recorrência (ação de intimação) no mesmo dia 18/08; a recorrência foi lançada hoje. Verificar se a entrada é o mesmo dinheiro da consulta.

## Não verificável por banco (exige comprovante)
Pagamentos reais de PABLO/CONTABILISTA/FERNANDA; valores das 47 parcelas sem valor; NILZA; CHARLES.
