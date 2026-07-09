-- PROGO — persistencia completa (Tareas, Gastos, Hábitos, Productos, Rutina, Trading)
-- Corre esto en el SQL Editor de tu proyecto Supabase.
-- Ninguna de estas tablas existía antes; todo vivía solo en memoria del navegador.

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

alter table profiles add column if not exists account_size numeric not null default 10000;

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
    execute format(
      'create policy "own rows" on %I for all using (auth.uid() = user_id) with check (auth.uid() = user_id);',
      t
    );
  end loop;
end $$;

create index if not exists tasks_user_timeframe_idx on tasks (user_id, timeframe);
create index if not exists expenses_user_date_idx on expenses (user_id, date desc);
create index if not exists activities_user_date_idx on activities (user_id, date);
create index if not exists trades_user_date_idx on trades (user_id, date desc);
