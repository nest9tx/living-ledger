-- Backfill credit_source for existing transactions and fix earned credits
-- Run in Supabase SQL Editor

-- Mark earned transactions
update transactions
set credit_source = 'earned'
where transaction_type = 'earned' and credit_source is null;

-- Recalculate earned_credits and purchased_credits from transaction history
-- This will properly attribute all past transactions

-- First, reset to 0
update profiles
set earned_credits = 0, purchased_credits = 0;

-- Add up all earned credits (positive amounts from 'earned' source)
update profiles p
set earned_credits = coalesce((
  select sum(amount)
  from transactions
  where user_id = p.id
    and credit_source = 'earned'
    and amount > 0
), 0);

-- Add up all purchased credits (positive amounts from 'purchase' source)
update profiles p
set purchased_credits = coalesce((
  select sum(amount)
  from transactions
  where user_id = p.id
    and credit_source = 'purchase'
    and amount > 0
), 0);

-- Add refunds back to purchased
update profiles p
set purchased_credits = purchased_credits + coalesce((
  select sum(amount)
  from transactions
  where user_id = p.id
    and credit_source = 'refund'
    and amount > 0
), 0);

-- Deduct all spending (negative transactions)
-- This is tricky - we need to deduct from purchased first, then earned
-- For simplicity, we'll deduct the total spending from the combined balance
-- The trigger will handle future transactions correctly

update profiles p
set purchased_credits = greatest(0, purchased_credits + coalesce((
  select sum(amount)
  from transactions
  where user_id = p.id
    and amount < 0
), 0));

-- If purchased went negative, move that to earned
update profiles
set 
  earned_credits = earned_credits + purchased_credits,
  purchased_credits = 0
where purchased_credits < 0;

notify pgrst, 'reload schema';
