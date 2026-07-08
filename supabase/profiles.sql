-- PROGO — perfiles y roles (admin / usuario)
-- Corre esto DESPUÉS de supabase/schema.sql, en el SQL Editor de tu proyecto.
-- Tu correo (juaneschaverra15@gmail.com) queda marcado como 'admin' automáticamente
-- en el momento en que te registres con ese correo exacto.

create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  role text not null default 'user' check (role in ('user', 'admin')),
  disabled boolean not null default false,
  created_at timestamptz not null default now()
);

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

create policy "select own or admin" on profiles
  for select using (auth.uid() = id or is_admin());

create policy "update own or admin" on profiles
  for update using (auth.uid() = id or is_admin())
  with check (auth.uid() = id or is_admin());

create policy "insert own" on profiles
  for insert with check (auth.uid() = id and role = 'user');

-- Crea automáticamente la fila de perfil cuando alguien se registra
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
