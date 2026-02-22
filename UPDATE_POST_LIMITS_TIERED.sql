-- ============================================================
-- Tiered daily post limits
-- Run this in the Supabase SQL Editor to update the trigger.
-- ============================================================
-- Tiers:
--   New member     (0 completed orders)  →  5 posts / day
--   Active member  (1+ completed orders) → 10 posts / day
--   Trusted member (5+ ratings received) → unlimited
--
-- "Completed order" = any credit_escrow row with status = 'released'
--   where the user is either the buyer (payer_id) or provider.
-- "5+ ratings" = profiles.total_ratings >= 5
-- ============================================================

create or replace function enforce_post_limits_and_dedup()
returns trigger as $$
declare
  daily_count      int;
  dup_count        int;
  normalized       text;
  completed_count  int;
  user_ratings     int;
  daily_limit      int;
begin
  normalized := md5(lower(coalesce(new.title, '') || '|' || coalesce(new.description, '')));
  new.content_hash := normalized;

  -- How many ratings has this user received?
  select coalesce(total_ratings, 0)
    into user_ratings
    from profiles
   where id = new.user_id;

  -- How many completed (released) orders has this user participated in?
  select count(*)
    into completed_count
    from credit_escrow
   where (payer_id = new.user_id or provider_id = new.user_id)
     and status = 'released';

  -- Assign daily limit based on trust tier
  if user_ratings >= 5 then
    daily_limit := 2147483647;  -- effectively unlimited
  elsif completed_count >= 1 then
    daily_limit := 10;
  else
    daily_limit := 5;
  end if;

  -- Check today's post count for this table
  execute format(
    'select count(*) from %I where user_id = $1 and created_at >= date_trunc(''day'', now())',
    TG_TABLE_NAME
  ) into daily_count using new.user_id;

  if daily_count >= daily_limit then
    if daily_limit = 5 then
      raise exception 'Daily post limit reached (5/day for new members). Complete your first order to unlock 10 posts/day, or earn 5 ratings for unlimited posting.';
    else
      raise exception 'Daily post limit reached (10/day). Earn 5 ratings to unlock unlimited posting.';
    end if;
  end if;

  -- Duplicate detection (same title+description within 7 days)
  execute format(
    'select count(*) from %I where user_id = $1 and content_hash = $2 and created_at >= now() - interval ''7 days''',
    TG_TABLE_NAME
  ) into dup_count using new.user_id, new.content_hash;

  if dup_count > 0 then
    raise exception 'Duplicate post detected. Please wait before reposting the same listing.';
  end if;

  return new;
end;
$$ language plpgsql;

-- Triggers already exist from the original setup — no need to recreate them.
-- The function replacement above is all that's needed.
