// FIN-013: venda/recorrência por outro valor que o do catálogo. Regra
// (15/10/2026): o valor digitado já inclui o IVA; a taxa administrativa do
// catálogo sai primeiro e o resto é honorário base + IVA, IVA = 23% da base.
const test = require('node:test');
const assert = require('node:assert');
const { load, HTML } = require('./lib');

assert.match(HTML, /const TAXA_IVA = 0\.23;/); // a taxa usada pelo painel
const ctx = load(['componentesParaTotal','componentesServicoParaTotal','htmlComponentesServico','componentesFinanceirosConferem'],
  { fmtEUR: n => '€' + (Number(n)||0).toFixed(2), TAXA_IVA: 0.23 });
const cautelar = { nome:'AÇÃO CAUTELAR', honorarioBase:500, iva:115, txAdm:0, honorarioFinal:615 };
const art61 = { nome:'POR TEMPO RESIDÊNCIA ART 6.1', honorarioBase:500, iva:115, txAdm:250, honorarioFinal:865 };
const isento = { nome:'ISENTO', honorarioBase:100, iva:0, txAdm:0, honorarioFinal:100 };

const confere = (c, total) => ctx.componentesFinanceirosConferem(total, c.honorarioBase, c.iva, c.txAdm);

test('valor do catálogo continua igual (615 = 500 + 115)', () => {
  const c = ctx.componentesServicoParaTotal(cautelar, 615);
  assert.strictEqual(c.iva, 115);
  assert.strictEqual(c.honorarioBase, 500);
  assert.strictEqual(c.txAdm, 0);
});

test('vendido por 300: base 243,90 e IVA 56,10 (23% da base), somando 300', () => {
  const c = ctx.componentesServicoParaTotal(cautelar, 300);
  assert.strictEqual(c.iva, 56.1);
  assert.ok(Math.abs(c.honorarioBase - 243.9) < 1e-9);
  assert.ok(Math.abs(c.iva - c.honorarioBase*0.23) < 0.01);
  assert.ok(confere(c, 300));
});

test('taxa administrativa do catálogo se mantém; o resto vira base + IVA', () => {
  const c = ctx.componentesServicoParaTotal(art61, 700);
  assert.strictEqual(c.txAdm, 250);
  assert.ok(Math.abs(c.honorarioBase - 365.85) < 0.005); // 450 ÷ 1,23
  assert.strictEqual(c.iva, 84.15);
  assert.ok(confere(c, 700));
});

test('valor menor que a taxa: taxa limitada ao valor, sem base nem IVA', () => {
  const c = ctx.componentesServicoParaTotal(art61, 200);
  assert.deepStrictEqual([c.txAdm, c.honorarioBase, c.iva], [200, 0, 0]);
});

test('serviço isento de IVA no catálogo continua sem IVA', () => {
  const c = ctx.componentesServicoParaTotal(isento, 80);
  assert.deepStrictEqual([c.honorarioBase, c.iva, c.txAdm], [80, 0, 0]);
});

test('serviço fora do catálogo: sem detalhamento de imposto (como antes)', () => {
  const c = ctx.componentesServicoParaTotal(null, 150);
  assert.deepStrictEqual([c.honorarioBase, c.iva, c.txAdm], [150, 0, 0]);
});

test('soma sempre bate com o valor, inclusive com cêntimos e 4 casas', () => {
  for(const v of [0.01, 69.99, 70, 349.9965, 750.0048, 1234.56, 2112.6]){
    const c = ctx.componentesServicoParaTotal(art61, v);
    assert.ok(Math.abs(c.honorarioBase + c.iva + c.txAdm - v) < 1e-9, 'valor ' + v);
  }
});

test('prévia mostra os valores calculados e avisa quando difere do catálogo', () => {
  const html = ctx.htmlComponentesServico(ctx.componentesServicoParaTotal(cautelar, 300), cautelar, 300);
  assert.match(html, /Honorário base: <strong>€243\.90<\/strong>/);
  assert.match(html, /IVA \(23%\): €56\.10/);
  assert.match(html, /valor do catálogo: €615\.00/);
  const igual = ctx.htmlComponentesServico(ctx.componentesServicoParaTotal(cautelar, 615), cautelar, '615.00');
  assert.doesNotMatch(igual, /valor do catálogo/);
});

// Modais de edição: campos simulados (value + listeners), sem navegador.
function modalEdicao(servico, inicial){
  const campos = {};
  for(const [id, v] of Object.entries(inicial)){
    campos[id] = { value: String(v), innerHTML:'', textContent:'', on:{}, addEventListener(t, f){ (this.on[t] ||= []).push(f); } };
  }
  const fire = (id, t, v) => { if(v !== undefined) campos[id].value = String(v); (campos[id].on[t]||[]).forEach(f=>f()); };
  const c = load(['componentesParaTotal','htmlComponentesServico','ligarComponentesEdicao','arred4'], {
    TAXA_IVA:0.23, fmtEUR: n => '€' + (Number(n)||0).toFixed(2),
    serviceByName: nome => (servico && nome === servico.nome ? servico : null),
    document: { getElementById: id => campos[id] },
  });
  c.ligarComponentesEdicao({ servico:'s', valor:'v', base:'b', iva:'i', tx:'t', prev:'p' }, inicial.i);
  return { campos, fire, soma: () => Number(campos.b.value) + Number(campos.i.value) + Number(campos.t.value) };
}

test('edição: abrir e não mexer não altera nada', () => {
  const m = modalEdicao(art61, { s:art61.nome, v:865, b:500, i:115, t:250, p:'' });
  assert.deepStrictEqual([m.campos.b.value, m.campos.i.value, m.campos.t.value], ['500','115','250']);
});

test('edição: mudar o valor recalcula base e IVA mantendo a taxa', () => {
  const m = modalEdicao(art61, { s:art61.nome, v:865, b:500, i:115, t:250, p:'' });
  m.fire('v', 'input', 700);
  assert.strictEqual(m.campos.t.value, '250');
  assert.strictEqual(Number(m.campos.i.value), 84.15);
  assert.ok(Math.abs(m.soma() - 700) < 0.02);
});

test('edição: valor menor que a taxa ajusta a taxa ao sair do campo e o total confere', () => {
  const m = modalEdicao(art61, { s:art61.nome, v:865, b:500, i:115, t:250, p:'' });
  m.fire('v', 'input', 200);
  m.fire('v', 'change');
  assert.strictEqual(Number(m.campos.t.value), 200);
  assert.ok(Math.abs(m.soma() - 200) < 0.02);
});

test('edição: escolher o serviço preenche valor e taxa do catálogo', () => {
  const m = modalEdicao(art61, { s:'outro', v:100, b:100, i:0, t:0, p:'' });
  m.fire('s', 'input', art61.nome);
  assert.deepStrictEqual([String(m.campos.v.value), String(m.campos.t.value)], ['865.00', '250']); // no navegador value vira texto
  assert.ok(Math.abs(m.soma() - 865) < 0.02);
});
