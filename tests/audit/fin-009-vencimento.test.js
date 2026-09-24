// FIN-009: regra do escritório (24/09/2026): a parcela n vence n meses depois
// da data de registo (mesmo dia; último dia do mês quando não existe).
// "Atrasada" = tem parcela vencida e não paga na data de referência.
const test = require('node:test');
const assert = require('node:assert');
const { load } = require('./lib');

const FNS = ['toLocalISODate','todayISO','daysInMonth','recStatus','valorEfetivoParcela','vencimentoParcela','primeiraParcelaVencida','diasAtraso'];
function mk(parcelas, dataVenda='2026-06-10'){
  const rec = { id:'r', dataVenda, valorContrato:900, valorEntrada:300, nParcelas:parcelas.length, parcelas, pagamentosExtras:[] };
  return { ctx: load(FNS, { STATE:{ recurrences:[rec] } }), rec };
}

test('vencimento: n meses depois do registo, mesmo dia', () => {
  const { ctx, rec } = mk([{numero:1,pago:false},{numero:2,pago:false}]);
  assert.strictEqual(ctx.vencimentoParcela(rec, 1), '2026-07-10');
  assert.strictEqual(ctx.vencimentoParcela(rec, 2), '2026-08-10');
});

test('vencimento em mês mais curto usa o último dia', () => {
  const { ctx, rec } = mk([{numero:1,pago:false}], '2026-01-31');
  assert.strictEqual(ctx.vencimentoParcela(rec, 1), '2026-02-28');
});

test('contrato em dia NÃO é atrasado, mesmo com mais de 30 dias de venda', () => {
  const { ctx, rec } = mk([{numero:1,pago:true,data:'2026-07-09',valor:300},{numero:2,pago:false}]);
  assert.strictEqual(ctx.diasAtraso(rec, '2026-08-05'), 0); // parcela 2 vence 10/08
});

test('parcela vencida e não paga conta os dias desde o vencimento', () => {
  const { ctx, rec } = mk([{numero:1,pago:true,data:'2026-07-09',valor:300},{numero:2,pago:false}]);
  assert.strictEqual(ctx.diasAtraso(rec, '2026-08-20'), 10);
  assert.strictEqual(ctx.primeiraParcelaVencida(rec, '2026-08-20').numero, 2);
});

test('situação num mês passado: paga depois da data de referência ainda estava em atraso', () => {
  const { ctx, rec } = mk([{numero:1,pago:true,data:'2026-08-15',valor:300},{numero:2,pago:false}]);
  assert.strictEqual(ctx.diasAtraso(rec, '2026-07-31'), 21); // venceu 10/07, só foi paga em 15/08
});
