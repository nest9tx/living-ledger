-- Separate earned vs purchased credits for cashout policy
-- Run in Supabase SQL Editor

-- Add new columns to profiles
alter table profiles
  add column if not exists earned_credits int not null default 0,
  add column if not exists purchased_credits int not null default 0;

-- Migrate existing credits_balance to purchased_credits (safer assumption - treat existing as purchased)
update profiles
set purchased_credits = credits_balance
where purchased_credits = 0 and credits_balance > 0;

-- Keep total_credits as computed view for backward compatibility
-- We'll phase out direct usage of total_credits and use earned + purchased instead

-- Add credit_source column to transactions table to track origin
alter table transactions
  add column if not exists credit_source text check (credit_source in ('purchase', 'earned', 'refund'));

-- Update existing transactions to mark them appropriately
-- Stripe purchases are 'purchase'
update transactions
set credit_source = 'purchase'
where transaction_type = 'purchase' and credit_source is null;

-- Refunds are 'refund' (treated as purchased credits returned)
update transactions
set credit_source = 'refund'
where transaction_type = 'refund' and credit_source is null;

-- Add function to calculate cashout-eligible balance (only earned credits)
create or replace function get_cashout_balance(user_id uuid)
returns int
language plpgsql
security definer
as $$
declare
  balance int;
begin
  select earned_credits into balance
  from profiles
  where id = user_id;
  
  return coalesce(balance, 0);
end;
$$;

-- Add indexes for performance
create index if not exists idx_transactions_credit_source
  on transactions(credit_source);

notify pgrst, 'reload schema';
