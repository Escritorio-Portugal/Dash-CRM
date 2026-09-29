-- Aplicada em 2026-09-29: fixa o search_path das funções auxiliares (aviso do Supabase Advisor).
alter function public.dash_inicio_lancamentos() set search_path = public;
alter function public.dash_restaurando() set search_path = public;
alter function public.validar_data_lancamento(date, text) set search_path = public;
