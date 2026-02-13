-- Living Ledger schema (initial MVP)

create table if not exists profiles (
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

create table if not exists transactions (
  id bigserial primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  amount integer not null,
  description text not null,
  transaction_type text not null,
  related_offer_id bigint references offers(id) on delete set null,
  related_request_id bigint references requests(id) on delete set null,
  created_at timestamptz default now()
);

create table if not exists categories (
  id bigserial primary key,
  name text not null unique,
  icon text,
  created_at timestamptz default now()
);

create table if not exists requests (
  id bigserial primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  description text,
  category_id bigint references categories(id) on delete set null,
  budget_credits integer not null default 0,
  status text default 'open',
  created_at timestamptz default now()
);

create table if not exists offers (
  id bigserial primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  description text,
  category_id bigint references categories(id) on delete set null,
  price_credits integer not null default 0,
  created_at timestamptz default now()
);

create table if not exists interactions (
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

create table if not exists credit_escrow (
  id bigserial primary key,
  request_id bigint references requests(id) on delete cascade,
  payer_id uuid references auth.users(id) on delete cascade,
  provider_id uuid references auth.users(id) on delete cascade,
  credits_held integer not null,
  status text default 'held',
  released_at timestamptz,
  created_at timestamptz default now()
);

alter table profiles enable row level security;
alter table transactions enable row level security;
alter table categories enable row level security;
alter table requests enable row level security;
alter table offers enable row level security;
alter table interactions enable row level security;
alter table credit_escrow enable row level security;

create policy "Profiles read all" on profiles
  for select
  using (true);

create policy "Profiles insert" on profiles
  for insert
  with check (auth.uid() = id);

create policy "Profiles update" on profiles
  for update
  using (auth.uid() = id);

create policy "Transactions access" on transactions
  for select
  using (auth.uid() = user_id);

create policy "Transactions insert" on transactions
  for insert
  with check (auth.uid() = user_id);

create policy "Categories read" on categories
  for select
  using (true);

create policy "Categories insert" on categories
  for insert
  with check (auth.uid() is not null);

create policy "Requests read" on requests
  for select
  using (true);

create policy "Requests insert" on requests
  for insert
  with check (auth.uid() = user_id);

create policy "Requests update" on requests
  for update
  using (auth.uid() = user_id);

create policy "Offers read" on offers
  for select
  using (true);

create policy "Offers insert" on offers
  for insert
  with check (auth.uid() = user_id);

create policy "Offers update" on offers
  for update
  using (auth.uid() = user_id);

create policy "Interactions read" on interactions
  for select
  using (true);

create policy "Interactions insert" on interactions
  for insert
  with check (auth.uid() = helper_id);

create policy "Credit escrow read" on credit_escrow
  for select
  using (auth.uid() = payer_id OR auth.uid() = provider_id);

create policy "Credit escrow insert" on credit_escrow
  for insert
  with check (auth.uid() = payer_id);
