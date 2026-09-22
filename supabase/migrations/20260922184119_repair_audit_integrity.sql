-- Corrige inconsistências confirmadas na auditoria de 2026-09-22 e reduz
-- a superfície pública do Data API. A migração é idempotente para os dados.

-- Parcelas importadas como pagas com valor 0 devem usar o valor contratual
-- padrão. NULL é a representação já entendida pelo painel para esse caso.
update public.parcelas
set valor = null
where pago is true
  and coalesce(valor, 0) <= 0;

-- Cinco lançamentos com desconto mantiveram a composição do preço cheio.
-- Reescala honorário e IVA para que a composição volte a fechar com o total.
with alvos as (
  select id, valor_total total,
         honorario_base + iva + coalesce(tx_adm, 0) componentes
  from public.vendas
  where id in ('vda-1787047606826', 'vda-1789511240724')
)
update public.vendas v
set honorario_base = round(v.honorario_base * a.total / a.componentes, 4),
    iva = round(v.iva * a.total / a.componentes, 4),
    tx_adm = round(coalesce(v.tx_adm, 0) * a.total / a.componentes, 4),
    updated_at = now()
from alvos a
where v.id = a.id
  and a.componentes > 0
  and abs(v.valor_total - a.componentes) > 0.02;

with alvos as (
  select id, valor_contrato total,
         honorario_base + iva + coalesce(tx_adm, 0) componentes
  from public.recorrencias
  where id in ('rec-1789633252881', 'rec-1789633330963', 'rec-1789633382513')
)
update public.recorrencias r
set honorario_base = round(r.honorario_base * a.total / a.componentes, 4),
    iva = round(r.iva * a.total / a.componentes, 4),
    tx_adm = round(coalesce(r.tx_adm, 0) * a.total / a.componentes, 4),
    updated_at = now()
from alvos a
where r.id = a.id
  and a.componentes > 0
  and abs(r.valor_contrato - a.componentes) > 0.02;

-- O CRM é privado: nenhuma política deve aplicar ao papel anon/public.
do $$
declare
  policy_row record;
begin
  for policy_row in
    select tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and tablename in (
        'app_state', 'profiles', 'vendas', 'recorrencias',
        'parcelas', 'pagamentos_extras'
      )
  loop
    execute format(
      'alter policy %I on public.%I to authenticated',
      policy_row.policyname,
      policy_row.tablename
    );
  end loop;
end
$$;

revoke all on table public.app_state from anon, authenticated;
revoke all on table public.profiles from anon, authenticated;
revoke all on table public.vendas from anon, authenticated;
revoke all on table public.recorrencias from anon, authenticated;
revoke all on table public.parcelas from anon, authenticated;
revoke all on table public.pagamentos_extras from anon, authenticated;

grant select, insert, update, delete on table public.app_state to authenticated;
grant select, insert, update, delete on table public.profiles to authenticated;
grant select, insert, update, delete on table public.vendas to authenticated;
grant select, insert, update, delete on table public.recorrencias to authenticated;
grant select, insert, update, delete on table public.parcelas to authenticated;
grant select, insert, update, delete on table public.pagamentos_extras to authenticated;

-- SECURITY DEFINER não deve ser chamável anonimamente. As duas funções de
-- autorização continuam disponíveis apenas para sessões autenticadas.
revoke execute on function public.is_gestor() from public, anon;
revoke execute on function public.my_seller_id() from public, anon;
grant execute on function public.is_gestor() to authenticated;
grant execute on function public.my_seller_id() to authenticated;

alter function public.is_gestor() set search_path = pg_catalog, public;
alter function public.my_seller_id() set search_path = pg_catalog, public;

revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
revoke execute on function public.enforce_self_signup_pending() from public, anon, authenticated;
revoke execute on function public.safe_numeric(text) from public, anon, authenticated;

alter function public.rls_auto_enable() set search_path = pg_catalog, public;

-- Evita que objetos futuros voltem a nascer expostos automaticamente.
alter default privileges for role postgres in schema public
  revoke all on tables from anon, authenticated;
alter default privileges for role postgres in schema public
  revoke execute on functions from public, anon, authenticated;

-- Regras mínimas de integridade para novos lançamentos.
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'vendas_valores_validos') then
    alter table public.vendas add constraint vendas_valores_validos
      check (valor_total >= 0 and valor_pago >= 0
             and valor_pago <= valor_total + 0.01);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'recorrencias_valores_validos') then
    alter table public.recorrencias add constraint recorrencias_valores_validos
      check (valor_contrato >= 0 and valor_entrada >= 0
             and valor_entrada <= valor_contrato and n_parcelas >= 1);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'parcelas_valores_validos') then
    alter table public.parcelas add constraint parcelas_valores_validos
      check (valor is null or valor > 0);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'pagamentos_extras_valor_positivo') then
    alter table public.pagamentos_extras add constraint pagamentos_extras_valor_positivo
      check (valor > 0);
  end if;
end
$$;
