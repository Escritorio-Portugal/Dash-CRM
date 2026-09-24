# Invariantes de dados — consultas read-only

Todas as consultas são `SELECT`. Rodar uma de cada vez. Resultado esperado indicado em cada uma.
Status: **NOT RUN**, sem acesso ao banco (ver README.md).

## Estado da migração de 22/09 (DB-001)

```sql
-- INV-MIG-1: a migração foi registada?
select version, name from supabase_migrations.schema_migrations order by version desc limit 5;
```
```sql
-- INV-MIG-2: os CHECKs que ela cria existem?
select conname from pg_constraint where conname like '%valores_validos' or conname = 'pagamentos_extras_valor_positivo';
```

## Duplicidades (CODE-001, CODE-006)

```sql
-- INV-DUP-1: vendas com mesmo cliente+data+valor (esperado: 0 linhas ou justificadas)
select upper(trim(cliente)) cli, data, valor_total, count(*), array_agg(id)
from vendas group by 1,2,3 having count(*)>1 order by data;
```
```sql
-- INV-DUP-2: recorrências com mesmo cliente+data+contrato
select upper(trim(cliente)) cli, data_venda, valor_contrato, count(*), array_agg(id)
from recorrencias group by 1,2,3 having count(*)>1;
```
```sql
-- INV-DUP-3: pagamentos extras repetidos (duplo clique: mesmo rec, data, valor)
select recorrencia_id, data, valor, count(*), array_agg(id)
from pagamentos_extras group by 1,2,3 having count(*)>1;
```
```sql
-- INV-DUP-4: venda NÃO marcada como espelho mas com recorrência do mesmo cliente+data (dinheiro contado 2x)
select v.id, v.cliente, v.data, v.valor_pago, r.id rec_id, r.valor_entrada
from vendas v join recorrencias r on upper(trim(v.cliente))=upper(trim(r.cliente)) and v.data=r.data_venda
where not v.ja_contabilizado_via_recorrencia and v.valor_pago>0;
```
```sql
-- INV-DUP-5: vendas de julho por prefixo de id (resíduo da importação Larissa x reconciliação v2)
select split_part(id,'-',2) prefixo, count(*), sum(valor_total)
from vendas where data between '2026-07-01' and '2026-07-31' group by 1;
```

## Integridade (FIN-004, CODE-005)

```sql
-- INV-INT-1: parcelas pagas sem valor gravado (valor inferido na tela), por mês de pagamento
select to_char(data,'YYYY-MM') mes, count(*) from parcelas
where pago and (valor is null or valor<=0) group by 1 order by 1;
```
```sql
-- INV-INT-2: parcelas pagas sem data (fora de qualquer mês)
select count(*) from parcelas where pago and data is null;
```
```sql
-- INV-INT-3: nº de parcelas diferente de n_parcelas
select r.id, r.n_parcelas, count(p.*) from recorrencias r left join parcelas p on p.recorrencia_id=r.id
group by r.id, r.n_parcelas having count(p.*)<>r.n_parcelas;
```
```sql
-- INV-INT-4: pagamento recebido acima do contrato
select r.id, r.cliente, r.valor_contrato,
  r.valor_entrada + coalesce((select sum(valor) from parcelas where recorrencia_id=r.id and pago and valor>0),0)
  + coalesce((select sum(valor) from pagamentos_extras where recorrencia_id=r.id),0) recebido_gravado
from recorrencias r;
```
```sql
-- INV-INT-5: órfãos
select 'parcela' t, count(*) from parcelas p where not exists (select 1 from recorrencias r where r.id=p.recorrencia_id)
union all select 'extra', count(*) from pagamentos_extras e where not exists (select 1 from recorrencias r where r.id=e.recorrencia_id);
```
```sql
-- INV-INT-6: vendas com composição base+IVA+taxa ≠ total
select id, cliente, valor_total, honorario_base+iva+coalesce(tx_adm,0) comp from vendas
where abs(valor_total-(honorario_base+iva+coalesce(tx_adm,0)))>0.02;
```

## Custos em app_state (FIN-001, FIN-002)

```sql
-- INV-CST-1: custos fixos com mais de um registo por nome
select upper(trim(c->>'nome')) nome, count(*), array_agg(c->>'id'), array_agg(c->>'vencimento')
from app_state, jsonb_array_elements(value) c
where key='crm:costs' and c->>'categoria'='FIXO' group by 1 having count(*)>1;
```
```sql
-- INV-CST-2: pagoPorMes num mês em que existe OUTRO registo exato do mesmo nome, pago (= duplicação no card)
with c as (select x from app_state, jsonb_array_elements(value) x where key='crm:costs' and x->>'categoria'='FIXO')
select a.x->>'nome' nome, m.key mes, a.x->>'id' base_id, b.x->>'id' exato_id, (a.x->>'valor')::numeric valor
from c a, jsonb_each(a.x->'pagoPorMes') m, c b
where upper(trim(a.x->>'nome'))=upper(trim(b.x->>'nome')) and a.x->>'id'<>b.x->>'id'
  and left(b.x->>'vencimento',7)=m.key and (b.x->>'pago')::boolean
  and jsonb_typeof(m.value)='object' and (m.value->>'pago')::boolean;
```
```sql
-- INV-CST-3: pagoPorMes em formato booleano antigo (conta na lista, não no card)
select c->>'nome', m.key from app_state, jsonb_array_elements(value) c, jsonb_each(c->'pagoPorMes') m
where key='crm:costs' and jsonb_typeof(m.value)='boolean';
```
```sql
-- INV-CST-4: flags das migrações JS em crm:meta (DATA-001)
select jsonb_object_keys(value) from app_state where key='crm:meta';
```

## Segurança (SEC-001)

```sql
-- INV-SEC-1: políticas que alcançam anon/public
select tablename, policyname, roles, cmd, qual from pg_policies where schemaname='public' order by 1;
```
```sql
-- INV-SEC-2: GRANTs para anon
select table_name, privilege_type from information_schema.role_table_grants
where grantee='anon' and table_schema='public';
```
