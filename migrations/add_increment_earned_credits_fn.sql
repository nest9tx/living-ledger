-- Atomic increment for earned_credits to avoid race conditions
-- Used by cashout reject to safely return credits

create or replace function increment_earned_credits(
  p_user_id uuid,
  p_amount int
)
returns void
language sql
security definer
as $$
  update profiles
  set earned_credits = coalesce(earned_credits, 0) + p_amount
  where id = p_user_id;
$$;
