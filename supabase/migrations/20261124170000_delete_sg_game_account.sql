create or replace function public.can_delete_sg_game_account()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select auth.uid() is not null
    and exists (select 1 from auth.users where id = auth.uid());
$$;

revoke all on function public.can_delete_sg_game_account() from public, anon, authenticated;
grant execute on function public.can_delete_sg_game_account() to authenticated;

create or replace function public.delete_sg_game_account()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception using errcode = 'P0001', message = 'authentication_required';
  end if;

  delete from public.sg_game_profiles
  where id = v_user_id;

  delete from auth.users
  where id = v_user_id;

  if not found then
    raise exception using errcode = 'P0001', message = 'account_not_found';
  end if;

  return pg_catalog.jsonb_build_object('deleted', true);
end;
$$;

revoke all on function public.delete_sg_game_account() from public, anon, authenticated;
grant execute on function public.delete_sg_game_account() to authenticated;
