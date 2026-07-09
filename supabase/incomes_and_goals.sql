-- PROGO — Metas (persistente) + Ingresos y Saldos
-- Corre esto en el SQL Editor de tu proyecto Supabase (después de profiles.sql).
-- Ninguna de las dos tablas existía antes: "goals" no se había creado nunca
-- (Metas vivía solo en memoria del navegador), así que se crean desde cero
-- ya con los campos de meta financiera incluidos.

create table if not exists goals (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  timeframe text not null check (timeframe in ('diario','semanal','mensual','trimestral')),
  title text not null,
  done boolean,
  progress numeric,
  target numeric,
  money boolean not null default false,
  goal_type text not null default 'standard' check (goal_type in ('standard','financial')),
  financial_target numeric,
  financial_start_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists incomes (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  amount numeric not null check (amount > 0),
  concept text not null,
  category text,
  note text,
  income_date date not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table goals enable row level security;
alter table incomes enable row level security;

create policy "own rows" on goals for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own rows" on incomes for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index if not exists goals_user_timeframe_idx on goals (user_id, timeframe);
create index if not exists incomes_user_date_idx on incomes (user_id, income_date desc);
