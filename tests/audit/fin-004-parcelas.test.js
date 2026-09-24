// FIN-004 / CODE-005: valor de parcela paga não pode mudar depois; reduzir
// parcelas não pode apagar parcelas pagas; pagamento em lote grava o valor.
const test = require('node:test');
const assert = require('node:assert');
const { load } = require('./lib');

const FNS = ['toLocalISODate','todayISO','recStatus','valorEfetivoParcela','ivaProporcionalRecorrencia','taxaComissao',
  'daysInMonth','periodRange','inPeriodOrAll','buildEvents'];
const NEW = ['arred4','parcelaComValorEstimado','registrarPagamentoParcelas','congelarValoresParcelasPagas','aplicarEdicaoRecorrencia'];

function mk(){
  const rec = { id:'rec-1', dataVenda:'2026-06-01', cliente:'X', valorContrato:1200, valorEntrada:200, iva:0, txAdm:0,
    nParcelas:2, vendedorId:'v', parcelas:[ {numero:1, pago:true, data:'2026-07-01', valor:null}, {numero:2, pago:false, data:null, valor:null} ], pagamentosExtras:[] };
  const STATE = { sales:[], recurrences:[rec], meta:{} };
  let ctx;
  try { ctx = load([...FNS, ...NEW], { STATE }); } catch(e){ ctx = null; }
  return { ctx, rec, STATE };
}
const julho = { granularity:'month', anchor:'2026-07' };
const recebidoJulho = (ctx) => ctx.buildEvents().filter(e=>ctx.inPeriodOrAll(e.date, julho)).reduce((a,e)=>a+e.valor,0);

test('funções de proteção existem', () => { assert.ok(mk().ctx, 'registrarPagamentoParcelas/congelarValoresParcelasPagas/aplicarEdicaoRecorrencia'); });

test('editar o contrato não muda o valor de parcela já paga (julho fica igual)', () => {
  const { ctx, rec } = mk();
  const antes = recebidoJulho(ctx); // 500 = (1200-200)/2
  const r = ctx.aplicarEdicaoRecorrencia(rec, { valorContrato:2000, valorEntrada:200, nParcelas:2 });
  assert.ok(r.ok);
  assert.strictEqual(recebidoJulho(ctx), antes);
  assert.strictEqual(rec.parcelas[0].valor, 500);
});

test('desfazer a entrada não muda o valor de parcela já paga', () => {
  const { ctx, rec } = mk();
  const antes = recebidoJulho(ctx);
  ctx.congelarValoresParcelasPagas(rec);
  rec.valorEntrada = 0;
  assert.strictEqual(recebidoJulho(ctx), antes);
});

test('pagamento em lote grava o valor de cada parcela', () => {
  const { ctx, rec } = mk();
  ctx.registrarPagamentoParcelas(rec, [2], '2026-08-01');
  assert.strictEqual(rec.parcelas[1].pago, true);
  assert.strictEqual(rec.parcelas[1].valor, 500);
  assert.strictEqual(rec.parcelas[1].data, '2026-08-01');
});

test('parcela padrão com valor 0 não é gravada como 0 (CHECK valor > 0)', () => {
  const { ctx, rec } = mk();
  rec.valorEntrada = 1200; // contrato todo pago na entrada
  ctx.registrarPagamentoParcelas(rec, [2], '2026-08-01');
  assert.notStrictEqual(rec.parcelas[1].valor, 0);
});

test('reduzir nº de parcelas abaixo de uma parcela paga é recusado', () => {
  const { ctx, rec } = mk();
  rec.parcelas[1].pago = true; rec.parcelas[1].data = '2026-08-01';
  const r = ctx.aplicarEdicaoRecorrencia(rec, { valorContrato:1200, valorEntrada:200, nParcelas:1 });
  assert.ok(r.erro);
  assert.strictEqual(rec.parcelas.length, 2);
});

test('pagamento sugerido nunca passa do saldo real (parcela congelada + isenção)', () => {
  const rec = { id:'r', dataVenda:'2026-06-01', cliente:'X', valorContrato:123, valorEntrada:0, iva:0, txAdm:23, nParcelas:2,
    parcelas:[ {numero:1, pago:true, data:'2026-07-01', valor:61.5}, {numero:2, pago:false, data:null, valor:null} ], pagamentosExtras:[] };
  const ctx = load([...FNS, ...NEW], { STATE:{ sales:[], recurrences:[rec], meta:{} } });
  rec.isentoTaxaAdm = true; // devido passa a 100; saldo real 38,50
  ctx.registrarPagamentoParcelas(rec, [2], '2026-08-01');
  assert.strictEqual(rec.parcelas[1].valor, 38.5);
  assert.ok(ctx.recStatus(rec).valorPendente <= 0.005);
});
