# Findings — Codex (investigação independente, read-only)

Execução: 2026-09-24, codex-cli 0.156.1 via plugin codex-rescue, commit 399514d, `--write=false`.
Prompt: evidência e escopo, **sem** o diagnóstico do Claude (pedido para achar e tentar refutar).
Resultado: 13 findings (8 HIGH, 5 MEDIUM), 0 CRITICAL "demonstrável só por análise estática".

| ID | Sev | Título | Linhas citadas |
|---|---|---|---|
| CRM-01 | HIGH | Parcela paga sem valor gera receita fictícia (inferida); migration põe NULL e aciona isso | 1411, 1308, 4187; mig:4 |
| CRM-02 | HIGH | Meses fechados recalculados com estado atual (pendente/quitada retroativos) | 1497, 1528, 4371, 4379 |
| CRM-03 | HIGH | Custo fixo contado 2x (pago/dataPagamento + pagoPorMes do mesmo mês) | 4198, 4208, 1652 |
| CRM-04 | HIGH | Excluir repetição apaga todo o histórico, contra o aviso da UI | 1594, 5500, 5529 |
| CRM-05 | HIGH | crm:costs JSON: lost update; DB.set engole erro e fluxo segue como sucesso | 483, 595, 1124, 5006 |
| CRM-06 | HIGH | persistRecorrencia não atômica (pai/parcelas/extras) | 1091–1105 |
| CRM-07 | HIGH | Erro de leitura → exibe (e pode gravar) dados SEED de demonstração | 583–590, 774 |
| CRM-08 | HIGH | Migration 22/09: ADD CONSTRAINT pode falhar em linhas históricas não saneadas | mig:4, mig:104 |
| CRM-09 | MED | Espelho + recorrência = 2 fechamentos na Visão Geral (perfil conta 1) | 1545–1547, 1502 |
| CRM-10 | MED | Subcard "Vendas integrais" pode incluir espelho; subcards ≠ card | 1674–1677 |
| CRM-11 | MED | Duplo clique cria duplicados (ids Date.now()) | 2236, 4559, 4911 |
| CRM-12 | MED | Delete ignora erro e confirma sucesso | 5140, 5165 |
| CRM-13 | MED | migration_v2 reexecutada sobrescreve blobs novos com legado | v2:148–193 |

## Hipóteses rejeitadas pelo Codex
- Limite de mês/timezone errado: intervalo [start,end) em meia-noite local (1247).
- Caixa duplica toda venda-espelho: buildEvents ignora espelhos (1290).
- Card de faturamento ≠ detalhe: mesma fonte buildEvents.
- Card de impostos ≠ detalhe: mesma fonte.
- Registro ≠ Extrato nas receitas: mesma fonte linhasFinanceiras.
- Formulários normais violam CHECKs de venda/recorrência: validam antes.
- migration_v4 perde leitura de leadEdits: policy inclui a chave.
- Pagamento extra = duplicata de parcela: sem evidência no código.
- Reescala da migration reaplica desconto: predicado >0.02 impede.

Nota do Codex: não comprova pagamentos reais, conteúdo atual do banco nem migrations já executadas.

---

# Rodada 2 — contraprova dos achados de banco (2026-09-24)

| Item | Veredito Codex | Nota |
|---|---|---|
| A custos fixos | PARTIAL | Setembro (€3.750, `cst-025`/`cst-024` pagos no vencimento vs lista com registos pendentes) confirmado. Agosto (€2.550) tem causa distinta: registo exato + `pagoPorMes` (PABLO/CONTABILISTA) — coincide com o que o Claude já tinha em FIN-001; são dois mecanismos, não um. |
| B parcelas inferidas | CONFIRMED | `valorEfetivoParcela` imputa (contrato−entrada)/n; sem data → só em `recStatus.valorPago`. |
| C conversão | CONFIRMED | fallback `conversasIniciadas` + espelhos em `fechamentos` (1547/1548). |
| D colaborador × RLS | PARTIAL | Não atômico: confirmado. Política SELECT-only não verificável pelo repo (Codex sem acesso ao banco; o Claude confirmou por `pg_policies`). Erro **não** é engolido: vira toast global (435). Colaborador **não** tem fluxo de pagamento de parcela (2640/2656). |
| E CHARLES | CONFIRMED | Código não distingue; exige confirmação humana. |

---

# Rodada final — revisão de 399514d..88ec85f (2026-09-24)
0 CRITICAL · 4 HIGH · 1 MEDIUM. Tratamento (commit seguinte):
| # | Achado | Tratamento |
|---|---|---|
| 1 HIGH | persistRecorrencia não atômica no banco | Parcial: limpeza de recorrência nova agora verifica erro e avisa. Atomicidade real exige RPC transacional (DDL) → pendente de autorização. |
| 2 HIGH | pagamento sugerido podia passar do saldo após congelar/isentar | `valorSugeridoProxima` = saldo real ÷ parcelas em aberto, usado em todos os fluxos de pagamento; valor padrão histórico inalterado. Teste com o exemplo do Codex (€123/€23). |
| 3 HIGH | desfazer parcela, salvar data e isenção sem reversão/trava | `salvarAlteracao` + trava nos três caminhos. |
| 4 HIGH | renomear lançamento no mês de origem ressuscitava modelo anterior | `interromperAnteriorMesmoNome` aplicado também na edição. Mantido de propósito: editar o valor do lançamento do próprio mês corrige aquele mês. |
| 5 MED | vendedor inativo inflava conversão | conversas somam todos os vendedores, como os fechamentos. |
