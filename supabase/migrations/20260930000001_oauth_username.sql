-- Reemplaza public.handle_new_user() (SPEC 12) para generar el username de
-- las cuentas OAuth, que no traen 'username' en raw_user_meta_data (SPEC 13).
-- El trigger on_auth_user_created no cambia.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_base text;
  v_candidate text;
  v_n integer := 2;
begin
  -- Registro por email (SPEC 12): se usa tal cual en minúsculas. Si no cumple
  -- el formato o está ocupado, el insert falla y el signUp completo se rechaza.
  if new.raw_user_meta_data->>'username' is not null then
    insert into public.profiles (id, username)
    values (new.id, lower(new.raw_user_meta_data->>'username'));
    return new;
  end if;

  -- OAuth: user_name (GitHub), si no la parte local del email (Google),
  -- si no 'player'.
  v_base := coalesce(
    nullif(new.raw_user_meta_data->>'user_name', ''),
    nullif(split_part(new.email, '@', 1), ''),
    'player'
  );
  v_base := left(regexp_replace(lower(v_base), '[^a-z0-9_]', '_', 'g'), 7);

  if length(v_base) < 3 then
    v_base := 'player';
  end if;

  -- Base libre, o base || n con n de 2 a 999 (nunca más de 10 caracteres).
  v_candidate := v_base;
  while exists (
    select 1 from public.profiles p where p.username = v_candidate
  ) loop
    if v_n > 999 then
      raise exception 'username_unavailable';
    end if;
    v_candidate := v_base || v_n;
    v_n := v_n + 1;
  end loop;

  insert into public.profiles (id, username)
  values (new.id, v_candidate);
  return new;
end;
$$;

-- Solo la invoca el trigger; no debe ser ejecutable vía /rest/v1/rpc.
revoke execute on function public.handle_new_user() from public, anon, authenticated;
