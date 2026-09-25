// FIN-010: o aviso "N parcela(s) pagas sem valor registado" lista exatamente
// as parcelas que o card está a estimar (pagas, valor ausente/0).
const test = require('node:test');
const assert = require('node:assert');
const { load } = require('./lib');

const FNS = ['toLocalISODate','todayISO','daysInMonth','recStatus','valorEfetivoParcela','parcelaComValorEstimado','inPeriodOrAll','periodRange','parcelasPagasSemValor'];
const rec = { id:'r', cliente:'A', dataVenda:'2026-06-10', valorContrato:900, valorEntrada:300, nParcelas:4, pagamentosExtras:[], parcelas:[
  { numero:1, pago:true, data:'2026-07-05', valor:null },  // estimada, julho
  { numero:2, pago:true, data:'2026-07-20', valor:150 },   // valor real
  { numero:3, pago:true, data:null, valor:0 },             // estimada, sem data
  { numero:4, pago:false, data:null, valor:null },         // aberta
]};

test('período: só as pagas sem valor com data no período', () => {
  const ctx = load(FNS, { STATE:{ recurrences:[rec] } });
  const l = ctx.parcelasPagasSemValor({ granularity:'month', anchor:'2026-07' }, false);
  assert.deepStrictEqual(JSON.parse(JSON.stringify(l.map(x=>x.parcela.numero))), [1]);
  assert.strictEqual(l[0].estimado, 150);
});

test('todas: inclui as pagas sem data, nunca as com valor ou abertas', () => {
  const ctx = load(FNS, { STATE:{ recurrences:[rec] } });
  const l = ctx.parcelasPagasSemValor({ granularity:'month', anchor:'2026-07' }, true);
  assert.deepStrictEqual(JSON.parse(JSON.stringify(l.map(x=>x.parcela.numero))), [1, 3]);
});
