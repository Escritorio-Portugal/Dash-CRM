// FIN-012: "Recorrências atrasadas" mostrava contratos já quitados (pagos por
// entrada/pagamento personalizado sem marcar a parcela) e, num mês passado,
// contratos pagos depois, com pendente €0 e sem pagamento possível.
// Regra (06/10/2026): só entra o que está em atraso HOJE (parcela vencida,
// não paga, saldo > 0); com um mês selecionado, entram as parcelas que
// venceram até o fim desse mês e continuam sem pagamento.
const test = require('node:test');
const assert = require('node:assert');
const { load } = require('./lib');

const HOJE = '2026-10-06';
const FNS = ['toLocalISODate','daysInMonth','periodRange','recStatus','valorEfetivoParcela','vencimentoParcela','parcelasEmAtraso','recorrenciasAtrasadas'];
function rec(id, dataVenda, extra){
  return Object.assign({ id, cliente:id, dataVenda, valorContrato:750, valorEntrada:375, txAdm:0, isentoTaxaAdm:false, nParcelas:1,
    parcelas:[{numero:1,pago:false,data:null,valor:null}], pagamentosExtras:[] }, extra);
}
function ctx(recurrences){ return load(FNS, { STATE:{ recurrences }, todayISO: ()=>HOJE }); }
const ids = (c, f) => c.recorrenciasAtrasadas(f).map(r=>r.id).sort();
const mes = m => ({ granularity:'month', anchor:m+'-01' });

test('quitada por pagamento personalizado (parcela não marcada) não é atrasada', () => {
  const c = ctx([rec('thais', '2026-06-20', { pagamentosExtras:[{data:'2026-08-24', valor:375}] })]);
  assert.deepStrictEqual(ids(c, {granularity:'all'}), []);
  assert.deepStrictEqual(ids(c, mes('2026-07')), []); // venceu em julho, mas já está paga
});

test('isento de taxa adm e quitado por extras não é atrasado', () => {
  const c = ctx([rec('anderson', '2026-06-09', { valorContrato:2112.6, valorEntrada:750, txAdm:612, isentoTaxaAdm:true,
    pagamentosExtras:[{data:'2026-08-03', valor:750},{data:'2026-08-03', valor:0.6}] })]);
  assert.deepStrictEqual(ids(c, {granularity:'all'}), []);
});

test('paga depois do mês não aparece mais naquele mês (sem pendente €0)', () => {
  const c = ctx([rec('paga', '2026-07-15', { parcelas:[{numero:1,pago:true,data:'2026-09-03',valor:375}] })]);
  assert.deepStrictEqual(ids(c, mes('2026-08')), []);
});

test('saldo pequeno real continua atrasado', () => {
  const c = ctx([rec('basim', '2026-08-26', { valorEntrada:725, nParcelas:2, parcelas:[{numero:1,pago:false},{numero:2,pago:false}] })]);
  assert.deepStrictEqual(ids(c, {granularity:'all'}), ['basim']);
  assert.deepStrictEqual(ids(c, mes('2026-09')), ['basim']); // parcela 1 venceu 26/09
  assert.deepStrictEqual(ids(c, mes('2026-08')), []);        // nada tinha vencido até agosto
});

test('filtro por mês: parcelas que venceram até o fim do mês e seguem sem pagamento', () => {
  const c = ctx([
    rec('jun', '2026-05-12'),   // vence 12/06
    rec('ago', '2026-07-21'),   // vence 21/08
    rec('ago31', '2026-07-31'), // vence 31/08
    rec('set', '2026-08-18'),   // vence 18/09
    rec('naoVenceu', '2026-09-29'), // vence 29/10
  ]);
  assert.deepStrictEqual(ids(c, {granularity:'all'}), ['ago','ago31','jun','set']);
  assert.deepStrictEqual(ids(c, mes('2026-05')), []);
  assert.deepStrictEqual(ids(c, mes('2026-06')), ['jun']);
  assert.deepStrictEqual(ids(c, mes('2026-08')), ['ago','ago31','jun']);
  assert.deepStrictEqual(ids(c, mes('2026-09')), ['ago','ago31','jun','set']);
  assert.deepStrictEqual(ids(c, mes('2026-10')), ['ago','ago31','jun','set']);
});

test('agosto com casos reais: pagos depois e quitados por extras saem; só ficam os em aberto', () => {
  const pagaEmSetembro = (id, venda, entrada, valor, data) => rec(id, venda, { valorEntrada:entrada, parcelas:[{numero:1,pago:true,data,valor}] });
  const c = ctx([
    pagaEmSetembro('LEIA', '2026-05-26', 375, 375, '2026-09-06'),
    pagaEmSetembro('RAVENA', '2026-07-15', 500, 250, '2026-09-03'),
    pagaEmSetembro('SIDE', '2026-05-27', 375, 375, '2026-10-02'),
    rec('ELIZAMA', '2026-05-20', { valorContrato:599.9952, valorEntrada:300, pagamentosExtras:[{data:'2026-08-25', valor:300}] }),
    rec('ADILSON', '2026-05-12', { valorContrato:249.9975, valorEntrada:125 }),
    rec('CRISTOVAO', '2026-05-04', { valorContrato:350, valorEntrada:100, nParcelas:2, parcelas:[{numero:1,pago:true,data:'2026-08-30',valor:200},{numero:2,pago:false}] }),
  ]);
  assert.deepStrictEqual(ids(c, mes('2026-08')), ['ADILSON','CRISTOVAO']);
});

test('contrato com 2 parcelas atrasadas aparece nos dois meses e ordena pela mais antiga', () => {
  const c = ctx([
    rec('duas', '2026-05-08', { valorContrato:1111, valorEntrada:625, nParcelas:2, parcelas:[{numero:1,pago:false},{numero:2,pago:false}] }),
    rec('nova', '2026-08-18'),
  ]);
  assert.deepStrictEqual(ids(c, mes('2026-06')), ['duas']);
  assert.deepStrictEqual(ids(c, mes('2026-07')), ['duas']);
  assert.deepStrictEqual(c.recorrenciasAtrasadas({granularity:'all'}).map(r=>r.id), ['duas','nova']);
  assert.strictEqual(c.parcelasEmAtraso(c.STATE.recurrences[0], HOJE)[0].dias, 120); // 08/06 → 06/10
});

test('dias e parcela exibida vêm da parcela NÃO paga (paga com data futura não conta)', () => {
  const c = ctx([rec('futura', '2026-06-01', { valorContrato:900, valorEntrada:300, nParcelas:2,
    parcelas:[{numero:1,pago:true,data:'2026-10-07',valor:300},{numero:2,pago:false}] })]);
  const v = c.parcelasEmAtraso(c.STATE.recurrences[0], HOJE)[0];
  assert.strictEqual(v.numero, 2);  // venceu 01/08
  assert.strictEqual(v.dias, 66);   // e não 97, contados da parcela 1
});

test('parcela paga sem data conta como paga; sem data de venda não há vencimento', () => {
  const c = ctx([
    rec('pagaSemData', '2026-05-12', { parcelas:[{numero:1,pago:true,data:null,valor:375}] }),
    rec('semVenda', null),
  ]);
  assert.deepStrictEqual(ids(c, {granularity:'all'}), []);
});

test('resto de arredondamento (≤ €0,005) é quitado', () => {
  const c = ctx([rec('arred', '2026-06-20', { valorContrato:750.0048, pagamentosExtras:[{data:'2026-08-24', valor:375}] })]);
  assert.deepStrictEqual(ids(c, {granularity:'all'}), []);
});
