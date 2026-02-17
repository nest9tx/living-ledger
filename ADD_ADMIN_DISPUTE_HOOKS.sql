-- Admin + dispute hooks
-- Run in Supabase SQL Editor

-- Add admin flag to profiles
alter table profiles
add column if not exists is_admin boolean default false;

-- Add bank account fields for cashouts (encrypted sensitive data)
alter table profiles
add column if not exists bank_account_name text,
add column if not exists bank_account_last4 text,
add column if not exists bank_routing_number text,
add column if not exists bank_account_type text, -- 'checking' or 'savings'
add column if not exists bank_connected_at timestamptz,
add column if not exists stripe_customer_id text;

-- Add dispute tracking fields to escrow
alter table credit_escrow
add column if not exists dispute_status text,
add column if not exists dispute_reason text,
add column if not exists disputed_at timestamptz,
add column if not exists resolved_at timestamptz,
add column if not exists admin_note text;

-- Refresh schema cache
notify pgrst, 'reload schema';
