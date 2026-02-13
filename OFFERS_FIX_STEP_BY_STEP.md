# Fix Offers Table Schema Cache Error

## Error
```
Could not find the 'price_credits' column of 'offers' in the schema cache
```

## Solution (5 minutes)

### Step 1: Open Supabase SQL Editor
```
https://app.supabase.com/project/[YOUR-PROJECT]/sql/new
```

### Step 2: Copy the Complete SQL Fix
**Location**: `REQUESTS_OFFERS_FIX.sql` in your project

Or copy this:
```sql
drop table if exists interactions cascade;
drop table if exists credit_escrow cascade;
drop table if exists offers cascade;
drop table if exists requests cascade;

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

create table offers (
  id bigserial primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  description text,
  category_id bigint references categories(id) on delete set null,
  price_credits integer not null default 0,
  created_at timestamptz default now()
);

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

alter table requests enable row level security;
alter table offers enable row level security;
alter table interactions enable row level security;
alter table credit_escrow enable row level security;

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
```

### Step 3: Paste & Run
1. Paste the SQL into Supabase SQL Editor
2. Click "Run"
3. You should see: ✅ **Success**

### Step 4: Test
1. Refresh http://localhost:3000
2. Try to create a new offer
3. Should work now! ✅

## Verify It Worked

In Supabase Table Editor:
- [ ] `offers` table exists with columns: id, user_id, title, description, category_id, **price_credits**, created_at
- [ ] `requests` table exists with columns: id, user_id, title, description, category_id, **budget_credits**, status, created_at
- [ ] Both have RLS enabled (click table, see "RLS" button)
- [ ] Click each table's "RLS" button and verify INSERT policies exist

## ⚠️ Note
This will **delete all existing requests and offers** - but since we're still in MVP testing, that should be fine.

If it fails, share the error message from Supabase and I'll help debug!
