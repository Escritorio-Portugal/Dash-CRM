// FIN-006/007/008: conversão sem espelhos e sem denominador inventado;
// subcards de "Valor vendido" somam o card.
const test = require('node:test');
const assert = require('node:assert');
const { load } = require('./lib');

const FNS = ['toLocalISODate','todayISO','daysInMonth','periodRange','inPeriodOrAll','sumFunilDiario','activeSellers','sellerById',
  'recStatus','valorEfetivoParcela','ivaProporcionalRecorrencia','taxaComissao','saleStatus','buildEvents','computeGlobalForPeriod',
  'computeVendasBreakdown','computeSellerStats'];

function mk({ funilAgosto = true } = {}){
  const sellers = [{ id:'a', nome:'A', ativo:true, conversasIniciadas:101, fechamentosManual:40,
    funilDiario: funilAgosto ? { '2026-08-05': { conversas:10 } } : {} }];
  const rec = { id:'r1', dataVenda:'2026-05-10', vendedorId:'a', cliente:'C', valorContrato:1000, valorEntrada:500, nParcelas:1, parcelas:[{numero:1,pago:false}], pagamentosExtras:[] };
  const sales = [
    { id:'s1', data:'2026-05-10', vendedorId:'a', cliente:'C', valorTotal:1000, valorPago:500, pagamentoIntegral:false, jaContabilizadoViaRecorrencia:true },
    { id:'s2', data:'2026-05-11', vendedorId:'a', cliente:'D', valorTotal:300, valorPago:300, pagamentoIntegral:true },
    { id:'s3', data:'2026-05-12', vendedorId:'a', cliente:'E', valorTotal:200, valorPago:100, pagamentoIntegral:false },
    { id:'s4', data:'2026-08-12', vendedorId:'a', cliente:'F', valorTotal:350, valorPago:350, pagamentoIntegral:true },
  ];
  return load(FNS, { STATE:{ sellers, sales, recurrences:[rec], meta:{} } });
}
const mes = m => ({ granularity:'month', anchor:m });

test('venda espelho + recorrência contam como 1 fechamento', () => {
  const g = mk().computeGlobalForPeriod(mes('2026-05'));
  assert.strictEqual(g.fechamentos, 3); // s2, s3, r1 (s1 é espelho de r1)
});

test('mês sem funil preenchido não usa o total antigo de conversas', () => {
  const g = mk().computeGlobalForPeriod(mes('2026-05'));
  assert.strictEqual(g.conversas, 0);
  assert.strictEqual(g.taxaConversao, null);
});

test('mês com funil usa só as conversas do período', () => {
  const g = mk().computeGlobalForPeriod(mes('2026-08'));
  assert.strictEqual(g.conversas, 10);
  assert.strictEqual(g.taxaConversao, 0.1);
});

test('perfil do vendedor num mês sem funil não usa totais estáticos', () => {
  const ctx = mk({ funilAgosto:false });
  const st = ctx.computeSellerStats('a', mes('2026-05'));
  assert.strictEqual(st.taxaConversao, null);
});

test('subcards somam o card "Valor vendido"', () => {
  const ctx = mk();
  const f = mes('2026-05');
  const g = ctx.computeGlobalForPeriod(f), b = ctx.computeVendasBreakdown(f, null);
  assert.strictEqual(b.valorIntegrais + b.valorRecorrencias, g.valorVendido);
});
