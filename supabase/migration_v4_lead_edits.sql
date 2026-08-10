-- ============================================================
-- Pablo Mendes Advocacia — Controlo Geral (CRM)
-- Migração v4: acesso partilhado à chave "crm:leadEdits"
--
-- O QUE ISTO ADICIONA:
--   A aba nova "Controle de Campanhas" deixa qualquer utilizador
--   autenticado (gestor OU colaborador) editar 4 campos de cada lead
--   (status, qualidade, tipo de consultoria, serviço fechado) — essas
--   edições ficam guardadas na chave "crm:leadEdits", partilhada entre
--   todos (não é por vendedor, como sales/recurrences).
--
--   Sem esta migração, um colaborador consegue LER essa chave (já
--   cai na política de leitura partilhada da v2), mas não consegue
--   GRAVAR (a v2 só dava escrita total ao gestor) — ao tentar editar
--   um campo, ele recebia erro de permissão.
--
-- COMO EXECUTAR: cole este ficheiro no SQL Editor do Supabase e
-- clique em Run. Seguro rodar mais de uma vez.
-- ============================================================

-- A leitura de "crm:leadEdits" já está coberta pela política de leitura
-- partilhada da v2 (que inclui 'crm:sellers','crm:services','crm:meta') —
-- só falta incluir esta chave nova nela.
drop policy if exists "app_state: leitura partilhada autenticada" on app_state;
create policy "app_state: leitura partilhada autenticada" on app_state
  for select
  using (
    key in ('crm:sellers', 'crm:services', 'crm:meta', 'crm:leadEdits')
  );

-- Escrita de "crm:leadEdits": qualquer autenticado (gestor ou colaborador).
create policy "app_state: leadEdits editavel por qualquer autenticado" on app_state
  for all
  using ( key = 'crm:leadEdits' )
  with check ( key = 'crm:leadEdits' );
