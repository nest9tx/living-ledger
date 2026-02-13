-- Add credits system to database
-- Run this in Supabase SQL Editor

-- Step 1: Add credits_balance to profiles table
alter table profiles 
add column if not exists credits_balance integer default 0;

-- Step 2: Create transactions table
create table if not exists transactions (
  id bigserial primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  amount integer not null,
  description text not null,
  transaction_type text not null, -- 'purchase', 'earned', 'spent', 'refund', 'platform_fee'
  related_offer_id bigint references offers(id) on delete set null,
  related_request_id bigint references requests(id) on delete set null,
  stripe_payment_intent_id text, -- For tracking real money transactions
  can_cashout boolean default false, -- Only earned credits can be cashed out
  created_at timestamptz default now()
);

-- Step 3: Enable RLS on transactions
alter table transactions enable row level security;

-- Step 4: Add transactions policies
create policy "Transactions read own" on transactions
  for select
  using (auth.uid() = user_id);

create policy "Transactions insert own" on transactions
  for insert
  with check (auth.uid() = user_id);

-- Step 5: Give existing users 0 starting credits (they must buy credits)
update profiles 
set credits_balance = 0 
where credits_balance is null;

-- Note: New users start with 0 credits
-- To request services, users must purchase credits with real money via Stripe
-- To offer services, users can earn credits and cash them out for real money
-- This ensures every credit in the system = real value

-- Step 6: Create a function to update balance automatically on transaction
create or replace function update_user_balance()
returns trigger as $$
begin
  update profiles
  set credits_balance = credits_balance + new.amount
  where id = new.user_id;
  return new;
end;
$$ language plpgsql security definer;

-- Step 7: Create trigger to auto-update balance
drop trigger if exists transaction_balance_update on transactions;
create trigger transaction_balance_update
  after insert on transactions
  for each row
  execute function update_user_balance();

-- Success! Credits system is now active.
