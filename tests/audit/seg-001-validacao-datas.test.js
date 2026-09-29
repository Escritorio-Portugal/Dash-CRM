// SEG-001: o painel avisa antes de gravar os mesmos erros que o banco recusa
// (migração 20260929): ano errado, data no futuro, pagamento antes da venda.
const test = require('node:test');
const assert = require('node:assert');
const { load } = require('./lib');

const ctx = load(['toLocalISODate','erroDataLancamento'], {
  INICIO_LANCAMENTOS: '2026-01-01',
  fmtDate: d => d.split('-').reverse().join('/'),
});

test('ano errado (2025) é recusado', () => {
  assert.match(ctx.erroDataLancamento('2025-08-18', 'A data'), /confira o ano/);
});

test('data no futuro é recusada', () => {
  assert.match(ctx.erroDataLancamento('2099-01-01', 'A data'), /futuro/);
});

test('pagamento antes da venda é recusado', () => {
  assert.match(ctx.erroDataLancamento('2026-03-01', 'A data do pagamento', '2026-07-01'), /anterior à data da venda/);
});

test('data válida passa', () => {
  assert.strictEqual(ctx.erroDataLancamento('2026-07-05', 'A data do pagamento', '2026-07-01'), null);
  assert.strictEqual(ctx.erroDataLancamento(ctx.toLocalISODate(new Date()), 'A data'), null);
});

test('data vazia é recusada', () => {
  assert.match(ctx.erroDataLancamento('', 'A data'), /obrigatória/);
});
