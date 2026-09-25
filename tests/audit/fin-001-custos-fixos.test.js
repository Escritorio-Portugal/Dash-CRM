// FIN-001/002/003/010: custos fixos — card = lista, data real de pagamento,
// excluir interrompe só dali para a frente, editar repetição não muta o histórico.
const test = require('node:test');
const assert = require('node:assert');
const { load } = require('./lib');

const BASE_FNS = ['daysInMonth','toLocalISODate','todayISO','periodRange','inPeriodOrAll','normNomeCusto',
  'custosFixosDoMes','projetarVencimentoNoMes','costPagoNoMes','computeCosts','linhasFinanceiras','recStatus','valorEfetivoParcela'];
const NEW_FNS = ['interromperAnteriorMesmoNome','mesDe','registoPagamentoNoMes','mesesDeCompetencia','marcarCustoPago','desmarcarCustoPago','salvarEdicaoCusto','excluirCusto','novoIdCusto'];

function tryLoad(costs){
  const STATE = { costs: JSON.parse(JSON.stringify(costs)), sales: [], recurrences: [] };
  let ctx;
  try { ctx = load([...BASE_FNS, ...NEW_FNS], { STATE }); }
  catch(e){ ctx = load([...BASE_FNS, 'custoDataPagamentoNoMes'], { STATE }); } // código antigo
  return ctx;
}
const mes = (m) => ({ granularity: 'month', anchor: m });
const somaListaPaga = (ctx, m) => ctx.computeCosts(mes(m)).fixos.filter(c => c.pago)
  .reduce((a, c) => a + (c._valorPago != null ? c._valorPago : c.valor), 0);

// Registos reais do banco (crm:costs, 24/09/2026), só os campos relevantes.
const REAIS = [
  { id:'cst-025', nome:'PABLO', valor:2500, categoria:'FIXO', vencimento:'2026-09-11', pago:true, pagoPorMes:{'2026-08':{pago:true,data:'2026-08-11'}} },
  { id:'cst-1789732331546', nome:'PABLO', valor:2500, categoria:'FIXO', vencimento:'2026-07-10', pago:true, dataPagamento:'2026-07-10' },
  { id:'cst-1789732197528', nome:'PABLO', valor:2500, categoria:'FIXO', vencimento:'2026-08-12', pago:true, dataPagamento:'2026-08-12' },
  { id:'cst-1789732315046', nome:'PABLO', valor:2500, categoria:'FIXO', vencimento:'2026-09-10', pago:false },
  { id:'cst-1789732102394', nome:'PABLO', valor:2500, categoria:'FIXO', vencimento:'2026-09-12', pago:false },
  { id:'cst-1789732149078', nome:'PABLO', valor:2500, categoria:'FIXO', vencimento:'2026-09-12', pago:false },
  { id:'cst-010', nome:'CONTABILISTA', valor:50, categoria:'FIXO', vencimento:'2026-09-18', pago:true, pagoPorMes:{'2026-06':false,'2026-08':{pago:true,data:'2026-08-18'}} },
  { id:'cst-1789732731715', nome:'CONTABILISTA', valor:50, categoria:'FIXO', vencimento:'2026-08-10', pago:true, dataPagamento:'2026-08-10' },
  { id:'cst-024', nome:'FERNANDA', valor:1250, categoria:'FIXO', vencimento:'2026-09-11', pago:true, pagoPorMes:{} },
  { id:'cst-1789732088011', nome:'FERNANDA', valor:1250, categoria:'FIXO', vencimento:'2026-08-12', pago:true, dataPagamento:'2026-08-12' },
  { id:'cst-1789743143642', nome:'FERNANDA', valor:1250, categoria:'FIXO', vencimento:'2026-09-10', pago:false },
  { id:'cst-007', nome:'ESTACIONAMENTO', valor:45, categoria:'FIXO', vencimento:'2026-09-01', pago:true, pagoPorMes:{'2026-08':true} },
  { id:'cst-1789732778799', nome:'ESTACIONAMENTO', valor:45, categoria:'FIXO', vencimento:'2026-08-20', pago:true, dataPagamento:'2026-08-20' },
];

test('card de custos fixos = soma dos pagos da lista (agosto e setembro, dados reais)', () => {
  const ctx = tryLoad(REAIS);
  for(const m of ['2026-07','2026-08','2026-09']){
    assert.strictEqual(ctx.computeCosts(mes(m)).totalFixos, somaListaPaga(ctx, m), 'mês ' + m);
  }
});

test('agosto conta PABLO e CONTABILISTA uma vez só', () => {
  const ctx = tryLoad(REAIS);
  assert.strictEqual(ctx.computeCosts(mes('2026-08')).totalFixos, 2500 + 50 + 1250 + 45);
});

test('lista de setembro mostra todos os lançamentos do mês (duplicados visíveis)', () => {
  const ctx = tryLoad(REAIS);
  const pablo = ctx.computeCosts(mes('2026-09')).fixos.filter(c => c.nome === 'PABLO');
  assert.strictEqual(pablo.length, 4);
  assert.ok(pablo.every(c => c._duplicado));
});

const SIMPLES = [ { id:'cst-a', nome:'ALUGUEL', valor:1000, categoria:'FIXO', vencimento:'2026-06-05', pago:true, dataPagamento:'2026-06-05' } ];

test('marcar pago guarda a data real (pago em atraso) e conta no mês do custo', () => {
  const ctx = tryLoad(SIMPLES);
  ctx.marcarCustoPago('cst-a', '2026-07', '2026-08-03');
  const jul = ctx.custosFixosDoMes('2026-07')[0];
  assert.strictEqual(jul.pago, true);
  assert.strictEqual(jul._dataPagamento, '2026-08-03');
  assert.strictEqual(ctx.computeCosts(mes('2026-07')).totalFixos, 1000);
  assert.strictEqual(ctx.computeCosts(mes('2026-08')).totalFixos, 0);
  const extrato = ctx.linhasFinanceiras({ granularity:'day', anchor:'2026-08-03' }, { porPagamento:true }).filter(l => l.tipo === 'Custo fixo');
  assert.strictEqual(extrato.length, 1);
});

test('excluir a partir de um mês interrompe dali para a frente e preserva o passado', () => {
  const ctx = tryLoad(SIMPLES);
  ctx.marcarCustoPago('cst-a', '2026-07', '2026-07-05');
  const r = ctx.excluirCusto('cst-a', '2026-08');
  assert.ok(r.ok);
  assert.strictEqual(ctx.custosFixosDoMes('2026-06').length, 1);
  assert.strictEqual(ctx.custosFixosDoMes('2026-07').length, 1);
  assert.strictEqual(ctx.computeCosts(mes('2026-07')).totalFixos, 1000);
  assert.strictEqual(ctx.custosFixosDoMes('2026-08').length, 0);
  assert.strictEqual(ctx.custosFixosDoMes('2026-12').length, 0);
});

test('relançar manualmente depois de excluído volta a repetir', () => {
  const ctx = tryLoad(SIMPLES);
  ctx.excluirCusto('cst-a', '2026-08');
  ctx.STATE.costs.push({ id:'cst-b', nome:'ALUGUEL', valor:1100, categoria:'FIXO', vencimento:'2026-10-05', pago:false });
  assert.strictEqual(ctx.custosFixosDoMes('2026-09').length, 0);
  assert.strictEqual(ctx.custosFixosDoMes('2026-11')[0].valor, 1100);
});

test('excluir no mês de origem com pagamentos seguintes é recusado', () => {
  const ctx = tryLoad(SIMPLES);
  ctx.marcarCustoPago('cst-a', '2026-07', '2026-07-05');
  const r = ctx.excluirCusto('cst-a', '2026-06');
  assert.ok(r.erro);
  assert.strictEqual(ctx.STATE.costs.length, 1);
});

test('editar uma repetição cria lançamento novo e não muda o original nem o passado', () => {
  const ctx = tryLoad(SIMPLES);
  ctx.marcarCustoPago('cst-a', '2026-07', '2026-07-05');
  const r = ctx.salvarEdicaoCusto('cst-a', '2026-08', { nome:'ALUGUEL', valor:1200, categoria:'FIXO', vencimento:'2026-08-05' });
  assert.ok(r.ok);
  const orig = ctx.STATE.costs.find(c => c.id === 'cst-a');
  assert.strictEqual(orig.vencimento, '2026-06-05');
  assert.strictEqual(orig.valor, 1000);
  assert.strictEqual(ctx.computeCosts(mes('2026-07')).totalFixos, 1000);
  assert.strictEqual(ctx.custosFixosDoMes('2026-08')[0].valor, 1200);
  assert.strictEqual(ctx.custosFixosDoMes('2026-09')[0].valor, 1200);
});

test('editar o valor do lançamento original não altera meses já pagos pela repetição', () => {
  const ctx = tryLoad(SIMPLES);
  ctx.marcarCustoPago('cst-a', '2026-07', '2026-07-05');
  ctx.salvarEdicaoCusto('cst-a', '2026-06', { nome:'ALUGUEL', valor:900, categoria:'FIXO', vencimento:'2026-06-05' });
  assert.strictEqual(ctx.computeCosts(mes('2026-07')).totalFixos, 1000);
  assert.strictEqual(ctx.computeCosts(mes('2026-06')).totalFixos, 900);
});

test('editar o lançamento do próprio mês não pode movê-lo para outro mês', () => {
  const ctx = tryLoad(SIMPLES);
  const r = ctx.salvarEdicaoCusto('cst-a', '2026-06', { nome:'ALUGUEL', valor:1000, categoria:'FIXO', vencimento:'2026-09-05' });
  assert.ok(r.erro);
  assert.strictEqual(ctx.STATE.costs[0].vencimento, '2026-06-05');
});

// --- Casos levantados na revisão do Codex (d578528) ---
const MODELO_E_NOVO_VALOR = [
  { id:'jan', nome:'ALUGUEL', valor:1000, categoria:'FIXO', vencimento:'2026-01-05', pago:true, dataPagamento:'2026-01-05' },
  { id:'abr', nome:'ALUGUEL', valor:1200, categoria:'FIXO', vencimento:'2026-04-05', pago:false },
];

test('excluir o lançamento no próprio mês interrompe a repetição (não ressuscita o anterior)', () => {
  const ctx = tryLoad(MODELO_E_NOVO_VALOR);
  const r = ctx.excluirCusto('abr', '2026-04');
  assert.ok(r.ok);
  assert.strictEqual(ctx.custosFixosDoMes('2026-03').length, 1);
  assert.strictEqual(ctx.custosFixosDoMes('2026-04').length, 0);
  assert.strictEqual(ctx.custosFixosDoMes('2026-06').length, 0);
});

test('excluir um duplicado do mês não interrompe o custo', () => {
  const ctx = tryLoad([...MODELO_E_NOVO_VALOR, { id:'abr2', nome:'ALUGUEL', valor:1200, categoria:'FIXO', vencimento:'2026-04-05', pago:false }]);
  ctx.excluirCusto('abr2', '2026-04');
  assert.strictEqual(ctx.custosFixosDoMes('2026-04').length, 1);
  assert.strictEqual(ctx.custosFixosDoMes('2026-05').length, 1);
});

test('renomear uma repetição não deixa o nome antigo a repetir junto', () => {
  const ctx = tryLoad(SIMPLES);
  ctx.salvarEdicaoCusto('cst-a', '2026-08', { nome:'RENDA', valor:1000, categoria:'FIXO', vencimento:'2026-08-05' });
  const set = ctx.custosFixosDoMes('2026-09').map(c=>c.nome);
  assert.strictEqual(JSON.stringify(set), '["RENDA"]');
  assert.strictEqual(JSON.stringify(ctx.custosFixosDoMes('2026-07').map(c=>c.nome)), '["ALUGUEL"]');
});

test('card = soma dos pagos da lista também em semana, dia e total', () => {
  const ctx = tryLoad(REAIS);
  const filtros = [ {granularity:'week', anchor:'2026-08-10'}, {granularity:'day', anchor:'2026-08-12'}, {granularity:'all'} ];
  for(const f of filtros){
    const c = ctx.computeCosts(f);
    const lista = c.fixos.filter(x=>x.pago).reduce((a,x)=>a+(x._valorPago!=null?x._valorPago:x.valor),0);
    assert.strictEqual(c.totalFixos, lista, JSON.stringify(f));
  }
});

test('custo pago com atraso: card do mês de referência; Extrato na data real', () => {
  const ctx = tryLoad(SIMPLES);
  ctx.marcarCustoPago('cst-a', '2026-07', '2026-08-03');
  const semana = { granularity:'week', anchor:'2026-08-03' };
  assert.strictEqual(ctx.computeCosts(semana).totalFixos, 0); // o custo é de julho
  const extrato = ctx.linhasFinanceiras({ granularity:'day', anchor:'2026-08-03' }, { porPagamento:true }).filter(l=>l.tipo==='Custo fixo');
  assert.strictEqual(extrato.length, 1);
});

test('renomear o lançamento no próprio mês também interrompe o modelo anterior', () => {
  const ctx = tryLoad(MODELO_E_NOVO_VALOR);
  const r = ctx.salvarEdicaoCusto('abr', '2026-04', { nome:'RENDA', valor:1200, categoria:'FIXO', vencimento:'2026-04-05' });
  assert.ok(r.ok);
  assert.strictEqual(JSON.stringify(ctx.custosFixosDoMes('2026-06').map(c=>c.nome)), '["RENDA"]');
  assert.strictEqual(JSON.stringify(ctx.custosFixosDoMes('2026-03').map(c=>c.nome)), '["ALUGUEL"]');
});

test('repetição paga adiantado (mês futuro) aparece no Extrato do dia do pagamento e no Total', () => {
  const ctx = tryLoad([{ id:'c1', nome:'ALUGUEL', valor:100, categoria:'FIXO', vencimento:'2026-01-05', pago:true, dataPagamento:'2026-01-05',
    pagoPorMes:{ '2099-03':{ pago:true, data:'2026-01-20', valor:100 } } }]);
  const dia = ctx.linhasFinanceiras({ granularity:'day', anchor:'2026-01-20' }, { porPagamento:true });
  assert.strictEqual(dia.filter(l => l.tipo==='Custo fixo').length, 1);
  const total = ctx.linhasFinanceiras({ granularity:'all' }).filter(l => l.tipo==='Custo fixo').reduce((a,l)=>a+l.valor,0);
  assert.strictEqual(total, 200);
});
