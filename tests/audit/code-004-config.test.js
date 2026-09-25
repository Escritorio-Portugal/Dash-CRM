// CODE-004: configurações (comissão, meta, serviços, vendedores, leads) só
// ficam na tela se o banco aceitar; se recusar, o STATE volta ao que era.
const test = require('node:test');
const assert = require('node:assert');
const { load } = require('./lib');

const FNS = ['snapshotObj','gravarOuReverter','mudarEGravar'];
function ctx(falhar){
  const toasts = [];
  const c = load(FNS, {
    STATE:{ meta:{ taxaComissao:0.10 }, services:[{ id:'s1', nome:'A' }] },
    persist: async ()=>{ if(falhar) throw new Error('recusado'); },
    showErrorToast: m=>toasts.push(m),
  });
  return { c, toasts };
}

test('banco aceita: mudança fica', async () => {
  const { c } = ctx(false);
  const ok = await c.mudarEGravar(['meta'], ()=>{ c.STATE.meta.taxaComissao = 0.12; }, 'meta');
  assert.strictEqual(ok, true);
  assert.strictEqual(c.STATE.meta.taxaComissao, 0.12);
});

test('banco recusa: comissão e serviços voltam ao que eram, com aviso', async () => {
  const { c, toasts } = ctx(true);
  const ok = await c.mudarEGravar(['meta','services'], ()=>{ c.STATE.meta.taxaComissao = 0.15; c.STATE.services = []; }, 'meta', null, 'a regra NÃO foi gravada');
  assert.strictEqual(ok, false);
  assert.strictEqual(c.STATE.meta.taxaComissao, 0.10);
  assert.strictEqual(c.STATE.services.length, 1);
  assert.match(toasts[0], /NÃO foi gravada/);
});
