-- ============================================================
-- Pablo Mendes Advocacia — Controlo Geral (CRM)
-- Schema do Supabase
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
-- ============================================================

create table if not exists app_state (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

alter table app_state enable row level security;

-- ------------------------------------------------------------
-- ATENÇÃO — políticas permissivas
--
-- As políticas abaixo permitem que QUALQUER pessoa com a chave
-- publishable (anon key) do projeto leia e escreva nesta tabela.
-- Isso é aceitável para uso interno entre pessoas de confiança,
-- mas não deve ser considerado seguro para uso público, já que
-- o painel não tem autenticação de servidor (Supabase Auth) —
-- os "logins" de gestor/colaborador são apenas uma camada de
-- interface, não uma verificação no banco de dados.
--
-- Para uma proteção real, o próximo passo é adotar Supabase Auth
-- e reescrever estas políticas para checar auth.uid() por linha.
-- ------------------------------------------------------------

create policy "allow anon read" on app_state
  for select using (true);

create policy "allow anon write" on app_state
  for insert with check (true);

create policy "allow anon update" on app_state
  for update using (true) with check (true);

create policy "allow anon delete" on app_state
  for delete using (true);
