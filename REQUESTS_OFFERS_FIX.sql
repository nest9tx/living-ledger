-- COPY AND PASTE THIS ENTIRE BLOCK INTO SUPABASE SQL EDITOR
-- This will fix the schema cache issue for requests and offers tables

-- Drop the problematic tables
drop table if exists interactions cascade;
drop table if exists credit_escrow cascade;
drop table if exists offers cascade;
drop table if exists requests cascade;

-- Recreate requests table with all required columns
create table requests (
  id bigserial primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  description text,
  category_id bigint references categories(id) on delete set null,
  budget_credits integer not null default 0,
  status text default 'open',
  created_at timestamptz default now()
);

-- Recreate offers table with all required columns
create table offers (
  id bigserial primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  description text,
  category_id bigint references categories(id) on delete set null,
  price_credits integer not null default 0,
  created_at timestamptz default now()
);

-- Recreate interactions table
create table interactions (
  id bigserial primary key,
  request_id bigint references requests(id) on delete cascade,
  helper_id uuid references auth.users(id) on delete cascade,
  receiver_id uuid references auth.users(id) on delete cascade,
  description text,
  credits_awarded integer default 0,
  status text default 'pending',
  created_at timestamptz default now(),
  completed_at timestamptz
);

-- Recreate credit_escrow table
create table credit_escrow (
  id bigserial primary key,
  request_id bigint references requests(id) on delete cascade,
  payer_id uuid references auth.users(id) on delete cascade,
  provider_id uuid references auth.users(id) on delete cascade,
  credits_held integer not null,
  status text default 'held',
  released_at timestamptz,
  created_at timestamptz default now()
);

-- Enable RLS on all tables
alter table requests enable row level security;
alter table offers enable row level security;
alter table interactions enable row level security;
alter table credit_escrow enable row level security;

-- Create RLS policies for requests
create policy "Requests read" on requests
  for select
  using (true);

create policy "Requests insert" on requests
  for insert
  with check (auth.uid() = user_id);

create policy "Requests update" on requests
  for update
  using (auth.uid() = user_id);

-- Create RLS policies for offers
create policy "Offers read" on offers
  for select
  using (true);

create policy "Offers insert" on offers
  for insert
  with check (auth.uid() = user_id);

create policy "Offers update" on offers
  for update
  using (auth.uid() = user_id);

-- Create RLS policies for interactions
create policy "Interactions read" on interactions
  for select
  using (true);

create policy "Interactions insert" on interactions
  for insert
  with check (auth.uid() = helper_id);

-- Create RLS policies for credit_escrow
create policy "Credit escrow read" on credit_escrow
  for select
  using (auth.uid() = payer_id OR auth.uid() = provider_id);

create policy "Credit escrow insert" on credit_escrow
  for insert
  with check (auth.uid() = payer_id);
