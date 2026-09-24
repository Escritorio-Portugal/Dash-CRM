// UI-001: taxaIva() foi removida em 781f231 mas continuou a ser chamada no
// detalhamento da comissão e na aba "Regras de comissão": o clique no card
// de comissão dava erro e o modal não abria (vendedor e gestor).
const test = require('node:test');
const assert = require('node:assert');
const { HTML, load } = require('./lib');

test('nenhuma chamada a taxaIva() sem a função existir', () => {
  const chama = /[^.\w]taxaIva\s*\(/.test(HTML.replace(/function\s+taxaIva\s*\(/g, ''));
  const define = /function\s+taxaIva\s*\(/.test(HTML);
  assert.ok(!chama || define, 'taxaIva() é chamada mas não está definida');
});

test('detalhamento da comissão abre e soma igual ao card do vendedor', () => {
  const STATE = {
    meta:{ taxaComissao:0.1 }, sellers:[{ id:'v', nome:'V' }],
    sales:[{ id:'s', vendedorId:'v', data:'2026-08-10', cliente:'A', valorTotal:350, valorPago:350, iva:65.45, pagamentoIntegral:true }],
    recurrences:[],
  };
  let html = '';
  const el = { innerHTML:'', set onclick(f){}, addEventListener(){} };
  const document = { getElementById: (id) => id==='modalRoot' ? { set innerHTML(v){ html = v; } } : el };
  const ctx = load(['toLocalISODate','todayISO','daysInMonth','periodRange','inPeriodOrAll','sellerById','taxaComissao','fmtPctFn',
    'recStatus','valorEfetivoParcela','ivaProporcionalRecorrencia','comissaoBreakdownEvents','abrirComissaoDetalhe'].filter(f=>f!=='fmtPctFn'),
    { STATE, document, closeModal(){}, fmtEUR: n => (Math.round(n*100)/100).toFixed(2), fmtPct: n => (n*100)+'%', fmtDate: d => d });
  ctx.abrirComissaoDetalhe('v', { granularity:'month', anchor:'2026-08' });
  assert.match(html, /Total comissão: <strong>28\.46<\/strong>/); // (350 − 65,45) × 10%
});
