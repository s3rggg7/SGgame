create table if not exists public.sg_game_profiles (
  id uuid primary key references auth.users(id),
  coins integer not null default 0 check (coins >= 0),
  cards jsonb not null default '{}'::jsonb check (jsonb_typeof(cards) = 'object'),
  last_chest jsonb,
  created_at timestamptz not null default now()
);

alter table public.sg_game_profiles enable row level security;
revoke all on public.sg_game_profiles from anon, authenticated;
grant select on public.sg_game_profiles to authenticated;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'sg_game_profiles'
      and policyname = 'Players can read their own profile'
  ) then
    execute 'create policy "Players can read their own profile" on public.sg_game_profiles for select to authenticated using (auth.uid() = id)';
  end if;
end
$$;

create or replace function public.create_sg_game_profile()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.sg_game_profiles (id)
  values (new.id)
  on conflict (id) do nothing;
  return new;
end;
$$;

revoke all on function public.create_sg_game_profile() from public, anon, authenticated;
do $$
begin
  if not exists (
    select 1
    from pg_trigger
    where tgname = 'on_auth_user_created_sg_game_profile'
      and tgrelid = 'auth.users'::regclass
      and not tgisinternal
  ) then
    execute 'create trigger on_auth_user_created_sg_game_profile after insert on auth.users for each row execute function public.create_sg_game_profile()';
  end if;
end
$$;

insert into public.sg_game_profiles (id)
select id from auth.users
on conflict (id) do nothing;

create or replace function public.open_daily_chest()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_coins integer;
  v_cards jsonb;
  v_last_chest jsonb;
  v_reward jsonb;
  v_today text := ((now() at time zone 'utc')::date)::text;
  v_roll numeric;
  v_game_ids text[] := array['sbk-training', 'cookies-and-crabs', 'strike-and-shatter'];
  v_game_id text;
  v_rarity text;
  v_card_id text;
begin
  if v_user_id is null then
    raise exception using errcode = 'P0001', message = 'authentication_required';
  end if;

  select coins, cards, last_chest
  into v_coins, v_cards, v_last_chest
  from public.sg_game_profiles
  where id = v_user_id
  for update;

  if not found then
    raise exception using errcode = 'P0001', message = 'profile_not_found';
  end if;

  if v_last_chest ->> 'date' = v_today then
    raise exception using errcode = 'P0001', message = 'daily_chest_already_opened';
  end if;

  v_roll := random() * 100;
  if v_roll < 60 then
    v_game_id := v_game_ids[1 + floor(random() * array_length(v_game_ids, 1))::integer];
    v_rarity := case
      when v_roll < 30 then 'common'
      when v_roll < 50 then 'rare'
      else 'legendary'
    end;
    v_card_id := v_game_id || '-' || v_rarity;
    v_cards := jsonb_set(
      v_cards,
      array[v_card_id],
      to_jsonb(coalesce((v_cards ->> v_card_id)::integer, 0) + 1),
      true
    );
    v_reward := jsonb_build_object(
      'date', v_today,
      'type', 'card',
      'gameId', v_game_id,
      'cardId', v_card_id,
      'rarity', v_rarity
    );
  else
    v_reward := jsonb_build_object(
      'date', v_today,
      'type', 'coins',
      'amount', floor(random() * 21)::integer + 10
    );
    v_coins := v_coins + (v_reward ->> 'amount')::integer;
  end if;

  update public.sg_game_profiles
  set coins = v_coins,
      cards = v_cards,
      last_chest = v_reward
  where id = v_user_id;

  return jsonb_build_object(
    'coins', v_coins,
    'cards', v_cards,
    'last_chest', v_reward,
    'reward', v_reward
  );
end;
$$;

create or replace function public.buy_sg_game_card(p_card_id text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_coins integer;
  v_cards jsonb;
  v_last_chest jsonb;
  v_price integer;
begin
  if v_user_id is null then
    raise exception using errcode = 'P0001', message = 'authentication_required';
  end if;

  if p_card_id is null or not (p_card_id = any (array[
    'sbk-training-common', 'sbk-training-rare', 'sbk-training-legendary',
    'cookies-and-crabs-common', 'cookies-and-crabs-rare', 'cookies-and-crabs-legendary',
    'strike-and-shatter-common', 'strike-and-shatter-rare', 'strike-and-shatter-legendary'
  ])) then
    raise exception using errcode = 'P0001', message = 'invalid_card';
  end if;

  v_price := case
    when p_card_id like '%-common' then 30
    when p_card_id like '%-rare' then 75
    else 150
  end;

  select coins, cards, last_chest
  into v_coins, v_cards, v_last_chest
  from public.sg_game_profiles
  where id = v_user_id
  for update;

  if not found then
    raise exception using errcode = 'P0001', message = 'profile_not_found';
  end if;

  if v_coins < v_price then
    raise exception using errcode = 'P0001', message = 'not_enough_sg_bucks';
  end if;

  v_coins := v_coins - v_price;
  v_cards := jsonb_set(
    v_cards,
    array[p_card_id],
    to_jsonb(coalesce((v_cards ->> p_card_id)::integer, 0) + 1),
    true
  );

  update public.sg_game_profiles
  set coins = v_coins,
      cards = v_cards
  where id = v_user_id;

  return jsonb_build_object(
    'coins', v_coins,
    'cards', v_cards,
    'last_chest', v_last_chest
  );
end;
$$;

revoke all on function public.open_daily_chest() from public, anon;
revoke all on function public.buy_sg_game_card(text) from public, anon;
grant execute on function public.open_daily_chest() to authenticated;
grant execute on function public.buy_sg_game_card(text) to authenticated;
