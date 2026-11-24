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
    'id', id,
    'nickname', nickname,
    'avatar_path', avatar_path,
    'creator_verified', creator_verified
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
alter table public.sg_game_profiles
  add column if not exists creator_verified boolean not null default false;

