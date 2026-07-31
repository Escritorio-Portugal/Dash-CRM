-- ============================================================
-- Pablo Mendes Advocacia — Controlo Geral (CRM)
-- Migração de segurança v2: Supabase Auth real + RLS por utilizador
--
-- O QUE ISTO MUDA:
--   Antes: qualquer pessoa com a chave publishable (anon key) do
--          projeto conseguia ler E escrever em toda a tabela
--          app_state, sem login nenhum. As "senhas" de gestor/
--          colaborador eram só uma camada de interface (e a do
--          gestor estava em texto simples no próprio código-fonte).
--   Depois desta migração: SEM UMA SESSÃO AUTENTICADA (Supabase
--          Auth, login com e-mail/senha verificado no servidor),
--          NINGUÉM consegue ler nem escrever nada — nem com a
--          chave publishable. E, autenticado, um colaborador só
--          consegue ler/escrever as SUAS PRÓPRIAS vendas e
--          recorrências (chaves "crm:sales:<sellerId>" e
--          "crm:recurrences:<sellerId>" e "crm:funil:<sellerId>"
--          onde <sellerId> é o dele); o gestor continua com acesso
--          total a tudo.
--
-- COMO EXECUTAR:
--   1. Abra o SQL Editor do teu projeto Supabase.
--   2. Cole este ficheiro inteiro e clique em "Run".
--   3. Depois, cria as contas de login (ver docs/SECURITY_MIGRATION.md
--      para o passo a passo) e insere uma linha em "profiles" para
--      cada uma (também documentado nesse ficheiro).
--
-- Este script é seguro para rodar mais de uma vez (idempotente):
-- todas as criações usam "if not exists" ou "or replace", e as
-- políticas antigas e permissivas são removidas antes de recriar.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Tabela de perfis: liga cada conta de login (auth.users) a um
--    papel (gestor/colaborador) e, se for colaborador, ao id do
--    vendedor correspondente na tabela app_state (crm:sellers).
-- ------------------------------------------------------------
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('gestor','colaborador')),
  seller_id text,                     -- obrigatório se role='colaborador'; null se role='gestor'
  nome text,                          -- só para facilitar identificação no dashboard do Supabase
  created_at timestamptz not null default now()
);

alter table profiles enable row level security;

drop policy if exists "profiles: le o proprio perfil" on profiles;
create policy "profiles: le o proprio perfil" on profiles
  for select using (auth.uid() = id);

-- Nenhuma política de insert/update/delete é criada aqui de propósito:
-- as linhas de "profiles" só devem ser criadas/editadas por ti, a partir
-- do SQL Editor do Supabase (com a tua sessão de dono do projeto, que
-- tem sempre acesso total independente de RLS), nunca pelo próprio painel.

-- ------------------------------------------------------------
-- 2. Funções auxiliares (security definer) para evitar recursão de
--    RLS ao consultar "profiles" de dentro de uma política de "profiles"
--    ou de "app_state".
-- ------------------------------------------------------------
create or replace function is_gestor()
returns boolean
language sql
security definer
stable
as $$
  select exists(
    select 1 from profiles where id = auth.uid() and role = 'gestor'
  );
$$;

create or replace function my_seller_id()
returns text
language sql
security definer
stable
as $$
  select seller_id from profiles where id = auth.uid();
$$;

-- ------------------------------------------------------------
-- 3. Remove as políticas antigas e permissivas de app_state
--    (qualquer nome que a v1 tenha usado).
-- ------------------------------------------------------------
drop policy if exists "allow anon read" on app_state;
drop policy if exists "allow anon write" on app_state;
drop policy if exists "allow anon update" on app_state;
drop policy if exists "allow anon delete" on app_state;

alter table app_state enable row level security;

-- ------------------------------------------------------------
-- 4. Novas políticas de app_state.
--
--    Convenção de chaves usada pelo painel a partir desta versão:
--      crm:sellers                    -> lista partilhada de vendedores (sem dados pessoais sensíveis)
--      crm:services                   -> catálogo de serviços (partilhado)
--      crm:costs                      -> custos fixos/variáveis (só gestor)
--      crm:meta                       -> configurações gerais (meta, comissão, migrações)
--      crm:sales:<sellerId>           -> vendas avulsas DESSE vendedor
--      crm:recurrences:<sellerId>     -> recorrências DESSE vendedor
--      crm:funil:<sellerId>           -> funil diário DESSE vendedor
--
--    Sem NENHUMA política correspondente = acesso negado por
--    omissão (é assim que o RLS do Postgres funciona: sem "match",
--    nega). Por isso não existe mais "anon" com acesso a nada.
-- ------------------------------------------------------------

-- Gestor: acesso total, sempre.
create policy "app_state: gestor acesso total" on app_state
  for all
  using ( is_gestor() )
  with check ( is_gestor() );

-- Qualquer utilizador autenticado (gestor ou colaborador): pode LER
-- as chaves partilhadas (lista de vendedores, catálogo de serviços,
-- configurações gerais). Nunca pode escrever nelas por esta política
-- (só o gestor, pela política acima).
create policy "app_state: leitura partilhada autenticada" on app_state
  for select
  using (
    key in ('crm:sellers', 'crm:services', 'crm:meta')
  );

-- Colaborador: leitura e escrita das SUAS PRÓPRIAS vendas.
create policy "app_state: colaborador le/escreve as proprias vendas" on app_state
  for all
  using ( key = 'crm:sales:' || coalesce(my_seller_id(), '') )
  with check ( key = 'crm:sales:' || coalesce(my_seller_id(), '') );

-- Colaborador: leitura e escrita das SUAS PRÓPRIAS recorrências.
create policy "app_state: colaborador le/escreve as proprias recorrencias" on app_state
  for all
  using ( key = 'crm:recurrences:' || coalesce(my_seller_id(), '') )
  with check ( key = 'crm:recurrences:' || coalesce(my_seller_id(), '') );

-- Colaborador: leitura e escrita do SEU PRÓPRIO funil diário.
create policy "app_state: colaborador le/escreve o proprio funil" on app_state
  for all
  using ( key = 'crm:funil:' || coalesce(my_seller_id(), '') )
  with check ( key = 'crm:funil:' || coalesce(my_seller_id(), '') );

-- Repara que "crm:costs" não tem NENHUMA política pra colaborador —
-- ou seja, colaborador não consegue ler nem escrever lá, mesmo com
-- sessão autenticada válida. Só o gestor.

-- ------------------------------------------------------------
-- 5. Migração de dados: separa as vendas/recorrências/funil que hoje
--    estão em UM blob único (crm:sales, crm:recurrences, e dentro de
--    cada vendedor em crm:sellers) em uma linha por vendedor.
--
--    Roda isto UMA VEZ, depois de confirmar que o painel novo (v2)
--    já está no ar e a ler pelas chaves novas. Ele NÃO apaga as
--    chaves antigas automaticamente — isso fica pra ti confirmar
--    manualmente depois de validar que os dados migraram certinho
--    (ver docs/SECURITY_MIGRATION.md, passo "Confirmar e limpar").
-- ------------------------------------------------------------
do $$
declare
  seller record;
  sales_blob jsonb;
  recs_blob jsonb;
  sellers_blob jsonb;
begin
  select value into sales_blob from app_state where key = 'crm:sales';
  select value into recs_blob from app_state where key = 'crm:recurrences';
  select value into sellers_blob from app_state where key = 'crm:sellers';

  if sellers_blob is null then
    raise notice 'crm:sellers não encontrado — nada para migrar ainda.';
    return;
  end if;

  for seller in select * from jsonb_array_elements(sellers_blob) as s(seller_data)
  loop
    declare
      sid text := seller.seller_data->>'id';
      seller_sales jsonb;
      seller_recs jsonb;
      seller_funil jsonb;
    begin
      select coalesce(jsonb_agg(v), '[]'::jsonb) into seller_sales
        from jsonb_array_elements(coalesce(sales_blob, '[]'::jsonb)) v
        where v->>'vendedorId' = sid;

      select coalesce(jsonb_agg(v), '[]'::jsonb) into seller_recs
        from jsonb_array_elements(coalesce(recs_blob, '[]'::jsonb)) v
        where v->>'vendedorId' = sid;

      seller_funil := coalesce(seller.seller_data->'funilDiario', '{}'::jsonb);

      insert into app_state (key, value, updated_at)
      values ('crm:sales:' || sid, seller_sales, now())
      on conflict (key) do update set value = excluded.value, updated_at = now();

      insert into app_state (key, value, updated_at)
      values ('crm:recurrences:' || sid, seller_recs, now())
      on conflict (key) do update set value = excluded.value, updated_at = now();

      insert into app_state (key, value, updated_at)
      values ('crm:funil:' || sid, seller_funil, now())
      on conflict (key) do update set value = excluded.value, updated_at = now();

      raise notice 'Migrado vendedor %: % vendas, % recorrencias', sid, jsonb_array_length(seller_sales), jsonb_array_length(seller_recs);
    end;
  end loop;
end $$;
