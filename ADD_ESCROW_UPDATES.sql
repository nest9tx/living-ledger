-- Escrow updates: add offer support + release delay
-- Run in Supabase SQL Editor

alter table credit_escrow
add column if not exists offer_id bigint references offers(id) on delete cascade,
add column if not exists release_available_at timestamptz,
add column if not exists buyer_confirmed_at timestamptz,
add column if not exists provider_marked_complete_at timestamptz;

-- Ensure status default is set
alter table credit_escrow
alter column status set default 'held';

-- Refresh schema cache
notify pgrst, 'reload schema';
