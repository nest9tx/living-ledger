-- Daily post limits + duplicate prevention
-- Run in Supabase SQL Editor

-- Add content hash columns
alter table offers
add column if not exists content_hash text;

alter table requests
add column if not exists content_hash text;

-- Indexes for fast checks
create index if not exists idx_offers_user_created_at
  on offers(user_id, created_at desc);

create index if not exists idx_requests_user_created_at
  on requests(user_id, created_at desc);

create index if not exists idx_offers_user_content_hash
  on offers(user_id, content_hash, created_at desc);

create index if not exists idx_requests_user_content_hash
  on requests(user_id, content_hash, created_at desc);

-- Enforce daily limit + duplicate detection
create or replace function enforce_post_limits_and_dedup()
returns trigger as $$
declare
  daily_count int;
  dup_count int;
  normalized text;
begin
  normalized := md5(lower(coalesce(new.title, '') || '|' || coalesce(new.description, '')));
  new.content_hash := normalized;

  execute format(
    'select count(*) from %I where user_id = $1 and created_at >= date_trunc(''day'', now())',
    TG_TABLE_NAME
  ) into daily_count using new.user_id;

  if daily_count >= 3 then
    raise exception 'Daily post limit reached (max 3 per day).';
  end if;

  execute format(
    'select count(*) from %I where user_id = $1 and content_hash = $2 and created_at >= now() - interval ''7 days''',
    TG_TABLE_NAME
  ) into dup_count using new.user_id, new.content_hash;

  if dup_count > 0 then
    raise exception 'Duplicate post detected. Please wait before reposting the same listing.';
  end if;

  return new;
end;
$$ language plpgsql;

-- Attach triggers
drop trigger if exists trg_offers_post_limits on offers;
create trigger trg_offers_post_limits
  before insert on offers
  for each row
  execute function enforce_post_limits_and_dedup();

drop trigger if exists trg_requests_post_limits on requests;
create trigger trg_requests_post_limits
  before insert on requests
  for each row
  execute function enforce_post_limits_and_dedup();

-- Refresh schema cache
notify pgrst, 'reload schema';
