// DATA-001: erro de leitura não pode cair em dados SEED nem disparar gravações.
const test = require('node:test');
const assert = require('node:assert');
const { load } = require('./lib');

function mkDB(sbGetImpl){
  const writes = [];
  const ctx = load([], {
    sbGet: sbGetImpl,
    sbSet: async (k, v) => { writes.push(k); },
    showErrorToast: () => {},
  }, ['DB']);
  return { DB: ctx.DB || require('vm').runInContext('DB', ctx), writes };
}

test('erro de leitura rejeita e não devolve o fallback', async () => {
  const { DB, writes } = mkDB(async () => { throw new Error('JWT expired'); });
  await assert.rejects(() => DB.get('crm:costs', [{ id: 'seed' }]));
  assert.deepStrictEqual(writes, []);
});

test('chave ausente devolve fallback sem gravar nada no banco', async () => {
  const { DB, writes } = mkDB(async () => undefined);
  const v = await DB.get('crm:leadEdits', {});
  assert.deepStrictEqual(v, {});
  assert.deepStrictEqual(writes, []);
});

test('migrações JS não correm se crm:meta não veio do banco', async () => {
  const chamadas = [];
  const fns = ['applyCorrecaoDatasCustosProjetados','applyHistoricalImport','applyDedupSalesVsRecurrences','applyJulhoUpdate',
    'applyLarissaIndividualJuly','applyReconciliacaoMaioJunho2026','applyDedupCustos2026','applyCorrigeEntradaRecorrencias2026',
    'applyFormaPagamentoRecorrencias2026','applyRemoveStaleLeandroRecorrencia','applyReconciliacaoJulho2026v2','applyReconciliacaoJulho2026v3'];
  const globals = { STATE: { role: 'gestor', meta: {}, metaCarregadaDoBanco: false } };
  fns.forEach(f => globals[f] = async () => chamadas.push(f));
  const ctx = load(['runGestorMigrationsIfNeeded'], globals);
  await ctx.runGestorMigrationsIfNeeded();
  assert.deepStrictEqual(chamadas, []);
});
