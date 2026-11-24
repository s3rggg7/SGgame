create or replace function public.is_valid_sg_game_nickname(p_nickname text)
returns boolean
language plpgsql
immutable
set search_path = public, pg_temp
as $$
declare
  v_nickname text := lower(btrim(p_nickname));
begin
  if v_nickname is null or v_nickname !~ '^[a-zа-яё0-9_]{3,16}$' then
    return false;
  end if;

  if v_nickname = any (array['admin', 'administrator', 'moderator', 'support', 'sggames']) then
    return false;
  end if;

  if v_nickname ~ '(хуй|хуя|хуе|хуи|хую|пизд|еб|бля|бляд|сука|шлюх|гандон|fuck|shit|bitch|asshole|dick|cunt|nazi)' then
    return false;
  end if;

  return true;
end;
$$;

revoke all on function public.is_valid_sg_game_nickname(text) from public, anon, authenticated;

alter table public.sg_game_profiles
  add column nickname text,
  add column nickname_claimed boolean not null default false;

update public.sg_game_profiles
set nickname = 'p_' || substr(replace(id::text, '-', ''), 1, 14)
where nickname is null;

insert into public.sg_game_profiles (id, nickname, nickname_claimed)
select id, 'p_' || substr(replace(id::text, '-', ''), 1, 14), false
from auth.users
on conflict (id) do nothing;

alter table public.sg_game_profiles
  alter column nickname set not null,
  add constraint sg_game_profiles_nickname_valid
    check (public.is_valid_sg_game_nickname(nickname));

create unique index sg_game_profiles_nickname_unique
  on public.sg_game_profiles (lower(nickname));

create or replace function public.create_sg_game_profile()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_nickname text := btrim(new.raw_user_meta_data ->> 'nickname');
begin
  if not public.is_valid_sg_game_nickname(v_nickname) then
    raise exception using errcode = '23514', message = 'nickname_invalid';
  end if;

  begin
    insert into public.sg_game_profiles (id, nickname, nickname_claimed)
    values (new.id, v_nickname, true);
  exception when unique_violation then
    raise exception using errcode = '23505', message = 'nickname_taken';
  end;
  return new;
end;
$$;

revoke all on function public.create_sg_game_profile() from public, anon, authenticated;

create or replace function public.set_sg_game_nickname(p_nickname text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_nickname text := btrim(p_nickname);
begin
  if v_user_id is null then
    raise exception using errcode = 'P0001', message = 'authentication_required';
  end if;
  if not public.is_valid_sg_game_nickname(v_nickname) then
    raise exception using errcode = 'P0001', message = 'nickname_invalid';
  end if;

  begin
    update public.sg_game_profiles
    set nickname = v_nickname,
        nickname_claimed = true
    where id = v_user_id
      and nickname_claimed = false;
  exception when unique_violation then
    raise exception using errcode = 'P0001', message = 'nickname_taken';
  end;

  if not found then
    raise exception using errcode = 'P0001', message = 'nickname_already_set';
  end if;

  return jsonb_build_object('nickname', v_nickname, 'nickname_claimed', true);
end;
$$;

revoke all on function public.set_sg_game_nickname(text) from public, anon;
grant execute on function public.set_sg_game_nickname(text) to authenticated;
