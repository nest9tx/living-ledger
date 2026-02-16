-- Cashout system with admin approval
-- Run in Supabase SQL Editor

-- Add stripe_connect_account_id to profiles
alter table profiles
  add column if not exists stripe_connect_account_id text unique;

-- Create cashout_requests table
create table if not exists cashout_requests (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  amount_credits int not null check (amount_credits >= 20),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'paid')),
  stripe_transfer_id text,
  admin_id uuid references auth.users(id) on delete set null,
  admin_note text,
  requested_at timestamptz not null default now(),
  reviewed_at timestamptz,
  paid_at timestamptz,
  created_at timestamptz not null default now()
);

-- Indexes
create index if not exists idx_cashout_requests_user
  on cashout_requests(user_id, status);

create index if not exists idx_cashout_requests_status
  on cashout_requests(status, requested_at desc);

create index if not exists idx_cashout_requests_stripe
  on cashout_requests(stripe_transfer_id) where stripe_transfer_id is not null;

-- Enable RLS
alter table cashout_requests enable row level security;

-- Users can view their own cashout requests
create policy "Users view own cashout requests"
  on cashout_requests for select
  using (auth.uid() = user_id);

-- Users can create cashout requests
create policy "Users create cashout requests"
  on cashout_requests for insert
  with check (auth.uid() = user_id);

-- Admins can view all cashout requests
create policy "Admins view all cashout requests"
  on cashout_requests for select
  using (exists (
    select 1 from profiles where id = auth.uid() and is_admin = true
  ));

-- Admins can update cashout requests
create policy "Admins update cashout requests"
  on cashout_requests for update
  using (exists (
    select 1 from profiles where id = auth.uid() and is_admin = true
  ));

-- Function to deduct earned credits when cashout is requested
create or replace function create_cashout_request(
  p_user_id uuid,
  p_amount_credits int
)
returns table (
  request_id bigint,
  success boolean,
  message text
) as $$
declare
  v_earned int;
  v_request_id bigint;
begin
  -- Check earned credits
  select earned_credits into v_earned
  from profiles
  where id = p_user_id;
  
  if v_earned is null then
    return query select null::bigint, false, 'User not found'::text;
    return;
  end if;
  
  if v_earned < 20 then
    return query select null::bigint, false, 'Minimum cashout is $20'::text;
    return;
  end if;
  
  if p_amount_credits > v_earned then
    return query select null::bigint, false, 'Insufficient earned credits'::text;
    return;
  end if;
  
  -- Create cashout request
  insert into cashout_requests (user_id, amount_credits, status)
  values (p_user_id, p_amount_credits, 'pending')
  returning id into v_request_id;
  
  -- Deduct from earned credits (hold them in limbo pending approval)
  update profiles
  set earned_credits = earned_credits - p_amount_credits
  where id = p_user_id;
  
  -- Record transaction
  insert into transactions (user_id, amount, description, transaction_type, credit_source, can_cashout)
  values (p_user_id, -p_amount_credits, 'Cashout request pending approval', 'cashout_hold', 'earned', false);
  
  return query select v_request_id, true, 'Cashout request submitted for admin review'::text;
end;
$$ language plpgsql security definer;

notify pgrst, 'reload schema';
