alter table public.sg_game_profiles
  add column avatar_path text,
  add constraint sg_game_profiles_avatar_path_valid
    check (avatar_path is null or avatar_path = (id::text || '/avatar'));

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
    where id = v_user_id;
  exception when unique_violation then
    raise exception using errcode = 'P0001', message = 'nickname_taken';
  end;

  if not found then
    raise exception using errcode = 'P0001', message = 'profile_not_found';
  end if;

  return jsonb_build_object('nickname', v_nickname);
end;
$$;

revoke all on function public.set_sg_game_nickname(text) from public, anon;
grant execute on function public.set_sg_game_nickname(text) to authenticated;

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
  set avatar_path = p_avatar_path
  where id = v_user_id;

  if not found then
    raise exception using errcode = 'P0001', message = 'profile_not_found';
  end if;

  return jsonb_build_object('avatar_path', p_avatar_path);
end;
$$;

revoke all on function public.set_sg_game_avatar(text) from public, anon;
grant execute on function public.set_sg_game_avatar(text) to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'sg-game-avatars',
  'sg-game-avatars',
  false,
  2097152,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set public = false,
    file_size_limit = 2097152,
    allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp'];

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'SG game avatar owners can read'
  ) then
    execute $policy$
      create policy "SG game avatar owners can read"
      on storage.objects for select to authenticated
      using (bucket_id = 'sg-game-avatars' and name = (select auth.uid()::text) || '/avatar')
    $policy$;
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'SG game avatar owners can upload'
  ) then
    execute $policy$
      create policy "SG game avatar owners can upload"
      on storage.objects for insert to authenticated
      with check (bucket_id = 'sg-game-avatars' and name = (select auth.uid()::text) || '/avatar')
    $policy$;
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'SG game avatar owners can replace'
  ) then
    execute $policy$
      create policy "SG game avatar owners can replace"
      on storage.objects for update to authenticated
      using (bucket_id = 'sg-game-avatars' and name = (select auth.uid()::text) || '/avatar')
      with check (bucket_id = 'sg-game-avatars' and name = (select auth.uid()::text) || '/avatar')
    $policy$;
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'SG game avatar owners can delete'
  ) then
    execute $policy$
      create policy "SG game avatar owners can delete"
      on storage.objects for delete to authenticated
      using (bucket_id = 'sg-game-avatars' and name = (select auth.uid()::text) || '/avatar')
    $policy$;
  end if;
end
$$;
