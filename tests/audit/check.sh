#!/usr/bin/env bash
# Verificação completa: sintaxe do <script> do index.html + testes de regressão.
# Uso: bash tests/audit/check.sh
set -eo pipefail
cd "$(dirname "$0")/../.."
node -e '
const h=require("fs").readFileSync("index.html","utf8");
const blocos=[...h.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m=>m[1]);
blocos.forEach((b,i)=>new (require("vm").Script)(b,{filename:"index.html#script"+i}));
console.log("sintaxe OK ("+blocos.length+" bloco(s) <script>)");'
node --test tests/audit/*.test.js 2>&1 | grep -E "^(✔|✖|ℹ (pass|fail))"
