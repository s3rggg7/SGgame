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
    'avatar_path', case
      when avatar_moderation_status = 'approved' then avatar_path
      else null
    end,
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

create or replace function public.get_sg_game_leaderboard()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_result jsonb;
begin
  with ranked as (
    select
      p.id,
      p.nickname,
      p.avatar_path,
      p.creator_verified,
      p.avatar_moderation_status,
      coalesce((
        select sum((value)::integer)
        from jsonb_each_text(p.cards)
      ), 0)::integer as card_count,
      dense_rank() over (
        order by coalesce((
          select sum((value)::integer)
          from jsonb_each_text(p.cards)
        ), 0) desc
      )::integer as position
    from public.sg_game_profiles p
  )
  select jsonb_build_object(
    'top', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', id,
          'nickname', nickname,
          'avatar_path', case
            when avatar_moderation_status = 'approved' then avatar_path
            else null
          end,
          'creator_verified', creator_verified,
          'card_count', card_count,
          'position', position
        )
        order by position
      )
      from ranked
      where position <= 100
    ), '[]'::jsonb),
    'mine', (
      select to_jsonb(ranked)
      from ranked
      where id = v_user_id
      limit 1
    )
  )
  into v_result;

  return v_result;
end;
$$;

revoke all on function public.get_sg_game_leaderboard() from public, anon;
grant execute on function public.get_sg_game_leaderboard() to anon, authenticated;
