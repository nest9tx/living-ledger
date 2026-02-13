-- Ensure transactions update credits_balance via trigger
-- Run in Supabase SQL Editor

create or replace function update_user_balance()
returns trigger as $$
begin
  update profiles
  set credits_balance = credits_balance + new.amount
  where id = new.user_id;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists transaction_balance_update on transactions;
create trigger transaction_balance_update
  after insert on transactions
  for each row
  execute function update_user_balance();

-- Refresh schema cache
notify pgrst, 'reload schema';
