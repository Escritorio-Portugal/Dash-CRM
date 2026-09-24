# Registro de remediação — branch `audit/remediation-2026-09-24`

Base: `399514d` (= produção). Nada foi publicado, nada foi escrito no banco.
Verificação: `bash tests/audit/check.sh` (sintaxe + 34 testes) · harness com funções reais sobre dump do banco · E2E no Chrome com Supabase simulado (dados reais, gravações interceptadas).

| Commit | Findings | Teste falhando antes → passa depois | Efeito medido (dados reais) | Codex |
|---|---|---|---|---|
| 79edb0a | DATA-001 | 3 testes (`data-001-db-get`) | produção grava 3× em `app_state` só ao abrir o app (com chaves ausentes); corrigido: 0 | revisado: 2 lacunas + 1 regressão → corrigidas em d578528 |
| d578528 | FIN-001/002/003/010 + lacunas DATA-001 | 10 testes (`fin-001`) | agosto card 10.401,75 → **7.851,75 = lista**; lucro 1.132,67 → 3.682,67 | revisado: 2 HIGH + filtros não mensais → corrigidos em 88ec85f |
| 4217bce | FIN-004, CODE-005 | 6 testes (`fin-004`) | nenhum número muda; 47 parcelas sem valor passam a aparecer como "valor estimado" (aviso agosto: 5 parcelas, €1.274,65) | revisão final pendente |
| 0f7e66f | CODE-001/002/003, CODE-007 (parcial) | 5 testes (`code-003`) | nenhum número muda | revisão final pendente |
| 1c21204 | FIN-006/007/008 | 5 testes (`fin-006`) | conversão mai/jun/jul/set: 87%/47%/58%/22% → "sem dados de funil"; ago 26,1% mantém; fechamentos mai 88 → 58 | revisão final pendente |
| 88ec85f | revisão Codex de d578528 | 5 testes novos | meses idênticos; semana/dia/total agora também card = lista | revisão final pendente |

## Browser (E2E offline, Chrome, dados reais)
| Verificação | Produção (399514d) | Branch |
|---|---|---|
| Ago: card fixos / soma lista | 10.401,75 / 7.851,75 | 7.851,75 / 7.851,75 |
| Set: card fixos / soma lista | 7.002,00 / 3.252,00 | 7.002,00 / 7.002,00 |
| Maio: conversão | 87,1% (88/101) | "sem funil diário preenchido" |
| Gravações ao abrir | 3 | 0 |
| Erros de console | 0 | 0 |

## Não feito (exige decisão ou autorização)
- **FIN-005** (parcial na data do recebimento): regra definida, mas precisa de tabela nova de recebimentos de venda (DDL). Impacto atual em dados: 0 vendas afetadas.
- **FIN-009** (pendências "na data" e regra de atraso): precisa definir vencimento das parcelas (ex.: mensal a partir da venda?).
- **CODE-004** (custos em JSON, última gravação vence): migrar custos para tabela (DDL).
- **CODE-007** (colaborador não consegue criar recorrência): hoje o app desfaz e avisa; resolver de vez exige política RLS de INSERT/UPDATE em `parcelas` para as recorrências do próprio colaborador.
- **Dados (etapa 2)**: PABLO/FERNANDA/CONTABILISTA (ver DATABASE_REPORT), 3 PABLO pendentes de setembro, 2 LARISSA pendentes de julho, 47 parcelas sem valor, NILZA, CHARLES.
