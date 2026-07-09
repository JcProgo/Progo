-- PROGO — Categorías de gasto personalizadas
-- Corre esto en el SQL Editor de tu proyecto Supabase.

create table if not exists custom_categories (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  name text not null,
  color text not null,
  created_at timestamptz not null default now()
);

alter table custom_categories enable row level security;
create policy "own rows" on custom_categories for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
