-- Aplicada em produção em 2026-09-24 (migração "colaborador_parcelas_e_salvar_recorrencia").
-- 1) O colaborador passa a gravar as parcelas das PRÓPRIAS recorrências (antes só
--    lia, e criar uma recorrência falhava na gravação das parcelas). Pagamento de
--    parcela (pago/valor/data) continua só do gestor: política + trigger.
-- 2) salvar_recorrencia(): recorrência + parcelas + pagamentos personalizados numa
--    ÚNICA transação (antes eram 5 chamadas; uma falha no meio deixava meia gravação).
--    SECURITY INVOKER: valem as mesmas políticas RLS de cada tabela.
-- Testado com ROLLBACK simulando colaborador e gestor (8 cenários + UPDATE direto).
--
-- Para desfazer:
--   drop function if exists public.salvar_recorrencia(jsonb, jsonb, jsonb);
--   drop trigger if exists parcelas_pagamento_so_gestor on public.parcelas;
--   drop function if exists public.parcelas_pagamento_so_gestor();
--   drop policy if exists "parcelas: colaborador cria as proprias em aberto" on public.parcelas;
--   drop policy if exists "parcelas: colaborador regrava as proprias" on public.parcelas;
--   drop policy if exists "parcelas: colaborador remove as proprias em aberto" on public.parcelas;
-- (o app anterior a este commit grava pelas tabelas diretamente e continua a funcionar)

create policy "parcelas: colaborador cria as proprias em aberto" on public.parcelas
  for insert to authenticated
  with check (
    pago = false and valor is null and data is null
    and exists (select 1 from public.recorrencias r where r.id = parcelas.recorrencia_id and r.vendedor_id = public.my_seller_id())
  );
create policy "parcelas: colaborador regrava as proprias" on public.parcelas
  for update to authenticated
  using (exists (select 1 from public.recorrencias r where r.id = parcelas.recorrencia_id and r.vendedor_id = public.my_seller_id()))
  with check (exists (select 1 from public.recorrencias r where r.id = parcelas.recorrencia_id and r.vendedor_id = public.my_seller_id()));
create policy "parcelas: colaborador remove as proprias em aberto" on public.parcelas
  for delete to authenticated
  using (
    pago = false
    and exists (select 1 from public.recorrencias r where r.id = parcelas.recorrencia_id and r.vendedor_id = public.my_seller_id())
  );

create or replace function public.parcelas_pagamento_so_gestor()
returns trigger language plpgsql set search_path = public as $$
begin
  if auth.role() = 'authenticated' and not public.is_gestor() then
    if new.pago is distinct from old.pago or new.valor is distinct from old.valor
       or new.data is distinct from old.data or new.recorrencia_id is distinct from old.recorrencia_id then
      raise exception 'Só o gestor pode registar ou alterar pagamentos de parcelas.' using errcode = '42501';
    end if;
  end if;
  return new;
end $$;
create trigger parcelas_pagamento_so_gestor before update on public.parcelas
  for each row execute function public.parcelas_pagamento_so_gestor();

create or replace function public.salvar_recorrencia(p_rec jsonb, p_parcelas jsonb, p_extras jsonb)
returns void language plpgsql security invoker set search_path = public as $$
declare r public.recorrencias;
begin
  r := jsonb_populate_record(null::public.recorrencias, p_rec);
  insert into public.recorrencias (id, data_venda, cliente, servico, vendedor_id, vendedor_nome, valor_contrato, valor_entrada,
                                   honorario_base, iva, tx_adm, n_parcelas, forma_pagamento, origem, isento_taxa_adm, origem_sheet)
  values (r.id, r.data_venda, r.cliente, r.servico, r.vendedor_id, r.vendedor_nome, coalesce(r.valor_contrato,0), coalesce(r.valor_entrada,0),
          r.honorario_base, r.iva, r.tx_adm, coalesce(r.n_parcelas,1), r.forma_pagamento, r.origem, coalesce(r.isento_taxa_adm,false), r.origem_sheet)
  on conflict (id) do update set
    data_venda = excluded.data_venda, cliente = excluded.cliente, servico = excluded.servico,
    vendedor_id = excluded.vendedor_id, vendedor_nome = excluded.vendedor_nome,
    valor_contrato = excluded.valor_contrato, valor_entrada = excluded.valor_entrada,
    honorario_base = excluded.honorario_base, iva = excluded.iva, tx_adm = excluded.tx_adm,
    n_parcelas = excluded.n_parcelas, forma_pagamento = excluded.forma_pagamento, origem = excluded.origem,
    isento_taxa_adm = excluded.isento_taxa_adm, origem_sheet = excluded.origem_sheet, updated_at = now();

  insert into public.parcelas (recorrencia_id, numero, data, pago, valor)
  select r.id, p.numero, p.data, coalesce(p.pago,false), p.valor
  from jsonb_to_recordset(coalesce(p_parcelas,'[]'::jsonb)) as p(numero int, data date, pago boolean, valor numeric)
  on conflict (recorrencia_id, numero) do update set data = excluded.data, pago = excluded.pago, valor = excluded.valor;
  delete from public.parcelas where recorrencia_id = r.id and numero > coalesce(r.n_parcelas,1);

  insert into public.pagamentos_extras (id, recorrencia_id, data, valor)
  select x.id, r.id, x.data, x.valor
  from jsonb_to_recordset(coalesce(p_extras,'[]'::jsonb)) as x(id text, data date, valor numeric)
  on conflict (id) do update set data = excluded.data, valor = excluded.valor;
  delete from public.pagamentos_extras e where e.recorrencia_id = r.id
    and not exists (select 1 from jsonb_to_recordset(coalesce(p_extras,'[]'::jsonb)) as x(id text) where x.id = e.id);
end $$;
revoke all on function public.salvar_recorrencia(jsonb, jsonb, jsonb) from public, anon;
grant execute on function public.salvar_recorrencia(jsonb, jsonb, jsonb) to authenticated;
revoke all on function public.parcelas_pagamento_so_gestor() from public, anon, authenticated;
