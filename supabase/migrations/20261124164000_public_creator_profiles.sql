alter table public.sg_game_profiles
  add column if not exists creator_verified boolean not null default false;

update public.sg_game_profiles
set creator_verified = coalesce(
  (
    select lower(auth.users.email) = 'sergeizagorodkin082@gmail.com'
    from auth.users
    where auth.users.id = sg_game_profiles.id
  ),
  false
);

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

create or replace function public.sync_sg_game_creator_verified()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  select exists (
    select 1
    from auth.users
    where auth.users.id = new.id
      and lower(auth.users.email) = 'sergeizagorodkin082@gmail.com'
  )
  into new.creator_verified;
  return new;
end;
$$;

revoke all on function public.sync_sg_game_creator_verified() from public, anon, authenticated;

drop trigger if exists sync_sg_game_creator_verified on public.sg_game_profiles;
create trigger sync_sg_game_creator_verified
  before insert or update of nickname
  on public.sg_game_profiles
  for each row
  execute function public.sync_sg_game_creator_verified();

create or replace function public.get_sg_game_public_profile(p_nickname text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_profile jsonb;
begin
  select jsonb_build_object(
    'nickname', nickname,
    'avatar_path', avatar_path,
    'creator_verified', creator_verified,
    'coins', coins,
    'cards', cards
  )
  into v_profile
  from public.sg_game_profiles
  where lower(nickname) = lower(btrim(p_nickname))
  limit 1;

  return v_profile;
end;
$$;

revoke all on function public.get_sg_game_public_profile(text) from public, anon, authenticated;
grant execute on function public.get_sg_game_public_profile(text) to anon, authenticated;

update storage.buckets
set public = true
where id = 'sg-game-avatars';
