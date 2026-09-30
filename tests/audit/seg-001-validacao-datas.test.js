// SEG-001: o painel avisa antes de gravar os mesmos erros que o banco recusa
// (migrações 20260929 e 20260930): data no futuro, pagamento antes da venda,
// ano absurdo. Anos anteriores a 2026 são permitidos com confirmação.
const test = require('node:test');
const assert = require('node:assert');
const { load } = require('./lib');

let respostaConfirm = true, perguntas = 0;
const ctx = load(['toLocalISODate','confirmarDataAntiga','erroDataLancamento'], {
  INICIO_LANCAMENTOS: '2000-01-01',
  INICIO_PAINEL: '2026-01-01',
  _datasAntigasConfirmadas: new Set(),
  confirm: () => { perguntas++; return respostaConfirm; },
  fmtDate: d => d.split('-').reverse().join('/'),
});

test('ano anterior confirmado passa (cliente/lead antigo)', () => {
  respostaConfirm = true; perguntas = 0;
  assert.strictEqual(ctx.erroDataLancamento('2024-05-10', 'A data da venda'), null);
  assert.strictEqual(perguntas, 1);
  // a mesma data não pergunta duas vezes (editor de parcelas valida em laço)
  assert.strictEqual(ctx.erroDataLancamento('2024-05-10', 'A data da venda'), null);
  assert.strictEqual(perguntas, 1);
});

test('ano anterior NÃO confirmado (2025 no lugar de 2026) é recusado', () => {
  respostaConfirm = false;
  assert.match(ctx.erroDataLancamento('2025-08-18', 'A data'), /confira o ano/);
});

test('ano absurdo (antes de 2000) é recusado sem perguntar', () => {
  perguntas = 0;
  assert.match(ctx.erroDataLancamento('0202-08-18', 'A data'), /confira o ano/);
  assert.strictEqual(perguntas, 0);
});

test('data no futuro é recusada', () => {
  assert.match(ctx.erroDataLancamento('2099-01-01', 'A data'), /futuro/);
});

test('pagamento antes da venda é recusado', () => {
  assert.match(ctx.erroDataLancamento('2026-03-01', 'A data do pagamento', '2026-07-01'), /anterior à data da venda/);
  assert.match(ctx.erroDataLancamento('2023-01-01', 'A data do pagamento', '2023-06-01'), /anterior à data da venda/);
});

test('data válida de 2026 passa sem perguntar', () => {
  perguntas = 0;
  assert.strictEqual(ctx.erroDataLancamento('2026-07-05', 'A data do pagamento', '2026-07-01'), null);
  assert.strictEqual(ctx.erroDataLancamento(ctx.toLocalISODate(new Date()), 'A data'), null);
  assert.strictEqual(perguntas, 0);
});

test('data vazia é recusada', () => {
  assert.match(ctx.erroDataLancamento('', 'A data'), /obrigatória/);
});
