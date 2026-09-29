-- SEGURANÇA DOS LANÇAMENTOS (2026-09-29)
-- Objetivo: nenhum lançamento some sem deixar rasto, nenhum lançamento novo entra
-- corrompido, e o gestor consegue ver e corrigir erros.
--
--  1) HISTÓRICO: toda inclusão/alteração/exclusão em vendas, recorrências, parcelas,
--     pagamentos personalizados e app_state (custos, serviços, vendedores, meta...)
--     fica gravada em auditoria.historico com o antes e o depois, quem e quando.
--  2) VALIDAÇÃO: o banco recusa lançamentos NOVOS ou ALTERADOS com erro (data fora do
--     período do escritório ou no futuro, pagamento antes da venda, parcela paga sem
--     data, valores impossíveis). Registos antigos que não forem mexidos não são
--     bloqueados (corrigem-se pelo verificador).
--  3) PROTEÇÃO CONTRA QUEDA: o app não consegue apagar vários lançamentos de uma vez,
--     esvaziar a lista de custos/serviços/vendedores, nem apagar esses blocos.
--  4) VERIFICADOR: verificar_integridade() lista os erros encontrados na base.
--  5) RESTAURAR: restaurar_exclusao() devolve um lançamento excluído (com as parcelas).
--
-- Para desfazer: ver o bloco "DESFAZER" no fim do ficheiro.

create schema if not exists auditoria;
revoke all on schema auditoria from public, anon, authenticated;

create table if not exists auditoria.historico (
  id        bigserial primary key,
  em        timestamptz not null default now(),
  usuario   uuid default auth.uid(),
  tabela    text not null,
  operacao  text not null,
  chave     text not null,
  antes     jsonb,
  depois    jsonb,
  transacao bigint not null default txid_current()
);
create index if not exists historico_em_idx on auditoria.historico (em desc);
create index if not exists historico_chave_idx on auditoria.historico (tabela, chave);
create index if not exists historico_transacao_idx on auditoria.historico (transacao);

-- ---------------------------------------------------------------- 1) HISTÓRICO
create or replace function auditoria.registrar()
returns trigger language plpgsql security definer set search_path = public, auditoria as $$
declare a jsonb; d jsonb; k text;
begin
  a := case when tg_op in ('UPDATE','DELETE') then to_jsonb(old) end;
  d := case when tg_op in ('UPDATE','INSERT') then to_jsonb(new) end;
  -- regravação sem mudança (o app regrava todas as parcelas a cada save): não regista
  if tg_op = 'UPDATE' and (a - 'updated_at') = (d - 'updated_at') then return null; end if;
  k := case tg_table_name
         when 'parcelas'  then coalesce(d, a)->>'recorrencia_id' || '#' || (coalesce(d, a)->>'numero')
         when 'app_state' then coalesce(d, a)->>'key'
         else coalesce(d, a)->>'id' end;
  insert into auditoria.historico (tabela, operacao, chave, antes, depois)
  values (tg_table_name, tg_op, k, a, d);
  return null;
end $$;

do $$ declare t text; begin
  foreach t in array array['vendas','recorrencias','parcelas','pagamentos_extras','app_state'] loop
    execute format('drop trigger if exists auditoria_%1$s on public.%1$s', t);
    execute format('create trigger auditoria_%1$s after insert or update or delete on public.%1$s for each row execute function auditoria.registrar()', t);
  end loop;
end $$;

-- ---------------------------------------------------------------- 2) VALIDAÇÃO
-- Início do período de lançamentos do escritório. Datas antes disto são quase
-- sempre erro de digitação do ano (ex.: 2025 em vez de 2026).
create or replace function public.dash_inicio_lancamentos() returns date
language sql immutable as $$ select date '2026-01-01' $$;

create or replace function public.dash_restaurando() returns boolean
language sql stable as $$ select coalesce(current_setting('dash.restaurando', true), '') = '1' $$;

create or replace function public.validar_data_lancamento(d date, rotulo text) returns void
language plpgsql stable as $$
begin
  if d is null then raise exception '% é obrigatória.', rotulo using errcode = '22023'; end if;
  if d < public.dash_inicio_lancamentos() then
    raise exception '% (%) é anterior a %: confira o ano.', rotulo, to_char(d,'DD/MM/YYYY'), to_char(public.dash_inicio_lancamentos(),'DD/MM/YYYY') using errcode = '22023';
  end if;
  if d > current_date + 1 then
    raise exception '% (%) está no futuro.', rotulo, to_char(d,'DD/MM/YYYY') using errcode = '22023';
  end if;
end $$;

create or replace function public.validar_venda()
returns trigger language plpgsql set search_path = public as $$
begin
  if public.dash_restaurando() then return new; end if;
  new.cliente := btrim(regexp_replace(coalesce(new.cliente,''), '\s+', ' ', 'g'));
  if new.cliente = '' then raise exception 'Informe o nome do cliente.' using errcode = '22023'; end if;
  if tg_op = 'INSERT' or new.data is distinct from old.data then
    perform public.validar_data_lancamento(new.data, 'A data da venda');
  end if;
  if tg_op = 'INSERT' or new.valor_total is distinct from old.valor_total or new.valor_pago is distinct from old.valor_pago then
    if coalesce(new.valor_total,0) <= 0 then raise exception 'O valor total da venda tem de ser maior que zero.' using errcode = '22023'; end if;
    if coalesce(new.valor_pago,0) < 0 or coalesce(new.valor_pago,0) > new.valor_total + 0.01 then
      raise exception 'O valor recebido (%) não pode ser maior que o total (%).', new.valor_pago, new.valor_total using errcode = '22023';
    end if;
  end if;
  return new;
end $$;

create or replace function public.validar_recorrencia()
returns trigger language plpgsql set search_path = public as $$
begin
  if public.dash_restaurando() then return new; end if;
  new.cliente := btrim(regexp_replace(coalesce(new.cliente,''), '\s+', ' ', 'g'));
  if new.cliente = '' then raise exception 'Informe o nome do cliente.' using errcode = '22023'; end if;
  if tg_op = 'INSERT' or new.data_venda is distinct from old.data_venda then
    perform public.validar_data_lancamento(new.data_venda, 'A data da venda');
    if tg_op = 'UPDATE' and exists (select 1 from public.parcelas p where p.recorrencia_id = new.id and p.pago and p.data < new.data_venda) then
      raise exception 'Há parcelas desta recorrência pagas antes de %: corrija a data da venda ou das parcelas.', to_char(new.data_venda,'DD/MM/YYYY') using errcode = '22023';
    end if;
  end if;
  if (tg_op = 'INSERT' or new.valor_contrato is distinct from old.valor_contrato) and coalesce(new.valor_contrato,0) <= 0 then
    raise exception 'O valor do contrato tem de ser maior que zero.' using errcode = '22023';
  end if;
  return new;
end $$;

create or replace function public.validar_parcela()
returns trigger language plpgsql set search_path = public as $$
declare dv date;
begin
  if public.dash_restaurando() then return new; end if;
  if not new.pago then new.data := null; new.valor := null; return new; end if;
  if tg_op = 'INSERT' or new.pago is distinct from old.pago or new.data is distinct from old.data then
    if new.data is null then raise exception 'A parcela % foi marcada como paga sem data de pagamento.', new.numero using errcode = '22023'; end if;
    select data_venda into dv from public.recorrencias where id = new.recorrencia_id;
    perform public.validar_data_lancamento(new.data, 'A data de pagamento da parcela ' || new.numero);
    if dv is not null and new.data < dv then
      raise exception 'A parcela % foi paga (%) antes da venda (%).', new.numero, to_char(new.data,'DD/MM/YYYY'), to_char(dv,'DD/MM/YYYY') using errcode = '22023';
    end if;
  end if;
  return new;
end $$;

create or replace function public.validar_pagamento_extra()
returns trigger language plpgsql set search_path = public as $$
declare dv date;
begin
  if public.dash_restaurando() then return new; end if;
  if tg_op = 'INSERT' or new.data is distinct from old.data then
    perform public.validar_data_lancamento(new.data, 'A data do pagamento');
    select data_venda into dv from public.recorrencias where id = new.recorrencia_id;
    if dv is not null and new.data < dv then
      raise exception 'O pagamento (%) é anterior à venda (%).', to_char(new.data,'DD/MM/YYYY'), to_char(dv,'DD/MM/YYYY') using errcode = '22023';
    end if;
  end if;
  return new;
end $$;

drop trigger if exists validar_venda on public.vendas;
create trigger validar_venda before insert or update on public.vendas for each row execute function public.validar_venda();
drop trigger if exists validar_recorrencia on public.recorrencias;
create trigger validar_recorrencia before insert or update on public.recorrencias for each row execute function public.validar_recorrencia();
drop trigger if exists validar_parcela on public.parcelas;
create trigger validar_parcela before insert or update on public.parcelas for each row execute function public.validar_parcela();
drop trigger if exists validar_pagamento_extra on public.pagamentos_extras;
create trigger validar_pagamento_extra before insert or update on public.pagamentos_extras for each row execute function public.validar_pagamento_extra();

-- ---------------------------------------------------------------- 3) PROTEÇÃO CONTRA QUEDA
-- Blocos de configuração (custos, serviços, vendedores...): uma gravação do app não
-- pode apagar mais de 3 itens de uma vez, esvaziar a lista, nem apagar o bloco.
create or replace function public.proteger_app_state()
returns trigger language plpgsql set search_path = public as $$
declare removidos int;
begin
  if coalesce(auth.role(), '') <> 'authenticated' then return coalesce(new, old); end if;
  if tg_op = 'DELETE' then
    if old.key in ('crm:costs','crm:services','crm:sellers','crm:meta') then
      raise exception 'Proteção: o bloco % não pode ser apagado pelo painel.', old.key using errcode = '42501';
    end if;
    return old;
  end if;
  if jsonb_typeof(old.value) = 'array' and jsonb_typeof(new.value) = 'array' and jsonb_array_length(old.value) > 0 then
    if jsonb_array_length(new.value) = 0 then
      raise exception 'Proteção: esta gravação esvaziaria % (% itens). Nada foi alterado.', old.key, jsonb_array_length(old.value) using errcode = '42501';
    end if;
    select count(*) into removidos from jsonb_array_elements(old.value) o
     where o ? 'id' and not exists (select 1 from jsonb_array_elements(new.value) n where n->>'id' = o->>'id');
    if removidos > 3 then
      raise exception 'Proteção: esta gravação apagaria % itens de % de uma vez. Nada foi alterado.', removidos, old.key using errcode = '42501';
    end if;
  end if;
  if jsonb_typeof(old.value) = 'object' and old.value <> '{}'::jsonb and new.value = '{}'::jsonb and old.key = 'crm:meta' then
    raise exception 'Proteção: esta gravação apagaria a configuração (crm:meta). Nada foi alterado.' using errcode = '42501';
  end if;
  return new;
end $$;
drop trigger if exists proteger_app_state on public.app_state;
create trigger proteger_app_state before update or delete on public.app_state for each row execute function public.proteger_app_state();

-- Vendas/recorrências: o painel exclui uma de cada vez; excluir muitas numa só
-- operação é sinal de erro (ou de acesso indevido) e é recusado.
create or replace function public.proteger_exclusao_em_massa()
returns trigger language plpgsql set search_path = public as $$
declare n int;
begin
  if coalesce(auth.role(), '') <> 'authenticated' then return null; end if;
  select count(*) into n from apagadas;
  if n > 3 then
    raise exception 'Proteção: esta operação excluiria % lançamentos de % de uma vez. Nada foi excluído.', n, tg_table_name using errcode = '42501';
  end if;
  return null;
end $$;
drop trigger if exists proteger_exclusao_vendas on public.vendas;
create trigger proteger_exclusao_vendas after delete on public.vendas referencing old table as apagadas for each statement execute function public.proteger_exclusao_em_massa();
drop trigger if exists proteger_exclusao_recorrencias on public.recorrencias;
create trigger proteger_exclusao_recorrencias after delete on public.recorrencias referencing old table as apagadas for each statement execute function public.proteger_exclusao_em_massa();

-- ---------------------------------------------------------------- 4) VERIFICADOR
create or replace function public.verificar_integridade()
returns table (codigo text, gravidade text, descricao text, qtd int, itens jsonb)
language plpgsql stable security definer set search_path = public, auditoria as $$
begin
  if not public.is_gestor() then raise exception 'Só o gestor pode verificar a integridade.' using errcode = '42501'; end if;
  return query
  with svc as (select upper(btrim(e->>'nome')) nome from app_state a, jsonb_array_elements(a.value) e where a.key = 'crm:services'),
  sel as (select e->>'id' id from app_state a, jsonb_array_elements(a.value) e where a.key = 'crm:sellers'),
  custos as (select e from app_state a, jsonb_array_elements(a.value) e where a.key = 'crm:costs'),
  achados as (
    select 'LANC-01'::text c, 'crítica'::text g, 'Venda ligada a uma recorrência que não existe (não aparece em nenhum total)'::text d,
           jsonb_build_object('id', v.id, 'cliente', v.cliente, 'data', v.data, 'detalhe', round(v.valor_total,2)||' €', 'alterado', v.updated_at) i
      from vendas v where v.ja_contabilizado_via_recorrencia
       and not exists (select 1 from recorrencias r where upper(btrim(r.cliente)) = upper(btrim(v.cliente)) and r.data_venda = v.data)
    union all select 'LANC-02','crítica','Data da venda fora do período do escritório ou no futuro (erro no ano?)',
           jsonb_build_object('id', v.id, 'cliente', v.cliente, 'data', v.data, 'detalhe', 'venda', 'alterado', v.updated_at)
      from vendas v where v.data < dash_inicio_lancamentos() or v.data > current_date + 1
    union all select 'LANC-02','crítica','Data da venda fora do período do escritório ou no futuro (erro no ano?)',
           jsonb_build_object('id', r.id, 'cliente', r.cliente, 'data', r.data_venda, 'detalhe', 'recorrência', 'alterado', r.updated_at)
      from recorrencias r where r.data_venda < dash_inicio_lancamentos() or r.data_venda > current_date + 1
    union all select 'LANC-03','crítica','Recorrência com número de parcelas diferente das parcelas gravadas',
           jsonb_build_object('id', r.id, 'cliente', r.cliente, 'data', r.data_venda, 'detalhe', r.n_parcelas||' cadastradas / '||(select count(*) from parcelas p where p.recorrencia_id = r.id)||' gravadas', 'alterado', r.updated_at)
      from recorrencias r where r.n_parcelas <> (select count(*) from parcelas p where p.recorrencia_id = r.id)
    union all select 'PAG-01','crítica','Pagamento registado ANTES da data da venda (entra no mês errado)',
           jsonb_build_object('id', r.id||' #'||p.numero, 'cliente', r.cliente, 'data', p.data, 'detalhe', 'venda em '||to_char(r.data_venda,'DD/MM/YYYY'), 'alterado', r.updated_at)
      from parcelas p join recorrencias r on r.id = p.recorrencia_id where p.pago and p.data < r.data_venda
    union all select 'PAG-01','crítica','Pagamento registado ANTES da data da venda (entra no mês errado)',
           jsonb_build_object('id', x.id, 'cliente', r.cliente, 'data', x.data, 'detalhe', 'pagamento personalizado; venda em '||to_char(r.data_venda,'DD/MM/YYYY'), 'alterado', r.updated_at)
      from pagamentos_extras x join recorrencias r on r.id = x.recorrencia_id where x.data < r.data_venda
    union all select 'PAG-02','crítica','Parcela paga sem data de pagamento (não entra no caixa de nenhum mês)',
           jsonb_build_object('id', r.id||' #'||p.numero, 'cliente', r.cliente, 'data', r.data_venda, 'detalhe', 'parcela '||p.numero, 'alterado', r.updated_at)
      from parcelas p join recorrencias r on r.id = p.recorrencia_id where p.pago and p.data is null
    union all select 'PAG-03','crítica','Recebido acima do valor do contrato',
           jsonb_build_object('id', r.id, 'cliente', r.cliente, 'data', r.data_venda, 'detalhe', round(r.valor_contrato,2)||' € de contrato', 'alterado', r.updated_at)
      from recorrencias r
     where r.valor_entrada
         + coalesce((select sum(coalesce(p.valor, (r.valor_contrato - r.valor_entrada) / greatest(r.n_parcelas,1))) from parcelas p where p.recorrencia_id = r.id and p.pago),0)
         + coalesce((select sum(x.valor) from pagamentos_extras x where x.recorrencia_id = r.id),0) > r.valor_contrato + 0.05
    union all select 'PAG-04','média','Parcela paga com uma anterior ainda em aberto (marcada a parcela errada?)',
           jsonb_build_object('id', r.id||' #'||p.numero, 'cliente', r.cliente, 'data', p.data, 'detalhe', 'parcela '||q.numero||' em aberto', 'alterado', r.updated_at)
      from parcelas p join parcelas q on q.recorrencia_id = p.recorrencia_id and q.numero < p.numero and not q.pago
      join recorrencias r on r.id = p.recorrencia_id where p.pago
    union all select 'PAG-05','média','Venda marcada como paga integralmente mas com valor recebido menor que o total',
           jsonb_build_object('id', v.id, 'cliente', v.cliente, 'data', v.data, 'detalhe', round(v.valor_pago,2)||' de '||round(v.valor_total,2)||' €', 'alterado', v.updated_at)
      from vendas v where v.pagamento_integral and not v.ja_contabilizado_via_recorrencia and v.valor_pago < v.valor_total - 0.01
    union all select 'DUP-01','média','Possível duplicado: mesmo cliente, data, serviço e valor',
           jsonb_build_object('id', string_agg(v.id, ' / '), 'cliente', min(v.cliente), 'data', v.data, 'detalhe', count(*)||' vendas de '||round(v.valor_total,2)||' €', 'alterado', max(v.updated_at))
      from vendas v where not v.ja_contabilizado_via_recorrencia group by upper(btrim(v.cliente)), v.data, round(v.valor_total,2), upper(btrim(coalesce(v.servico,''))) having count(*) > 1
    union all select 'DUP-02','média','Possível contrato duplicado: mesmo cliente, serviço e valor',
           jsonb_build_object('id', string_agg(r.id, ' / '), 'cliente', min(r.cliente), 'data', min(r.data_venda), 'detalhe', count(*)||' contratos de '||round(r.valor_contrato,2)||' € ('||string_agg(to_char(r.data_venda,'DD/MM'), ', ')||')', 'alterado', max(r.updated_at))
      from recorrencias r group by upper(btrim(r.cliente)), upper(btrim(coalesce(r.servico,''))), round(r.valor_contrato,2) having count(*) > 1
    union all select 'CAD-01','média','Lançamento com vendedor inexistente',
           jsonb_build_object('id', v.id, 'cliente', v.cliente, 'data', v.data, 'detalhe', v.vendedor_id, 'alterado', v.updated_at)
      from vendas v where v.vendedor_id not in (select sel.id from sel)
    union all select 'CAD-01','média','Lançamento com vendedor inexistente',
           jsonb_build_object('id', r.id, 'cliente', r.cliente, 'data', r.data_venda, 'detalhe', r.vendedor_id, 'alterado', r.updated_at)
      from recorrencias r where r.vendedor_id not in (select sel.id from sel)
    union all select 'CUS-01','baixa','Custo com valor zero ou custo fixo sem vencimento',
           jsonb_build_object('id', custos.e->>'id', 'cliente', custos.e->>'nome', 'data', custos.e->>'vencimento', 'detalhe', coalesce(custos.e->>'valor','sem valor')||' € '||coalesce(custos.e->>'categoria',''), 'alterado', null)
      from custos where coalesce(nullif(custos.e->>'valor','')::numeric, 0) <= 0 or (custos.e->>'categoria' = 'FIXO' and coalesce(custos.e->>'vencimento','') = '')
    union all select 'CAD-02','baixa','Serviço que não está no catálogo (sem IVA separado)',
           jsonb_build_object('id', v.id, 'cliente', v.cliente, 'data', v.data, 'detalhe', v.servico, 'alterado', v.updated_at)
      from vendas v where v.servico is not null and upper(btrim(v.servico)) not in (select svc.nome from svc)
    union all select 'HIST-01','informação','Lançamentos excluídos nos últimos 30 dias (podem ser restaurados)',
           jsonb_build_object('id', h.id, 'cliente', coalesce(h.antes->>'cliente', h.chave), 'data', h.em::date, 'detalhe', case h.tabela when 'vendas' then 'venda' else 'recorrência' end, 'alterado', h.em)
      from auditoria.historico h where h.operacao = 'DELETE' and h.tabela in ('vendas','recorrencias') and h.em > now() - interval '30 days'
  )
  select achados.c, achados.g, achados.d, count(*)::int, jsonb_agg(achados.i order by achados.i->>'data')
    from achados group by achados.c, achados.g, achados.d
   order by case achados.g when 'crítica' then 1 when 'média' then 2 when 'baixa' then 3 else 4 end, achados.c;
end $$;
revoke all on function public.verificar_integridade() from public, anon;
grant execute on function public.verificar_integridade() to authenticated;

-- ---------------------------------------------------------------- 5) HISTÓRICO E RESTAURAR
create or replace function public.listar_exclusoes(p_dias int default 30)
returns table (id bigint, em timestamptz, quem text, tipo text, cliente text, data date, valor numeric, parcelas_pagas int)
language plpgsql stable security definer set search_path = public, auditoria, auth as $$
begin
  if not public.is_gestor() then raise exception 'Só o gestor pode ver o histórico.' using errcode = '42501'; end if;
  return query
  select h.id, h.em, coalesce(u.email::text, 'sistema'),
         case h.tabela when 'vendas' then 'Venda' else 'Recorrência' end,
         h.antes->>'cliente',
         coalesce(h.antes->>'data', h.antes->>'data_venda')::date,
         coalesce(h.antes->>'valor_total', h.antes->>'valor_contrato')::numeric,
         (select count(*)::int from auditoria.historico p where p.transacao = h.transacao and p.tabela = 'parcelas' and p.operacao = 'DELETE' and (p.antes->>'pago')::boolean)
    from auditoria.historico h left join auth.users u on u.id = h.usuario
   where h.operacao = 'DELETE' and h.tabela in ('vendas','recorrencias') and h.em > now() - make_interval(days => p_dias)
     and not exists (select 1 from auditoria.historico r where r.tabela = h.tabela and r.chave = h.chave and r.operacao = 'INSERT' and r.em > h.em)
   order by h.em desc;
end $$;
revoke all on function public.listar_exclusoes(int) from public, anon;
grant execute on function public.listar_exclusoes(int) to authenticated;

create or replace function public.restaurar_exclusao(p_id bigint)
returns text language plpgsql security definer set search_path = public, auditoria as $$
declare h auditoria.historico; np int := 0; nx int := 0;
begin
  if not public.is_gestor() then raise exception 'Só o gestor pode restaurar lançamentos.' using errcode = '42501'; end if;
  select * into h from auditoria.historico where auditoria.historico.id = p_id and operacao = 'DELETE';
  if not found then raise exception 'Exclusão % não encontrada no histórico.', p_id; end if;
  perform set_config('dash.restaurando', '1', true);
  if h.tabela = 'vendas' then
    if exists (select 1 from vendas v where v.id = h.chave) then raise exception 'A venda % já existe.', h.chave; end if;
    insert into vendas select * from jsonb_populate_record(null::vendas, h.antes);
  elsif h.tabela = 'recorrencias' then
    if exists (select 1 from recorrencias r where r.id = h.chave) then raise exception 'A recorrência % já existe.', h.chave; end if;
    insert into recorrencias select * from jsonb_populate_record(null::recorrencias, h.antes);
    insert into parcelas select (jsonb_populate_record(null::parcelas, p.antes)).*
      from auditoria.historico p where p.transacao = h.transacao and p.tabela = 'parcelas' and p.operacao = 'DELETE' and p.antes->>'recorrencia_id' = h.chave;
    get diagnostics np = row_count;
    insert into pagamentos_extras select (jsonb_populate_record(null::pagamentos_extras, x.antes)).*
      from auditoria.historico x where x.transacao = h.transacao and x.tabela = 'pagamentos_extras' and x.operacao = 'DELETE' and x.antes->>'recorrencia_id' = h.chave;
    get diagnostics nx = row_count;
  else
    raise exception 'Só vendas e recorrências podem ser restauradas por aqui.';
  end if;
  perform set_config('dash.restaurando', '', true);
  return case when h.tabela = 'vendas' then 'Venda de '||(h.antes->>'cliente')||' restaurada.'
              else 'Recorrência de '||(h.antes->>'cliente')||' restaurada com '||np||' parcela(s) e '||nx||' pagamento(s) personalizado(s).' end;
end $$;
revoke all on function public.restaurar_exclusao(bigint) from public, anon;
grant execute on function public.restaurar_exclusao(bigint) to authenticated;

revoke all on function auditoria.registrar() from public, anon, authenticated;

-- DESFAZER (se precisar):
--   drop trigger if exists auditoria_vendas on public.vendas; (idem recorrencias, parcelas, pagamentos_extras, app_state)
--   drop trigger if exists validar_venda on public.vendas; drop trigger if exists validar_recorrencia on public.recorrencias;
--   drop trigger if exists validar_parcela on public.parcelas; drop trigger if exists validar_pagamento_extra on public.pagamentos_extras;
--   drop trigger if exists proteger_app_state on public.app_state;
--   drop trigger if exists proteger_exclusao_vendas on public.vendas; drop trigger if exists proteger_exclusao_recorrencias on public.recorrencias;
--   drop function if exists public.verificar_integridade(), public.listar_exclusoes(int), public.restaurar_exclusao(bigint);
--   (o histórico em auditoria.historico pode ser mantido)
