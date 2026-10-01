-- Liga cada puntuación a la cuenta que la juega (SPEC 13): columna user_id,
-- trigger que fija player_name con sesión y reserva los usernames registrados,
-- y policies de insert separadas para anon y authenticated.

alter table public.scores
  add column user_id uuid references auth.users(id) on delete set null;

create index scores_user_game_idx on public.scores (user_id, game_id);

drop policy "scores_insert_public" on public.scores;

create policy "scores_insert_anon" on public.scores
  for insert to anon with check (user_id is null);

create policy "scores_insert_authenticated" on public.scores
  for insert to authenticated with check (user_id = (select auth.uid()));
-- scores_select_public no cambia.

-- Con user_id: player_name = upper(username) (el cliente no puede falsearlo).
-- Sin user_id (invitado): rechaza un player_name que sea un username registrado.
-- Sin security definer: lee profiles con la policy profiles_select_public.
create function public.scores_before_insert()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_username text;
begin
  if new.user_id is not null then
    select p.username into v_username
    from public.profiles p
    where p.id = new.user_id;

    if v_username is null then
      raise exception 'profile_not_found';
    end if;

    new.player_name := upper(v_username);
  elsif exists (
    select 1 from public.profiles p where p.username = lower(new.player_name)
  ) then
    raise exception 'player_name_reserved';
  end if;

  return new;
end;
$$;

create trigger scores_before_insert
  before insert on public.scores
  for each row execute function public.scores_before_insert();
