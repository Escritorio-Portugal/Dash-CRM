# Findings consolidados — Claude × Codex (código @399514d)

Estados: CONFIRMED = achado independentemente pelos dois **e** determinístico no código ·
PARTIALLY VERIFIED = só um dos dois, mas determinístico no código · NEEDS_RUNTIME_EVIDENCE = depende do banco.
Nenhum item tem ainda prova de banco/browser (acesso ao Supabase bloqueado). Impacto em € = pendente.

| # | Tema | Claude | Codex | Sev final | Estado |
|---|---|---|---|---|---|
| 1 | Erro de leitura → SEED exibido/gravado; **meta sem flags re-executa 12 migrações JS** | DATA-001 | CRM-07 (só a parte SEED) | **CRITICAL** | CONFIRMED (SEED) / PARTIALLY (re-execução: só Claude; cadeia 583→777→1921 determinística) |
| 2 | Custo fixo contado 2x (lista ≠ card/Resumo/Registro/Extrato/lucro) | FIN-001 | CRM-03 | HIGH | CONFIRMED |
| 3 | Editar custo "repete" muta o registo-base (vencimento/valor) — mecanismo que gera o caso PABLO/CONTABILISTA | FIN-002 | — | HIGH | PARTIALLY VERIFIED |
| 4 | Excluir custo "repete" apaga histórico, contrariando a UI | FIN-003 | CRM-04 | HIGH | CONFIRMED |
| 5 | Parcela paga sem valor → valor inferido e retroativo (edição/estorno de entrada mudam meses fechados); pagamento em lote não grava valor | FIN-004 | CRM-01 | HIGH | CONFIRMED |
| 6 | Meses fechados usam estado atual (pendente, quitadas, atrasadas; regra "30 dias desde a venda") | FIN-009 | CRM-02 | HIGH | CONFIRMED |
| 7 | Erros de gravação: STATE muta antes, sem try/catch; DB.set engole erro; delete ignora erro | CODE-003 | CRM-05, CRM-12 | HIGH | CONFIRMED |
| 8 | persistRecorrencia não transacional | CODE-003 | CRM-06 | HIGH | CONFIRMED |
| 9 | JSON app_state (custos/meta/serviços/vendedores): último a gravar vence | CODE-004 | CRM-05 | HIGH | CONFIRMED |
| 10 | Duplo clique duplica venda/recorrência/pagamento | CODE-001 | CRM-11 | HIGH (Codex: MED) | CONFIRMED |
| 11 | Migration 22/09: altera dados; aplicação desconhecida; CHECK pode ter falhado em linhas históricas | DB-001 | CRM-08 | HIGH | NEEDS_RUNTIME_EVIDENCE |
| 12 | Conversão conta espelho + recorrência | FIN-006 | CRM-09 | MEDIUM | CONFIRMED |
| 13 | Subcards de "Valor vendido" não fecham com o card | FIN-008 | CRM-10 | MEDIUM | CONFIRMED |
| 14 | "Conversas" cai no valor manual estático fora do período | FIN-007 | — | MEDIUM | PARTIALLY VERIFIED |
| 15 | Venda integral: todo o recebido na data da venda | FIN-005 | — | MEDIUM | PARTIALLY VERIFIED |
| 16 | Aviso "acima do pendente" não bloqueia | CODE-002 | — | MEDIUM | PARTIALLY VERIFIED |
| 17 | Reduzir nº de parcelas apaga parcelas pagas | CODE-005 | (CRM-06 cenário) | MEDIUM | PARTIALLY VERIFIED |
| 18 | Remoções das migrações JS nunca chegaram ao banco (upsert-only) | CODE-006 | — | MEDIUM | NEEDS_RUNTIME_EVIDENCE |
| 19 | RLS das tabelas relacionais fora do repo; políticas anon no schema.sql | SEC-001 | (nota SQL) | MEDIUM | NEEDS_RUNTIME_EVIDENCE |
| 20 | migration_v2 não idempotente semanticamente | — | CRM-13 | LOW (não deve ser reexecutada) | PARTIALLY VERIFIED |
| 21 | Custo = competência (vencimento), não caixa; UI diz "efetivamente pago" | FIN-010 | — | LOW | PARTIALLY VERIFIED |

## Rejeitadas (com motivo)
- Timezone nos limites de mês; espelho duplicando caixa; card de faturamento/impostos ≠ detalhe; Registro ≠ Extrato nas receitas; formulários violando CHECKs; extras = duplicata de parcela; reescala reaplicável; leadEdits sem leitura (todas: Codex, conferidas pelo Claude).
- ELIS venda + recorrência ~€350 como duplicidade (handoff 22/09: serviços diferentes).

## Divergência Claude × Codex
- Severidade do #1: Codex não classificou CRITICAL por não avaliar a re-execução das migrações; Claude mantém CRITICAL porque a cadeia é determinística e o efeito é escrita em produção (repor parcelas de maio/junho ao snapshot de julho, sobrescrever crm:costs). A evidência de runtime para desempatar é INV-CST-4 + teste com leitura falhada em ambiente local.
