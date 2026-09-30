-- Crea public.profiles (username único por usuario de auth), RLS y el trigger
-- on_auth_user_created que crea el profile al registrarse (SPEC 12).

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null unique,
  created_at timestamptz not null default now(),
  constraint profiles_username_format check (username ~ '^[a-z0-9_]{3,10}$')
);

alter table public.profiles enable row level security;

create policy "profiles_select_public" on public.profiles
  for select to anon, authenticated using (true);
-- Sin policies de insert/update/delete: solo escribe el trigger.

-- Si el username falta, no cumple el formato o ya existe, el insert falla y
-- Supabase rechaza el signUp completo: no queda ningún usuario sin profile.
-- La SPEC 13 reemplaza esta función para generar el username en cuentas OAuth.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, username)
  values (new.id, lower(new.raw_user_meta_data->>'username'));
  return new;
end;
$$;

-- Solo la invoca el trigger; no debe ser ejecutable vía /rest/v1/rpc.
revoke execute on function public.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
