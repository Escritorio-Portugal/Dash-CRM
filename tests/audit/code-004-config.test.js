// CODE-004: configurações (comissão, meta, serviços, vendedores, leads) só
// ficam na tela se o banco aceitar; se recusar, o STATE volta ao que era.
const test = require('node:test');
const assert = require('node:assert');
const { load } = require('./lib');

const FNS = ['snapshotObj','gravarOuReverter','enfileirarGravacao','mudarEGravar'];
function ctx(falhar){
  const toasts = [];
  const c = load(FNS, {
    STATE:{ meta:{ taxaComissao:0.10 }, services:[{ id:'s1', nome:'A' }] }, _filaGravacao:{},
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

test('duas gravações seguidas: a 1ª falha, a 2ª grava; a 2ª não some e a 1ª não vai junto', async () => {
  const enviados = [];
  let n = 0;
  const c = load(FNS, {
    STATE:{ leadEdits:{} },
    _filaGravacao:{},
    persist: async ()=>{ n++; enviados.push(JSON.stringify(c.STATE.leadEdits)); await new Promise(r=>setTimeout(r, 5)); if(n===1) throw new Error('recusado'); },
    showErrorToast: ()=>{},
  });
  const a = c.mudarEGravar(['leadEdits'], ()=>{ c.STATE.leadEdits.x = { A:'1' }; }, 'leadEdits');
  const b = c.mudarEGravar(['leadEdits'], ()=>{ c.STATE.leadEdits.x = Object.assign({}, c.STATE.leadEdits.x, { B:'2' }); }, 'leadEdits');
  assert.deepStrictEqual([await a, await b], [false, true]);
  assert.deepStrictEqual(JSON.parse(JSON.stringify(c.STATE.leadEdits)), { x:{ B:'2' } });
  assert.strictEqual(enviados[1], JSON.stringify({ x:{ B:'2' } })); // o A (recusado) não foi junto
});
