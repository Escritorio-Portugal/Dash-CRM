-- Aplicada em 2026-09-29 logo após 20260929_seguranca_dos_lancamentos.sql.
-- O upsert (INSERT ... ON CONFLICT) dispara o gatilho BEFORE INSERT mesmo quando a
-- linha já existe. Compara com a linha existente para validar só o que mudou, assim
-- registos antigos com erro continuam editáveis (e são corrigidos pelo verificador).
-- Testado com ROLLBACK: regravar 4 contratos antigos com erro sem mexer = OK; corrigir
-- o ano do JOSE, a parcela da EDINEIA e preencher parcela sem data = OK; lançamento
-- novo com ano 2025 ou pagamento antes da venda = bloqueado.

create or replace function public.validar_venda()
returns trigger language plpgsql set search_path = public as $$
declare ant public.vendas;
begin
  if public.dash_restaurando() then return new; end if;
  if tg_op = 'UPDATE' then ant := old; else select * into ant from public.vendas where id = new.id; end if;
  new.cliente := btrim(regexp_replace(coalesce(new.cliente,''), '\s+', ' ', 'g'));
  if new.cliente = '' then raise exception 'Informe o nome do cliente.' using errcode = '22023'; end if;
  if ant.id is null or new.data is distinct from ant.data then
    perform public.validar_data_lancamento(new.data, 'A data da venda');
  end if;
  if ant.id is null or new.valor_total is distinct from ant.valor_total or new.valor_pago is distinct from ant.valor_pago then
    if coalesce(new.valor_total,0) <= 0 then raise exception 'O valor total da venda tem de ser maior que zero.' using errcode = '22023'; end if;
    if coalesce(new.valor_pago,0) < 0 or coalesce(new.valor_pago,0) > new.valor_total + 0.01 then
      raise exception 'O valor recebido (%) não pode ser maior que o total (%).', new.valor_pago, new.valor_total using errcode = '22023';
    end if;
  end if;
  return new;
end $$;

create or replace function public.validar_recorrencia()
returns trigger language plpgsql set search_path = public as $$
declare ant public.recorrencias;
begin
  if public.dash_restaurando() then return new; end if;
  if tg_op = 'UPDATE' then ant := old; else select * into ant from public.recorrencias where id = new.id; end if;
  new.cliente := btrim(regexp_replace(coalesce(new.cliente,''), '\s+', ' ', 'g'));
  if new.cliente = '' then raise exception 'Informe o nome do cliente.' using errcode = '22023'; end if;
  if ant.id is null or new.data_venda is distinct from ant.data_venda then
    perform public.validar_data_lancamento(new.data_venda, 'A data da venda');
    if ant.id is not null and exists (select 1 from public.parcelas p where p.recorrencia_id = new.id and p.pago and p.data < new.data_venda) then
      raise exception 'Há parcelas desta recorrência pagas antes de %: corrija a data da venda ou das parcelas.', to_char(new.data_venda,'DD/MM/YYYY') using errcode = '22023';
    end if;
  end if;
  if (ant.id is null or new.valor_contrato is distinct from ant.valor_contrato) and coalesce(new.valor_contrato,0) <= 0 then
    raise exception 'O valor do contrato tem de ser maior que zero.' using errcode = '22023';
  end if;
  return new;
end $$;

create or replace function public.validar_parcela()
returns trigger language plpgsql set search_path = public as $$
declare dv date; ant public.parcelas;
begin
  if public.dash_restaurando() then return new; end if;
  if not new.pago then new.data := null; new.valor := null; return new; end if;
  if tg_op = 'UPDATE' then ant := old; else select * into ant from public.parcelas where recorrencia_id = new.recorrencia_id and numero = new.numero; end if;
  if ant.recorrencia_id is null or new.pago is distinct from ant.pago or new.data is distinct from ant.data then
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
declare dv date; ant public.pagamentos_extras;
begin
  if public.dash_restaurando() then return new; end if;
  if tg_op = 'UPDATE' then ant := old; else select * into ant from public.pagamentos_extras where id = new.id; end if;
  if ant.id is null or new.data is distinct from ant.data then
    perform public.validar_data_lancamento(new.data, 'A data do pagamento');
    select data_venda into dv from public.recorrencias where id = new.recorrencia_id;
    if dv is not null and new.data < dv then
      raise exception 'O pagamento (%) é anterior à venda (%).', to_char(new.data,'DD/MM/YYYY'), to_char(dv,'DD/MM/YYYY') using errcode = '22023';
    end if;
  end if;
  return new;
end $$;
