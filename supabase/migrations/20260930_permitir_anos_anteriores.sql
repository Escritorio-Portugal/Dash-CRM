-- Aplicada em 2026-09-30 a pedido do gestor: permitir registar vendas,
-- recorrências e pagamentos de anos anteriores (clientes/leads antigos).
-- O piso passa de 01/01/2026 para 01/01/2000 (só barra ano claramente errado,
-- ex.: 0202). O painel continua a pedir confirmação para datas antes de 2026,
-- que é onde aparece o erro de ano mais comum (2025 no lugar de 2026).
-- Efeito no verificador: LANC-02 deixa de sinalizar datas de 2000 a 2025.

create or replace function public.dash_inicio_lancamentos()
returns date language sql immutable set search_path = public
as $$ select date '2000-01-01' $$;

-- Desfazer:
-- create or replace function public.dash_inicio_lancamentos()
-- returns date language sql immutable set search_path = public
-- as $$ select date '2026-01-01' $$;
