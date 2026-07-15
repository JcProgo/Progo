-- PROGO — esquema canónico de base de datos (Supabase Postgres)
-- Corre este archivo completo en Supabase: Project -> SQL Editor -> New query -> pega y "Run".
-- Es idempotente: usa "if not exists" / "add column if not exists" en todo,
-- así que es seguro volver a correrlo en una base que ya tiene parte del esquema
-- (por ejemplo, para agregar solo la sección 8 de suscripciones,
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

-- Suscripción de pago (ver sección 8): `add column ... default true` deja a TODAS las
-- cuentas existentes en grandfathered=true en el momento en que se corre este archivo.
-- Las cuentas nuevas quedan en false porque handle_new_user() (abajo) lo inserta explícito.
alter table profiles add column if not exists grandfathered boolean not null default true;
alter table profiles add column if not exists free_access boolean not null default false;
alter table profiles add column if not exists enabled_modules jsonb; -- null = todos los módulos habilitados

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

-- La policy "update own or admin" de arriba deja que cualquiera actualice SU PROPIA
-- fila — sin esto, un usuario podría hacerse admin, quitarse `disabled`, o (ahora que
-- importa el dinero) ponerse `free_access`/`grandfathered` en true por su cuenta con
-- una llamada REST directa. Este trigger revierte esas columnas a su valor anterior
-- si quien actualiza no es admin, dejando `update own` seguro para el resto de campos
-- (monthly_income, account_size, hidden_categories, etc.) que sí puede tocar el dueño.
create or replace function protect_admin_only_profile_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not is_admin() then
    new.role := old.role;
    new.disabled := old.disabled;
    new.free_access := old.free_access;
    new.grandfathered := old.grandfathered;
    new.enabled_modules := old.enabled_modules;
  end if;
  return new;
end;
$$;

drop trigger if exists protect_admin_only_columns on profiles;
create trigger protect_admin_only_columns
  before update on profiles
  for each row execute function protect_admin_only_profile_columns();

-- Lista de correos que el admin invitó a entrar gratis (panel Usuarios ->
-- "Invitar amigos"), ANTES de que esa persona se haya registrado siquiera. Cuando el
-- correo invitado se registra, handle_new_user() (abajo) lo detecta acá y le marca
-- free_access=true automáticamente. Si la persona ya tenía cuenta, el cliente
-- actualiza free_access directo sobre su fila existente (no pasa por esta tabla).
create table if not exists invited_emails (
  email text primary key,
  invited_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

alter table invited_emails enable row level security;
drop policy if exists "admin manages invites" on invited_emails;
create policy "admin manages invites" on invited_emails
  for all using (is_admin()) with check (is_admin());

-- Crea automáticamente la fila de perfil cuando alguien se registra.
-- El correo de JC CREW (juaneschaverra15@gmail.com) queda marcado 'admin' automáticamente.
-- grandfathered=false explícito: las cuentas nuevas de aquí en adelante SÍ deben pagar
-- (las que ya existían quedaron en true por el default de la columna, arriba) — salvo
-- que el correo esté en invited_emails, en cuyo caso entra gratis desde el día uno.
create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  was_invited boolean;
begin
  select exists(select 1 from invited_emails where email = lower(new.email)) into was_invited;
  insert into public.profiles (id, email, role, grandfathered, free_access)
  values (
    new.id,
    new.email,
    case when new.email = 'juaneschaverra15@gmail.com' then 'admin' else 'user' end,
    false,
    coalesce(was_invited, false)
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

-- ============================================================
-- 7. Notificaciones push — recordatorios individuales por hábito/tarea/bloque
-- ============================================================

-- Hábitos/tareas: on/off simple — si está activado y aún no está hecho hoy, se
-- avisa a las 8am/12pm/6pm (horarios fijos, no personalizables por ítem).
-- `reminder_time` quedó sin uso (se reemplazó por horarios fijos) pero se deja la
-- columna para no romper filas existentes; no la lee la Edge Function.
alter table habits add column if not exists reminder_time time;
alter table habits add column if not exists reminders_enabled boolean not null default false;
alter table habits add column if not exists last_notified_date date;
alter table habits add column if not exists notified_stages jsonb not null default '[]'::jsonb;
alter table tasks add column if not exists reminder_time time;
alter table tasks add column if not exists reminders_enabled boolean not null default false;
alter table tasks add column if not exists last_notified_date date;
alter table tasks add column if not exists notified_stages jsonb not null default '[]'::jsonb;
-- Rutina: si está activado, avisa 20 min antes de empezar, 10 min antes de empezar,
-- y 10 min después de terminar (preguntando cómo le fue) — usa el horario propio del bloque.
alter table activities add column if not exists notify_enabled boolean not null default false;
alter table activities add column if not exists last_notified_date date;
alter table activities add column if not exists notified_stages jsonb not null default '[]'::jsonb;

-- Suscripciones push del navegador (una por dispositivo/instalación) para poder
-- despachar el aviso aunque la app esté cerrada.
create table if not exists push_subscriptions (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);

alter table push_subscriptions enable row level security;
drop policy if exists "own rows" on push_subscriptions;
create policy "own rows" on push_subscriptions for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create index if not exists push_subscriptions_user_idx on push_subscriptions (user_id);

-- ============================================================
-- 8. Suscripciones (Wompi) — mensualidad para cuentas nuevas
-- ============================================================

-- Wompi no tiene concepto de "suscripción recurrente" como Stripe: guardamos una
-- tarjeta tokenizada (wompi_payment_source_id) y la cobramos nosotros mismos cada
-- mes vía el cron `charge-subscriptions`. Esta tabla se llena solo desde las Edge
-- Functions `create-wompi-payment-source` (alta) y `wompi-webhook`/`charge-subscriptions`
-- (actualización de estado), todas con la service_role key — nunca se escribe desde
-- el cliente. Los usuarios (y el admin) solo pueden LEER su fila.
--
-- No hay filas reales todavía (nadie ha pagado con la versión anterior basada en
-- Stripe), así que se reemplaza la tabla en seco en vez de migrarla.
drop table if exists subscriptions cascade;

create table subscriptions (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade unique,
  wompi_payment_source_id bigint,
  wompi_customer_email text,
  status text not null default 'incomplete'
    check (status in ('trialing','active','past_due','canceled','incomplete')),
  trial_end timestamptz,
  next_charge_date timestamptz,
  last_transaction_id text,
  last_charge_status text,
  last_charge_attempt_at timestamptz,
  failed_charge_count int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table subscriptions enable row level security;
drop policy if exists "select own or admin" on subscriptions;
create policy "select own or admin" on subscriptions
  for select using (auth.uid() = user_id or is_admin());
create index if not exists subscriptions_user_idx on subscriptions (user_id);
create index if not exists subscriptions_next_charge_idx on subscriptions (next_charge_date)
  where status in ('trialing','active','past_due');

-- ============================================================
-- 9. Trading — múltiples cuentas por usuario
-- ============================================================

-- Cada usuario puede llevar varias cuentas de trading en paralelo (ej. "Cuenta 1",
-- "Cuenta 2"), cada una con su propio tamaño de cuenta y su propio calendario de
-- operaciones (trades.account_id). profiles.account_size queda sin usar de aquí en
-- adelante (mismo precedente que reminder_time: se deja la columna para no romper
-- nada, pero ni el cliente ni ninguna función la vuelve a leer).
create table if not exists trading_accounts (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  name text not null default 'Cuenta 1',
  account_size numeric not null default 10000,
  created_at timestamptz not null default now()
);

alter table trading_accounts enable row level security;
drop policy if exists "own rows" on trading_accounts;
create policy "own rows" on trading_accounts for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create index if not exists trading_accounts_user_idx on trading_accounts (user_id);

alter table trades add column if not exists account_id bigint references trading_accounts(id) on delete cascade;

-- Migración de datos: cualquier trade existente sin account_id (todos los de antes de
-- este cambio) se engancha a una "Cuenta 1" nueva, sembrada con el account_size que
-- ya tenía el usuario en profiles — así no se pierde ni se resetea nada.
do $$
declare
  u record;
  new_account_id bigint;
begin
  for u in select distinct user_id from trades where account_id is null
  loop
    insert into trading_accounts (user_id, name, account_size)
    select u.user_id, 'Cuenta 1', coalesce(p.account_size, 10000)
    from profiles p where p.id = u.user_id
    returning id into new_account_id;

    update trades set account_id = new_account_id
    where user_id = u.user_id and account_id is null;
  end loop;
end $$;
