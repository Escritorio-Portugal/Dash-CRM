-- ============================================================
-- Pablo Mendes Advocacia — Controlo Geral (CRM)
-- Schema do Supabase (base)
--
-- Este projeto usa UMA tabela chave/valor (app_state) em vez de
-- tabelas relacionais separadas por entidade. Cada "chave" guarda
-- um blob JSON (ex.: crm:sellers, crm:recurrences) que espelha
-- exatamente a estrutura em memória usada pelo painel.
--
-- Isso foi uma escolha deliberada: permite trocar a camada de
-- persistência (de window.storage para Supabase) sem reescrever a
-- lógica da aplicação, ao custo de não dar para fazer consultas SQL
-- diretas sobre os dados (eles ficam dentro de uma coluna jsonb).
-- Se no futuro for necessário gerar relatórios via SQL/BI, migrar
-- para tabelas relacionais (sellers, sales, recurrences, services,
-- costs) é o próximo passo recomendado.
--
-- IMPORTANTE: este ficheiro cria a tabela com políticas de RLS
-- permissivas (histórico, v1). Depois de rodar isto, execute SEMPRE
-- também supabase/migration_v2_auth_rls.sql — ele substitui essas
-- políticas por outras que exigem login real (Supabase Auth) e
-- restringem cada colaborador aos seus próprios dados. Ver
-- docs/SECURITY_MIGRATION.md para o passo a passo completo.
-- ============================================================

create table if not exists app_state (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

alter table app_state enable row level security;

-- ------------------------------------------------------------
-- Políticas iniciais (v1) — substituídas pela migration_v2 logo
-- a seguir. Ficam aqui só para o "create table" não deixar a
-- tabela sem nenhuma política por um instante durante o setup
-- inicial de um projeto novo.
-- ------------------------------------------------------------

create policy "allow anon read" on app_state
  for select using (true);

create policy "allow anon write" on app_state
  for insert with check (true);

create policy "allow anon update" on app_state
  for update using (true) with check (true);

create policy "allow anon delete" on app_state
  for delete using (true);
