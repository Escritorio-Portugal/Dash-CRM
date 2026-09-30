// FIN-011: ao mudar entrada/contrato/valor de uma parcela, as OUTRAS parcelas
// são recalculadas para que entrada + parcelas + pagamentos personalizados
// somem exatamente o contrato (regra do gestor, 30/09/2026).
const test = require('node:test');
const assert = require('node:assert');
const { load } = require('./lib');

const ctx = load(['recStatus','valorEfetivoParcela','arred4','recalcularParcelas'], {
  fmtEUR: n => n.toFixed(2) + ' €',
});
const soma = rec => ctx.recStatus(rec).valorPago;
const rec = (o) => Object.assign({ valorContrato:750, valorEntrada:0, nParcelas:2, txAdm:0, isentoTaxaAdm:false, pagamentosExtras:[], parcelas:[] }, o);

test('EDINEIA: entrada passa a 300, as 2 parcelas pagas viram 225 cada', () => {
  const r = rec({ valorEntrada:300, parcelas:[{numero:1,pago:true,data:'2026-03-01',valor:262.5},{numero:2,pago:true,data:'2026-08-05',valor:262.5}] });
  assert.ok(ctx.recalcularParcelas(r).ok);
  assert.deepStrictEqual(r.parcelas.map(p=>p.valor), [225, 225]);
  assert.strictEqual(soma(r), 750);
});

test('editar uma parcela: ela fica como digitada, a outra paga absorve o resto', () => {
  const r = rec({ valorEntrada:300, parcelas:[{numero:1,pago:true,data:'2026-03-01',valor:300},{numero:2,pago:true,data:'2026-08-05',valor:225}] });
  ctx.recalcularParcelas(r, new Set([1]));
  assert.deepStrictEqual(r.parcelas.map(p=>p.valor), [300, 150]);
  assert.strictEqual(soma(r), 750);
});

test('com parcelas em aberto: pagas recebem a parte igual, as abertas ficam com o que falta', () => {
  const r = rec({ valorContrato:1000, valorEntrada:100, nParcelas:3, parcelas:[{numero:1,pago:true,data:'2026-05-01',valor:400},{numero:2,pago:true,data:'2026-06-01',valor:100},{numero:3,pago:false,data:null,valor:null}] });
  ctx.recalcularParcelas(r, new Set([1]));
  assert.deepStrictEqual(r.parcelas.map(p=>p.valor), [400, 250, null]);
  const st = ctx.recStatus(r);
  assert.strictEqual(st.valorPendente, 250);
  assert.strictEqual(st.valorSugeridoProxima, 250);
});

test('cêntimos: 350 em 3 parcelas soma exatamente 350', () => {
  const r = rec({ valorContrato:350, nParcelas:3, parcelas:[1,2,3].map(n=>({numero:n,pago:true,data:'2026-06-01',valor:100})) });
  ctx.recalcularParcelas(r);
  assert.deepStrictEqual(r.parcelas.map(p=>p.valor), [116.66, 116.66, 116.68]);
  assert.ok(Math.abs(soma(r) - 350) < 1e-9);
});

test('pagamentos personalizados entram na conta', () => {
  const r = rec({ valorContrato:600, valorEntrada:100, pagamentosExtras:[{id:'x',data:'2026-06-01',valor:100}], parcelas:[{numero:1,pago:true,data:'2026-06-01',valor:250},{numero:2,pago:true,data:'2026-07-01',valor:250}] });
  ctx.recalcularParcelas(r);
  assert.deepStrictEqual(r.parcelas.map(p=>p.valor), [200, 200]);
  assert.strictEqual(soma(r), 600);
});

test('isento de taxa administrativa: usa o contrato sem a taxa', () => {
  const r = rec({ valorContrato:500, txAdm:100, isentoTaxaAdm:true, parcelas:[{numero:1,pago:true,data:'2026-06-01',valor:250},{numero:2,pago:true,data:'2026-07-01',valor:250}] });
  ctx.recalcularParcelas(r);
  assert.deepStrictEqual(r.parcelas.map(p=>p.valor), [200, 200]);
});

test('sem saldo para as outras parcelas: recusa e não mexe em nada', () => {
  const r = rec({ valorEntrada:300, parcelas:[{numero:1,pago:true,data:'2026-03-01',valor:450},{numero:2,pago:true,data:'2026-08-05',valor:225}] });
  const res = ctx.recalcularParcelas(r, new Set([1]));
  assert.ok(res.erro);
  assert.deepStrictEqual(r.parcelas.map(p=>p.valor), [450, 225]);
});

test('nenhuma parcela paga: nada a gravar (as abertas já se ajustam sozinhas)', () => {
  const r = rec({ valorEntrada:300, parcelas:[{numero:1,pago:false,data:null,valor:null},{numero:2,pago:false,data:null,valor:null}] });
  assert.ok(ctx.recalcularParcelas(r).ok);
  assert.deepStrictEqual(r.parcelas.map(p=>p.valor), [null, null]);
  assert.strictEqual(ctx.recStatus(r).valorSugeridoProxima, 225);
});
