-- COMPLETE DATABASE RESET - COPY AND PASTE EVERYTHING BELOW
-- This will completely rebuild all tables with proper relationships

-- Drop ALL tables to start fresh
drop table if exists transactions cascade;
drop table if exists credit_escrow cascade;
drop table if exists interactions cascade;
drop table if exists offers cascade;
drop table if exists requests cascade;
drop table if exists categories cascade;
drop table if exists profiles cascade;

-- Create profiles table
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text,
  bio text,
  avatar_url text,
  credits_balance integer default 100,
  onboarding_complete boolean default false,
  onboarding_role text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Create transactions table
create table transactions (
  id bigserial primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  amount integer not null,
  description text not null,
  transaction_type text not null,
  related_offer_id bigint,
  related_request_id bigint,
  created_at timestamptz default now()
);

-- Create categories table
create table categories (
  id bigserial primary key,
  name text not null unique,
  icon text,
  created_at timestamptz default now()
);

-- Create requests table
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

-- Create offers table
create table offers (
  id bigserial primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  description text,
  category_id bigint references categories(id) on delete set null,
  price_credits integer not null default 0,
  created_at timestamptz default now()
);

-- Create interactions table
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

-- Create credit_escrow table
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
alter table profiles enable row level security;
alter table transactions enable row level security;
alter table categories enable row level security;
alter table requests enable row level security;
alter table offers enable row level security;
alter table interactions enable row level security;
alter table credit_escrow enable row level security;

-- Profiles policies (everyone can read for usernames, only owner can update)
create policy "Profiles read all" on profiles
  for select
  using (true);

create policy "Profiles insert" on profiles
  for insert
  with check (auth.uid() = id);

create policy "Profiles update" on profiles
  for update
  using (auth.uid() = id);

-- Transactions policies
create policy "Transactions read own" on transactions
  for select
  using (auth.uid() = user_id);

create policy "Transactions insert own" on transactions
  for insert
  with check (auth.uid() = user_id);

-- Categories policies (allow public read, authenticated insert/update)
create policy "Categories read" on categories
  for select
  using (true);

create policy "Categories insert" on categories
  for insert
  with check (auth.uid() is not null);

create policy "Categories update" on categories
  for update
  using (auth.uid() is not null);

-- Requests policies
create policy "Requests read" on requests
  for select
  using (true);

create policy "Requests insert" on requests
  for insert
  with check (auth.uid() = user_id);

create policy "Requests update" on requests
  for update
  using (auth.uid() = user_id);

create policy "Requests delete" on requests
  for delete
  using (auth.uid() = user_id);

-- Offers policies
create policy "Offers read" on offers
  for select
  using (true);

create policy "Offers insert" on offers
  for insert
  with check (auth.uid() = user_id);

create policy "Offers update" on offers
  for update
  using (auth.uid() = user_id);

create policy "Offers delete" on offers
  for delete
  using (auth.uid() = user_id);

-- Interactions policies
create policy "Interactions read" on interactions
  for select
  using (true);

create policy "Interactions insert" on interactions
  for insert
  with check (auth.uid() = helper_id);

-- Credit escrow policies
create policy "Credit escrow read" on credit_escrow
  for select
  using (auth.uid() = payer_id OR auth.uid() = provider_id);

create policy "Credit escrow insert" on credit_escrow
  for insert
  with check (auth.uid() = payer_id);

-- Seed default categories (these will now succeed)
insert into categories (name, icon) values
  ('Skills & Learning', '📚'),
  ('Creative Work', '🎨'),
  ('Emotional Support', '💙'),
  ('Research & Writing', '✍️'),
  ('Organization & Planning', '📋'),
  ('Tech & Code', '💻'),
  ('Healing & Wellness', '🧘'),
  ('Community & Activism', '🌍')
on conflict (name) do nothing;
