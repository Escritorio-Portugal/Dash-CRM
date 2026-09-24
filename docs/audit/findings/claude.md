# Findings — Claude (análise de código @399514d)

Status geral: evidência de **código** (leitura linha a linha). Nenhum finding abaixo
tem ainda evidência de banco ou de browser, porque o acesso ao Supabase está bloqueado.
"CONFIRMED (código)" = o comportamento decorre deterministicamente do código; o
impacto real em euros depende do estado do banco (ver DATA_INVARIANTS.md).

---

## DATA-001 — Falha de leitura no login re-executa as 12 migrações antigas e pode sobrescrever dados reais

**Severity:** CRITICAL · **Confidence:** HIGH · **Status:** CONFIRMED (código) · **Category:** data-loss

### Location
`index.html:583-593` (DB.get fallback), `:774-795` (loadState), `:1921-1934` (runGestorMigrationsIfNeeded), `:1942-1944` (boot)

### Observed
`DB.get(key, fallback)` devolve `SEED_DATA.*` quando a leitura **dá erro** (rede, JWT expirado, 5xx), e só mostra um toast.
`crm:meta` do SEED não tem nenhuma flag `apply*`. Em seguida o boot do gestor corre as 12 migrações, que fazem `persist(...)`:
- `applyHistoricalImport` reinjeta 45 vendas + 43 custos e grava `crm:costs` inteiro;
- `applyReconciliacaoJulho2026v2` repõe `rec.parcelas` de maio/junho com o **snapshot de julho**, desmarcando pagamentos feitos depois, e faz upsert disso no banco;
- `applyReconciliacaoJulho2026v3`, `applyCorrigeEntradaRecorrencias2026` etc. voltam a reescrever valores;
- se `crm:costs` também falhar, os 23 custos de exemplo (soma €7.670,88) são gravados **por cima** dos custos reais;
- `crm:meta` é regravado com `valorMeta`/`taxaComissao` do SEED.
Se a chave simplesmente não existir, o SEED também é **gravado** no banco (`:587`).

### Impact
Perda silenciosa de custos, pagamentos de parcelas e configuração; números falsos em todos os cards.

### Recommendation
`DB.get` deve **abortar o boot** em erro (nunca cair em SEED para dados de negócio); remover o seed automático; retirar as migrações JS de uma vez do caminho de boot (já cumpriram a função) ou exigir leitura bem-sucedida de `crm:meta` antes de qualquer uma.

### Regression test
Simular erro no `sbGet('crm:meta')` → boot tem de parar sem nenhum `upsert`.

---

## FIN-001 — Custos fixos contados duas vezes (registo exato + pagoPorMes do registo-base)

**Severity:** HIGH · **Confidence:** HIGH · **Status:** CONFIRMED (código; valores de agosto do handoff) · **Category:** financeiro

### Location
`custosFixosDoMes` `:1581-1607` (1 custo por nome/mês) vs `linhasFinanceiras` `:4198-4215` (soma **todos** os pagos)

### Observed
A lista mostra um lançamento por nome/mês; o card, o Resumo, o Registro, o Extrato e o lucro somam o registo exato pago **mais** cada `pagoPorMes[mês]` pago de qualquer outro registo com o mesmo nome. Agosto: PABLO (+€2.500) e CONTABILISTA (+€50), card €10.401,75 vs lista €7.851,75 (dados do handoff, a revalidar).
O contrário também existe: `pagoPorMes[mês] = true` (booleano, formato antigo) conta como pago na lista (`costPagoNoMes`) mas **não** entra no card (`linhasFinanceiras` exige objeto com `data`).

### Root cause (mecanismo provável da duplicação — ver FIN-002)

### Recommendation
Uma única função "custos fixos do mês" usada por lista **e** totais; `linhasFinanceiras` deve derivar de `custosFixosDoMes`.

---

## FIN-002 — Editar um custo "repete" altera o registo-base e todo o histórico

**Severity:** HIGH · **Confidence:** HIGH · **Status:** CONFIRMED (código) · **Category:** financeiro / integridade

### Location
`openCostModal` `:4987-5019`, botão editar `:4167`/`:5486`

### Observed
O custo projetado carrega o `id` do registo-base. Guardar faz `Object.assign(base, {nome, valor, categoria, vencimento})`:
1. `vencimento` passa a ser o do mês visualizado → o custo **deixa de existir nos meses entre o vencimento antigo e o novo** (`anteriores` fica vazio);
2. `valor` novo passa a valer para **todos** os `pagoPorMes` passados (despesa histórica muda);
3. `pagoPorMes` antigos continuam lá.
Sequência que reproduz exatamente o padrão PABLO/CONTABILISTA: editar o custo em setembro → agosto perde PABLO da lista → alguém relança PABLO em agosto (novo `cst-…`) e marca pago → FIN-001 conta o `pagoPorMes['2026-08']` do base **e** o novo registo.
O aviso na UI ("editar aqui muda o valor a partir de agora, sem afetar meses já fechados", `:4163`) é **falso**.

### Impact
Forte indício de que a duplicação de agosto é artefacto do sistema (1 pagamento real, 2 lançamentos), mas **só comprovante bancário confirma**.

### Recommendation
Editar projetado = criar lançamento exato para o mês (nunca mutar o base); valor por mês gravado em `pagoPorMes[mês].valor`.

---

## FIN-003 — Excluir custo "repete" apaga o histórico, contrariando o aviso

**Severity:** MEDIUM · **Confidence:** HIGH · **Status:** CONFIRMED (código)
`:5529-5537`: apaga o registo e todos os seus `pagoPorMes`; o modal promete "os meses já fechados no passado não mudam". Todos os meses anteriores perdem essa despesa.
**Fix:** exclusão lógica com `fimEm: 'YYYY-MM'`.

---

## FIN-004 — Parcelas pagas sem valor gravado mudam de valor retroativamente

**Severity:** HIGH · **Confidence:** HIGH · **Status:** CONFIRMED (código) · **Category:** financeiro

### Location
`valorEfetivoParcela` `:1414`, `recStatus` `:1359-1364`, `abrirPagamentoRecorrenciaModal` `:2298`, `estornarLancamento('entrada')` `:4232-4236`, `openEditRecModal` `:4829-4863`, migration `20260922184119` (põe `valor = NULL` em parcelas pagas com 0)

### Observed
Parcela paga com `valor` NULL recebe `(contrato − entrada)/nParcelas` **calculado agora**. Mudam o valor de parcelas já pagas (e o faturamento/IVA/comissão/lucro de meses fechados):
- editar valor do contrato, entrada ou nº de parcelas;
- desfazer a entrada no Extrato (entrada → 0 aumenta cada parcela);
- marcar isenção de taxa adm.
O modal "Efetuar pagamento" em lote (`:2298`) **não grava `p.valor`**, ao contrário dos outros dois caminhos → toda parcela paga por ali fica exposta a isto.
Handoff: 5 parcelas de agosto nesta situação = €1.274,65 inferidos.

### Recommendation
Gravar sempre `p.valor` ao pagar; migração que materializa o valor atual das parcelas pagas NULL (após conferência); exibir marcador "valor inferido" enquanto houver NULL.

---

## FIN-005 — Venda integral com pagamento parcial conta todo o recebido na data da venda

**Severity:** MEDIUM · **Confidence:** HIGH · **Status:** CONFIRMED (código)
`buildEvents :1290-1297`, `linhasFinanceiras :4179`: `valorPago` é um total sem data; recebimento posterior altera o mês da venda retroativamente. **Fix:** registrar recebimentos de venda com data própria (como `pagamentos_extras`).

---

## FIN-006 — Taxa de conversão conta venda-espelho e recorrência como 2 fechamentos

**Severity:** MEDIUM · **Confidence:** HIGH · **Status:** CONFIRMED (código)
`computeGlobalForPeriod :1547`: `fechamentos = salesIn.length + recsIn.length`, sem excluir `jaContabilizadoViaRecorrencia`. Maio/junho/julho têm dezenas de espelhos (reconciliações de `:906`, `:874`) → conversão inflada nesses meses. Agosto: 0 espelhos, sem impacto.

## FIN-007 — "Conversas" usa valor estático quando o funil do período está vazio

**Severity:** MEDIUM · **Confidence:** HIGH · **Status:** CONFIRMED (código)
`:1549`: `sumFunilDiario(s, filter).conversas || s.conversasIniciadas` → num mês sem funil preenchido entra o total manual antigo do vendedor (não é do período). `computeSellerStats :1515-1516` usa `fechamentosManual` sem período.

## FIN-008 — Subcards de "Valor vendido" não somam o card

**Severity:** LOW · **Confidence:** HIGH · **Status:** CONFIRMED (código)
`computeVendasBreakdown :1677` usa só `pagamentoIntegral`; o card usa todas as vendas não-espelho. Venda não integral e sem espelho entra no card e em nenhum subcard; espelho marcado integral entraria no subcard e na recorrência. "Parcelas em aberto" ignora o filtro (rótulo diz "situação atual", ok).

## FIN-009 — Pendências e "atrasadas" usam o estado atual e regra de 30 dias desde a venda

**Severity:** MEDIUM · **Confidence:** HIGH · **Status:** CONFIRMED (código)
`recStatus` não tem data de corte; `diasAtraso :1389` marca como atrasado **qualquer** contrato não quitado com mais de 30 dias desde a venda, mesmo com parcelas a vencer → alertas falsos para contratos de 4–8 parcelas em dia.

## FIN-010 — Custo variável é contado pelo vencimento, não pela data de pagamento

**Severity:** LOW · `:4216`. Contradiz o texto da UI ("efetivamente pago no período", `:4135`). Custos fixos também usam vencimento como "data de pagamento" (`:5500`, `:5508`, `:5522`); o card é por **competência**, não por caixa.

---

## CODE-001 — Duplo clique cria vendas/recorrências/pagamentos duplicados

**Severity:** HIGH · **Confidence:** HIGH · **Status:** CONFIRMED (código) · **Category:** idempotência
`openQuickAddModal :4559-4599`, `openAddRecModal :4911-4935`, `abrirPagamentoModal :2236-2253`: botão não é desativado; id = `'vda-'|'rec-'|'pgx-' + Date.now()` → cada clique gera id novo → 2 linhas no banco. Pagamento personalizado duplicado soma no faturamento.

## CODE-002 — Aviso "valor acima do pendente" não bloqueia

**Severity:** MEDIUM · `:2241-2244`: mostra o aviso e **grava na mesma** no mesmo clique.

## CODE-003 — Erros de gravação deixam a tela divergente do banco

**Severity:** HIGH · **Confidence:** HIGH · **Status:** CONFIRMED (código)
Todos os fluxos mutam `STATE` **antes** de gravar e não têm `try/catch` (`:4580`, `:4597`, `:2251`, `:4763`, `:4858`). `persistRecorrencia` faz 5 chamadas não transacionais (rec → parcelas → delete → extras → delete); falha a meio deixa estado parcial. Excluir venda/recorrência (`:5140`, `:5165`) ignora o `error` do delete: some da tela e volta no reload. `DB.set` (custos, meta) engole o erro com toast.

## CODE-004 — Custos, meta, serviços e vendedores: último a gravar apaga o outro

**Severity:** MEDIUM · `persist('costs'|'meta'|'services'|'sellers')` regrava o JSON inteiro de `app_state` sem controlo de versão; dois gestores com o painel aberto perdem marcações um do outro.

## CODE-005 — Reduzir nº de parcelas apaga parcelas já pagas

**Severity:** MEDIUM · `openEditRecModal :4853-4854` + delete em `persistRecorrencia :1102`: parcelas pagas removidas do banco (só há um aviso de texto). Criação aceita 1–4 parcelas, edição 1–8.

## CODE-006 — Remoções das migrações JS não chegam ao banco

**Severity:** MEDIUM (histórico) · **Status:** HYPOTHESIS → precisa de SQL
Desde as tabelas relacionais, `persist('sales'|'recurrences')` só faz **upsert**. As migrações que removiam registos da memória (`:835`, `:876`, `:962-964`, `:1067`) não apagam nada no banco. Se alguma correu depois da migração relacional, os registos "removidos" continuam lá (ex.: 23 vendas de julho da Larissa + as 49 da v2). Verificar com INV-DUP-*.

---

## DB-001 — Migração de 22/09 altera dados reais; estado de aplicação desconhecido

**Severity:** HIGH (processo) · **Status:** NEEDS_RUNTIME_EVIDENCE
`supabase/migrations/20260922184119_repair_audit_integrity.sql` faz `UPDATE parcelas SET valor=NULL` (alimenta FIN-004), reescala 2 vendas e 3 recorrências, muda GRANTs/políticas. Sem registo de aplicação no repo. Verificar em `supabase_migrations.schema_migrations` e pelos CHECKs `*_valores_validos`.

## SEC-001 — Políticas RLS das tabelas relacionais não estão versionadas

**Severity:** MEDIUM · **Status:** NEEDS_RUNTIME_EVIDENCE
O repo só tem políticas de `app_state`/`profiles`; `vendas/recorrencias/parcelas/pagamentos_extras` foram criadas fora do repositório. `schema.sql` ainda contém políticas anon `USING (true)`: confirmar que foram removidas em produção.
