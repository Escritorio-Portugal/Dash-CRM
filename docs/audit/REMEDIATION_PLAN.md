# Plano de remediação — aguarda PHASE=REMEDIATION

Regras de negócio confirmadas pelo usuário (2026-09-24):
- **Custo fixo:** lançado no mês N, repete nos meses seguintes como custo padrão. Pago só quando marcado, guardando a **data real do pagamento** (mesmo após o vencimento). Excluir no mês M interrompe a repetição de M em diante; meses < M ficam intactos; volta só se relançado manualmente.
- **Pagamento parcial de venda:** conta na **data de cada recebimento**.

Cada passo: teste que falha antes → correção mínima → teste passa → harness nos 5 meses → revisão Codex → validação no browser. Sem deploy nem escrita no banco sem ordem explícita.

## Etapa 1 — Código (index.html), um patch por item
| # | Findings | Correção |
|---|---|---|
| 1 | DATA-001 | `DB.get` sem fallback SEED para dados de negócio: erro de leitura aborta o boot com mensagem; remover seed automático; migrações JS só correm se `crm:meta` foi lido com sucesso (ou removidas do boot). |
| 2 | FIN-001/002/003/010 | Modelo único de custo fixo: `custosFixosDoMes(mês)` é a fonte da lista **e** dos totais. Por custo: `inicio` (mês de lançamento), `fimEm` (mês de exclusão, opcional), `pagamentos[mês] = {data, valor}`. Marcar pago grava a data escolhida (default hoje). Editar/Excluir em mês projetado não muta o passado: editar cria novo valor a partir daquele mês; excluir define `fimEm`. Leitura compatível com o formato antigo (`pago`/`dataPagamento`/`pagoPorMes`). |
| 3 | FIN-004 | Todo pagamento de parcela grava `valor` (incl. o modal em lote). Parcela paga sem valor fica sinalizada "valor não informado" e **fora** do faturamento até ser conferida (em vez de valor inferido). |
| 4 | FIN-005 | Venda com pagamento parcial: recebimentos datados (reusar estrutura tipo `pagamentos_extras` para vendas, ou nova tabela `recebimentos_venda`); faturamento por data de recebimento. Requer DDL → etapa 3. |
| 5 | CODE-001/002/003/005 | Botões desativados durante gravação; aviso de sobrepagamento exige 2ª confirmação; `try/catch` com rollback do STATE e mensagem de erro; delete confere `error`; bloquear redução de parcelas já pagas. |
| 6 | CODE-007 | Colaborador: ou esconder criação de recorrência/pagamento, ou (preferível, com decisão) política RLS de INSERT/UPDATE em parcelas das próprias recorrências. |
| 7 | FIN-006/007/008/009 | Conversão exclui espelhos e mostra "sem dados de funil" quando não há funil no período (sem fallback estático); subcards somam o card; pendências "as of" fim do período; "atrasada" baseada em parcela vencida, não em 30 dias da venda. |
| 8 | CODE-004, CODE-003 (atomicidade) | Custos para tabela relacional e RPC transacional para recorrência+parcelas+extras (DDL → etapa 3). |

## Etapa 2 — Dados (só com comprovantes e aprovação por item)
Não apagar nada por inferência. Para cada item, backup do JSON/linhas antes.
- PABLO ago (`cst-025` pagoPorMes vs `cst-1789732197528`), CONTABILISTA ago (`cst-010` vs `cst-1789732731715`): confirmar 1 ou 2 pagamentos.
- Setembro: `cst-025`/`cst-024` marcados pagos com vencimento de setembro — confirmar se PABLO/FERNANDA de setembro foram pagos; os 3 PABLO pendentes de setembro e 2 LARISSA pendentes de julho parecem duplicados de digitação.
- 47 parcelas pagas sem valor (25 com data, 22 sem data): informar valor/data reais.
- NILZA MARA mai × jun; CHARLES ABIOLA venda × entrada.

## Etapa 3 — Esquema (DDL; exige aprovação explícita e backup)
Tabela de custos + pagamentos de custos; recebimentos de venda; RPC transacional de recorrência; políticas RLS versionadas no repo (hoje só existem no banco).
