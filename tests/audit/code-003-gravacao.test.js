// CODE-001/003/007: gravação que falha não pode deixar a tela diferente do
// banco; exclusão só some da tela depois do banco confirmar; recorrência
// nova sem parcelas gravadas é desfeita (colaborador sem permissão em parcelas).
const test = require('node:test');
const assert = require('node:assert');
const { load } = require('./lib');

const FNS = ['gravarOuReverter','snapshotObj','restaurarObj','criarVenda','criarRecorrencia','salvarAlteracao','excluirRegistoNoBanco'];

function mk({ falhaVenda=false, falhaRec=false, deleteResult={ error:null, count:1 } } = {}){
  const apagados = [];
  const STATE = { sales:[{ id:'v1', valorPago:10 }], recurrences:[] };
  const supa = { from: (t) => ({ delete: () => ({ eq: async (col, id) => { apagados.push(t+':'+id); return deleteResult; } }) }) };
  const ctx = load(FNS, {
    STATE, supa, showErrorToast: () => {},
    persistVenda: async () => { if(falhaVenda) throw new Error('RLS'); },
    persistRecorrencia: async () => { if(falhaRec) throw new Error('new row violates row-level security policy for table "parcelas"'); },
  });
  return { ctx, STATE: ctx.STATE, apagados };
}

test('venda nova que falha ao gravar não fica na tela', async () => {
  const { ctx } = mk({ falhaVenda:true });
  const ok = await ctx.criarVenda({ id:'v2' });
  assert.strictEqual(ok, false);
  assert.deepStrictEqual(ctx.STATE.sales.map(s=>s.id), ['v1']);
});

test('recorrência nova com parcelas recusadas é desfeita no banco e na tela', async () => {
  const { ctx, apagados } = mk({ falhaRec:true });
  const ok = await ctx.criarRecorrencia({ id:'r1', parcelas:[] });
  assert.strictEqual(ok, false);
  assert.strictEqual(ctx.STATE.recurrences.length, 0);
  assert.ok(apagados.includes('recorrencias:r1'));
});

test('edição que falha volta os campos ao valor anterior', async () => {
  const { ctx } = mk({ falhaVenda:true });
  const v = ctx.STATE.sales[0];
  const ok = await ctx.salvarAlteracao(v, () => { v.valorPago = 999; }, () => ctx.persistVenda(v));
  assert.strictEqual(ok, false);
  assert.strictEqual(v.valorPago, 10);
});

test('exclusão recusada pelo banco (0 linhas) não some da tela', async () => {
  const { ctx } = mk({ deleteResult:{ error:null, count:0 } });
  const ok = await ctx.excluirRegistoNoBanco('vendas', 'v1');
  assert.strictEqual(ok, false);
});

test('exclusão confirmada devolve true', async () => {
  const { ctx } = mk();
  assert.strictEqual(await ctx.excluirRegistoNoBanco('vendas', 'v1'), true);
});
