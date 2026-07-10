-- PROGO — esquema canónico de base de datos (Supabase Postgres)
-- Corre este archivo completo en Supabase: Project -> SQL Editor -> New query -> pega y "Run".
-- Es idempotente: usa "if not exists" / "add column if not exists" en todo,
-- así que es seguro volver a correrlo en una base que ya tiene parte del esquema
-- (por ejemplo, para agregar solo la columna `profiles.hidden_categories`,
-- que es lo único nuevo si ya corriste una versión anterior de este archivo).
--
-- Este archivo reemplaza el historial de migraciones incrementales
-- (profiles.sql, incomes_and_goals.sql, monthly_income.sql, custom_categories.sql,
-- full_persistence.sql) fusionado en un solo snapshot del estado actual.

-- ============================================================
-- 1. profiles — perfiles, roles (admin/usuario), configuración por usuario
-- ============================================================

create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  role text not null default 'user' check (role in ('user', 'admin')),
  disabled boolean not null default false,
  created_at timestamptz not null default now()
);

alter table profiles add column if not exists monthly_income numeric;
alter table profiles add column if not exists account_size numeric not null default 10000;
alter table profiles add column if not exists hidden_categories jsonb not null default '[]'::jsonb;

alter table profiles enable row level security;

-- Función auxiliar: evita recursión infinita al chequear el rol dentro de las policies de la misma tabla
create or replace function is_admin()
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (select 1 from profiles where id = auth.uid() and role = 'admin');
$$;

drop policy if exists "select own or admin" on profiles;
create policy "select own or admin" on profiles
  for select using (auth.uid() = id or is_admin());

drop policy if exists "update own or admin" on profiles;
create policy "update own or admin" on profiles
  for update using (auth.uid() = id or is_admin())
  with check (auth.uid() = id or is_admin());

drop policy if exists "insert own" on profiles;
create policy "insert own" on profiles
  for insert with check (auth.uid() = id and role = 'user');

-- Crea automáticamente la fila de perfil cuando alguien se registra.
-- El correo de JC CREW (juaneschaverra15@gmail.com) queda marcado 'admin' automáticamente.
create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, role)
  values (
    new.id,
    new.email,
    case when new.email = 'juaneschaverra15@gmail.com' then 'admin' else 'user' end
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ============================================================
-- 2. goals — Metas (estándar y financieras)
-- ============================================================

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

alter table goals enable row level security;
drop policy if exists "own rows" on goals;
create policy "own rows" on goals for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create index if not exists goals_user_timeframe_idx on goals (user_id, timeframe);

-- ============================================================
-- 3. incomes — Ingresos y saldos
-- ============================================================

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

alter table incomes enable row level security;
drop policy if exists "own rows" on incomes;
create policy "own rows" on incomes for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create index if not exists incomes_user_date_idx on incomes (user_id, income_date desc);

-- ============================================================
-- 4. egresos — Egresos (contraparte de incomes, para saldo = ingresos - egresos)
-- ============================================================

create table if not exists egresos (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  amount numeric not null check (amount > 0),
  concept text not null,
  category text,
  note text,
  expense_date date not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table egresos enable row level security;
drop policy if exists "own rows" on egresos;
create policy "own rows" on egresos for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create index if not exists egresos_user_date_idx on egresos (user_id, expense_date desc);

-- ============================================================
-- 5. custom_categories — Categorías de gasto personalizadas (Gastos)
-- ============================================================

create table if not exists custom_categories (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  name text not null,
  color text not null,
  created_at timestamptz not null default now()
);

alter table custom_categories enable row level security;
drop policy if exists "own rows" on custom_categories;
create policy "own rows" on custom_categories for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ============================================================
-- 5b. notes — Notas libres
-- ============================================================

create table if not exists notes (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  title text not null default '',
  content text not null default '',
  tone_key text not null default 'gold',
  pinned boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table notes enable row level security;
drop policy if exists "own rows" on notes;
create policy "own rows" on notes for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create index if not exists notes_user_updated_idx on notes (user_id, updated_at desc);

-- ============================================================
-- 6. tasks, expenses, habits, products, activities, activity_completions, journals, trades
-- ============================================================

create table if not exists tasks (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  timeframe text not null check (timeframe in ('diario','semanal','mensual')),
  title text not null,
  done boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists expenses (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  date date not null,
  category text not null,
  description text not null default '',
  amount numeric not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists habits (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  name text not null,
  tone_key text not null default 'gold',
  history jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists products (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  name text not null,
  test_date date not null,
  investment numeric not null default 0,
  sales numeric not null default 0,
  status text not null default 'En prueba',
  notes text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists activities (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  date date not null,
  title text not null,
  start_min int not null,
  end_min int not null,
  type text not null default 'operativo',
  category text default '',
  custom_color text,
  description text default '',
  repeat text not null default 'no',
  source jsonb,
  created_at timestamptz not null default now()
);

create table if not exists activity_completions (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  activity_id bigint not null references activities(id) on delete cascade,
  occurrence_date date not null,
  done boolean not null default true,
  unique (user_id, activity_id, occurrence_date)
);

create table if not exists journals (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  date date not null,
  rating text,
  good text,
  improve text,
  feeling text,
  notes text,
  unique (user_id, date)
);

create table if not exists trades (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  date date not null,
  symbol text not null,
  pnl numeric not null default 0,
  created_at timestamptz not null default now()
);

alter table tasks enable row level security;
alter table expenses enable row level security;
alter table habits enable row level security;
alter table products enable row level security;
alter table activities enable row level security;
alter table activity_completions enable row level security;
alter table journals enable row level security;
alter table trades enable row level security;

do $$
declare
  t text;
begin
  for t in select unnest(array[
    'tasks','expenses','habits','products','activities','activity_completions','journals','trades'
  ])
  loop
    if not exists (
      select 1 from pg_policies where schemaname = 'public' and tablename = t and policyname = 'own rows'
    ) then
      execute format(
        'create policy "own rows" on %I for all using (auth.uid() = user_id) with check (auth.uid() = user_id);',
        t
      );
    end if;
  end loop;
end $$;

create index if not exists tasks_user_timeframe_idx on tasks (user_id, timeframe);
create index if not exists expenses_user_date_idx on expenses (user_id, date desc);
create index if not exists activities_user_date_idx on activities (user_id, date);
create index if not exists trades_user_date_idx on trades (user_id, date desc);
