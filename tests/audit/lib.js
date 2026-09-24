// Carrega funções reais do index.html numa sandbox para testes de regressão.
// Sem dependências: usa só node:vm. Uso: const app = load(['fnA','fnB'], { STATE, ...stubs })
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const HTML = fs.readFileSync(path.join(__dirname, '..', '..', 'index.html'), 'utf8');

function extract(name){
  const re = new RegExp('(^|\\n)[ \\t]*(async\\s+)?function\\s+' + name + '\\s*\\(');
  const m = re.exec(HTML);
  if(!m) throw new Error('função não encontrada: ' + name);
  const start = m.index + (m[1] ? m[1].length : 0);
  let i = HTML.indexOf('{', HTML.indexOf('(', start));
  // pula a lista de parâmetros (pode ter defaults com chaves)
  let depth = 0, j = HTML.indexOf('(', start);
  for(; j < HTML.length; j++){ const c = HTML[j]; if(c === '(') depth++; else if(c === ')'){ depth--; if(depth === 0) break; } }
  i = HTML.indexOf('{', j);
  return HTML.slice(start, scanBlock(i) + 1);
}

function scanBlock(i){
  // pilha: 'code' (conta chaves), '"', "'", '`'. Dentro de template, '${' empilha 'code'.
  const stack = [{ t: 'code', d: 0 }];
  let k = i;
  for(; k < HTML.length; k++){
    const c = HTML[k], top = stack[stack.length - 1];
    if(top.t === '"' || top.t === "'"){
      if(c === '\\'){ k++; continue; }
      if(c === top.t) stack.pop();
      continue;
    }
    if(top.t === '`'){
      if(c === '\\'){ k++; continue; }
      if(c === '`'){ stack.pop(); continue; }
      if(c === '$' && HTML[k+1] === '{'){ stack.push({ t: 'code', d: 1 }); k++; }
      continue;
    }
    // código
    if(c === '/' && HTML[k+1] === '/'){ k = HTML.indexOf('\n', k); continue; }
    if(c === '/' && HTML[k+1] === '*'){ k = HTML.indexOf('*/', k) + 1; continue; }
    if(c === '"' || c === "'" || c === '`'){ stack.push({ t: c }); continue; }
    if(c === '{') top.d++;
    else if(c === '}'){
      top.d--;
      if(top.d === 0){
        if(stack.length === 1) break;
        stack.pop(); // fim de ${ ... }
      }
    }
  }
  return k;
}

function extractConst(name){
  const re = new RegExp('(^|\\n)const\\s+' + name + '\\s*=\\s*');
  const m = re.exec(HTML);
  if(!m) throw new Error('const não encontrada: ' + name);
  const start = m.index + (m[1] ? m[1].length : 0);
  const open = m.index + m[0].length;
  if(HTML[open] === '{') return HTML.slice(start, scanBlock(open) + 1) + ';';
  return HTML.slice(start, HTML.indexOf(';\n', start) + 1);
}

function load(fns, globals = {}, consts = []){
  const ctx = Object.assign({ console, Date, Math, JSON, Promise, Object, Array, Number, String, Set, Map }, globals);
  vm.createContext(ctx);
  const src = consts.map(extractConst).join('\n') + '\n' + fns.map(extract).join('\n\n');
  // expõe as funções declaradas no contexto
  vm.runInContext(src + '\n' + fns.map(f => `globalThis.${f} = ${f};`).join('\n'), ctx);
  return ctx;
}

module.exports = { load, extract, extractConst, HTML };
