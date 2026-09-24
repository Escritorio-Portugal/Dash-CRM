# Auditoria Dash CRM — estado

Protocolo: `../../../CLAUDE_CODEX_AUTONOMOUS_AUDIT.md`
Contexto herdado: `../../../Dash-CRM-contexto-handoff-2026-09-24.md` (auditoria parcial de 22/09, agosto/2026)

```text
Audit start SHA: 399514d7f64107c22e0ced968dc4226ec6019b06
Branch: main
Repository: https://github.com/Escritorio-Portugal/Dash-CRM
Detected stack: HTML/CSS/JS estático num único index.html (5604 linhas), supabase-js no browser
Package manager: nenhum (sem package.json)
Frontend: index.html
Backend: Supabase (PostgREST + RLS) + Edge Function supabase/functions/create-user
Database: Supabase Postgres, projeto wtanyagjmgjedszivsfu
  Tabelas relacionais: vendas, recorrencias, parcelas, pagamentos_extras, profiles
  JSON em app_state: crm:costs, crm:funil:<vendedor>, outros
Auth: Supabase Auth (gestor / colaborador), RLS por utilizador
Hosting: Vercel, estático (vercel.json: cleanUrls)
Local URL: nenhuma documentada (servível como ficheiro estático)
Staging URL: nenhuma. Produção e banco são únicos: tudo é READ-ONLY.
Production URL: https://dash-crm-gray.vercel.app/
Browser MCP: Playwright configurado no projeto raiz, NÃO carregado nesta sessão
Codex plugin: codex-cli 0.142.3 instalado
Current phase: BOOTSTRAP concluído / DISCOVERY pendente
Production touched? NO
```

## Verificações de 24/09/2026

- `index.html` servido em produção é **byte-idêntico** ao `main@399514d`
  (Last-Modified 22/09/2026 19:08 GMT). Produção = main.
- `gh` autenticado como `Escritorio-Portugal` (scopes repo, read:org).

## Known limitations / bloqueios

1. Conector Supabase autenticado noutra conta (só vê "Data Base - Kronos");
   `execute_sql` no projeto wtanyagjmgjedszivsfu → `-32600 permission`.
2. Conector Vercel autenticado noutra equipa (Flowks); projeto do Dash não visível.
3. Playwright MCP não disponível nesta sessão; e o modo padrão abre um browser
   limpo, sem a sessão do perfil Chrome "Escritório TI".
4. Commit 781f231 adicionou `supabase/migrations/20260922184119_repair_audit_integrity.sql`
   com UPDATEs em dados de produção (parcelas pagas com valor<=0 → NULL; reescala
   honorário/IVA de 2 vendas e 3 recorrências) e mudanças de GRANT/RLS.
   **Não se sabe se foi aplicada.** Verificar no banco antes de reconciliar números.
