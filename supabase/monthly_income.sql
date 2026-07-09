-- PROGO — Ingreso mensual configurable (usado en Gastos)
-- Corre esto en el SQL Editor de tu proyecto Supabase.
-- Solo agrega una columna a la tabla "profiles" que ya existe; no crea tablas nuevas.

alter table profiles add column if not exists monthly_income numeric;
