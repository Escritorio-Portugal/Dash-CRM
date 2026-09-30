// SEG-002: quando a sessão cai (token não renovou, ou "Sair" noutro aparelho),
// o banco responde "permission denied". O painel tem de dizer que a sessão
// expirou, e não mostrar o erro técnico. Erros de validação continuam iguais.
const test = require('node:test');
const assert = require('node:assert');
const { load } = require('./lib');

const ctx = load(['erroDeSessao','explicarErroBanco'], {});

test('permission denied / JWT expirado = sessão expirada', () => {
  assert.ok(ctx.erroDeSessao({ message:'permission denied for function verificar_integridade' }));
  assert.ok(ctx.erroDeSessao({ message:'JWT expired', code:'PGRST303' }));
  assert.ok(ctx.erroDeSessao({ status:401, message:'' }));
  assert.match(ctx.explicarErroBanco({ message:'permission denied for function salvar_recorrencia' }), /sessão expirou/);
});

test('proteções do banco (código 42501) NÃO são tratadas como sessão expirada', () => {
  assert.strictEqual(ctx.erroDeSessao({ code:'42501', message:'Só o gestor pode registar ou alterar pagamentos de parcelas.' }), false);
  assert.strictEqual(ctx.erroDeSessao({ code:'42501', message:'Proteção: esta gravação apagaria 5 itens de crm:costs de uma vez. Nada foi alterado.' }), false);
});

test('erro de validação do banco aparece como veio', () => {
  const msg = 'A parcela 1 foi paga (01/05/2026) antes da venda (01/06/2026).';
  assert.strictEqual(ctx.erroDeSessao({ message: msg }), false);
  assert.strictEqual(ctx.explicarErroBanco({ message: msg }), msg);
});
