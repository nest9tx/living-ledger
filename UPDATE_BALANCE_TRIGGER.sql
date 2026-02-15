-- Update balance trigger to handle earned vs purchased credits
-- Run in Supabase SQL Editor

create or replace function update_user_balance()
returns trigger as $$
begin
  -- Update credits_balance (total)
  update profiles
  set credits_balance = credits_balance + new.amount
  where id = new.user_id;
  
  -- Update earned_credits or purchased_credits based on source
  if new.credit_source = 'earned' and new.amount > 0 then
    update profiles
    set earned_credits = earned_credits + new.amount
    where id = new.user_id;
    
  elsif new.credit_source = 'purchase' and new.amount > 0 then
    update profiles
    set purchased_credits = purchased_credits + new.amount
    where id = new.user_user;
    
  elsif new.credit_source = 'refund' and new.amount > 0 then
    -- Refunds go back to purchased_credits
    update profiles
    set purchased_credits = purchased_credits + new.amount
    where id = new.user_id;
    
  elsif new.amount < 0 then
    -- For spending, deduct from purchased first, then earned
    update profiles
    set 
      purchased_credits = greatest(0, purchased_credits + new.amount),
      earned_credits = case
        when purchased_credits + new.amount < 0 then earned_credits + (purchased_credits + new.amount)
        else earned_credits
      end
    where id = new.user_id;
  end if;
  
  return new;
end;
$$ language plpgsql security definer;

-- Recreate trigger
drop trigger if exists transaction_balance_update on transactions;
create trigger transaction_balance_update
  after insert on transactions
  for each row
  execute function update_user_balance();

notify pgrst, 'reload schema';
