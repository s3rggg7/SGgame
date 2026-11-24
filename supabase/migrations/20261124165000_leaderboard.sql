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
      coalesce((
        select sum((value)::integer)
        from jsonb_each_text(p.cards)
      ), 0)::integer as card_count,
      rank() over (
        order by coalesce((
          select sum((value)::integer)
          from jsonb_each_text(p.cards)
        ), 0) desc
      )::integer as position
    from public.sg_game_profiles p
  ),
  top_players as (
    select
      id,
      nickname,
      avatar_path,
      creator_verified,
      card_count,
      position
    from ranked
    where position <= 100
    order by position
  ),
  mine as (
    select
      id,
      nickname,
      avatar_path,
      creator_verified,
      card_count,
      position
    from ranked
    where id = v_user_id
  )
  select jsonb_build_object(
    'top', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', id,
          'nickname', nickname,
          'avatar_path', avatar_path,
          'creator_verified', creator_verified,
          'card_count', card_count,
          'position', position
        )
        order by position
      )
      from top_players
    ), '[]'::jsonb),
    'mine', (
      select to_jsonb(mine)
      from mine
      limit 1
    )
  )
  into v_result;

  return v_result;
end;
$$;

revoke all on function public.get_sg_game_leaderboard() from public, anon;
grant execute on function public.get_sg_game_leaderboard() to anon, authenticated;
