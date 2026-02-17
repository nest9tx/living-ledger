-- Admin + dispute hooks
-- Run in Supabase SQL Editor

-- Add admin flag to profiles
alter table profiles
add column if not exists is_admin boolean default false;

-- Add Stripe Connect fields for automated cashouts
alter table profiles
add column if not exists stripe_account_id text, -- Stripe Connect account ID
add column if not exists stripe_account_status text, -- 'pending', 'active', 'disabled'
add column if not exists stripe_connected_at timestamptz,
add column if not exists stripe_onboarding_complete boolean default false;

-- Add dispute tracking fields to escrow
alter table credit_escrow
add column if not exists dispute_status text,
add column if not exists dispute_reason text,
add column if not exists disputed_at timestamptz,
add column if not exists resolved_at timestamptz,
add column if not exists admin_note text;

-- Refresh schema cache
notify pgrst, 'reload schema';
