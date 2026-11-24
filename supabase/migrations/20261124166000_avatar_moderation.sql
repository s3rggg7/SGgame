alter table public.sg_game_profiles
  add column if not exists avatar_moderation_status text not null default 'approved',
  add constraint sg_game_profiles_avatar_moderation_status_valid
    check (avatar_moderation_status in ('pending', 'approved', 'rejected'));

create or replace function public.set_sg_game_avatar(p_avatar_path text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception using errcode = 'P0001', message = 'authentication_required';
  end if;

  if p_avatar_path is not null and p_avatar_path <> (v_user_id::text || '/avatar') then
    raise exception using errcode = 'P0001', message = 'invalid_avatar_path';
  end if;

  update public.sg_game_profiles
  set avatar_path = p_avatar_path,
      avatar_moderation_status = case
        when p_avatar_path is null then 'approved'
        else 'pending'
      end
  where id = v_user_id;

  if not found then
    raise exception using errcode = 'P0001', message = 'profile_not_found';
  end if;

  return jsonb_build_object(
    'avatar_path', p_avatar_path,
    'avatar_moderation_status', case when p_avatar_path is null then 'approved' else 'pending' end
  );
end;
$$;

revoke all on function public.set_sg_game_avatar(text) from public, anon;
grant execute on function public.set_sg_game_avatar(text) to authenticated;

create or replace function public.approve_sg_game_avatar(p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not exists (
    select 1
    from auth.users
    where id = auth.uid()
      and lower(email) = 'sergeizagorodkin082@gmail.com'
  ) then
    raise exception using errcode = 'P0001', message = 'creator_only';
  end if;

  update public.sg_game_profiles
  set avatar_moderation_status = 'approved'
  where id = p_user_id;

  if not found then
    raise exception using errcode = 'P0001', message = 'profile_not_found';
  end if;

  return jsonb_build_object('avatar_moderation_status', 'approved');
end;
$$;

create or replace function public.reject_sg_game_avatar(p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not exists (
    select 1
    from auth.users
    where id = auth.uid()
      and lower(email) = 'sergeizagorodkin082@gmail.com'
  ) then
    raise exception using errcode = 'P0001', message = 'creator_only';
  end if;

  update public.sg_game_profiles
  set avatar_moderation_status = 'rejected',
      avatar_path = null
  where id = p_user_id;

  if not found then
    raise exception using errcode = 'P0001', message = 'profile_not_found';
  end if;

  return jsonb_build_object('avatar_moderation_status', 'rejected');
end;
$$;

revoke all on function public.approve_sg_game_avatar(uuid) from public, anon;
revoke all on function public.reject_sg_game_avatar(uuid) from public, anon;
grant execute on function public.approve_sg_game_avatar(uuid) to authenticated;
grant execute on function public.reject_sg_game_avatar(uuid) to authenticated;
