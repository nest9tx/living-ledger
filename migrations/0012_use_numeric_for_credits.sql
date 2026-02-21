-- Migration to support fractional credits and ensure accurate fee calculations.
-- All credit-related columns will be changed from INTEGER to NUMERIC(10, 2),
-- which allows for up to 10 digits with 2 decimal places.

-- 1. Alter 'profiles' table
ALTER TABLE profiles
  ALTER COLUMN credits_balance TYPE NUMERIC(10, 2),
  ALTER COLUMN earned_credits TYPE NUMERIC(10, 2),
  ALTER COLUMN purchased_credits TYPE NUMERIC(10, 2);

-- 2. Alter 'transactions' table
ALTER TABLE transactions
  ALTER COLUMN amount TYPE NUMERIC(10, 2);

-- 3. Alter 'offers' table
ALTER TABLE offers
  ALTER COLUMN price_credits TYPE NUMERIC(10, 2);

-- 4. Alter 'requests' table
ALTER TABLE requests
  ALTER COLUMN budget_credits TYPE NUMERIC(10, 2);

-- 5. Alter 'credit_escrow' table
ALTER TABLE credit_escrow
  ALTER COLUMN credits_held TYPE NUMERIC(10, 2);

-- 6. Alter 'listing_boosts' table
ALTER TABLE listing_boosts
  ALTER COLUMN credits_spent TYPE NUMERIC(10, 2);

-- 7. Alter 'cashout_requests' table
ALTER TABLE cashout_requests
  ALTER COLUMN amount_credits TYPE NUMERIC(10, 2);

-- 8. Update 'update_balance' function to handle NUMERIC type.
-- Admin adjustments bypass the trigger entirely (the API does direct profile updates)
-- to prevent double-counting. All other transaction types are routed normally.
CREATE OR REPLACE FUNCTION update_balance()
RETURNS TRIGGER AS $$
BEGIN
  -- Admin adjustments update profiles directly via the API.
  -- Return early to prevent double-counting.
  IF NEW.transaction_type = 'admin_adjustment' THEN
    RETURN NEW;
  END IF;

  IF NEW.amount > 0 THEN
    IF NEW.credit_source = 'earned' THEN
      UPDATE profiles
        SET earned_credits  = earned_credits  + NEW.amount,
            credits_balance = credits_balance + NEW.amount
        WHERE id = NEW.user_id;
    ELSIF NEW.credit_source IN ('purchase', 'refund') THEN
      UPDATE profiles
        SET purchased_credits = purchased_credits + NEW.amount,
            credits_balance   = credits_balance   + NEW.amount
        WHERE id = NEW.user_id;
    ELSE
      -- No specific source: update total balance only
      UPDATE profiles
        SET credits_balance = credits_balance + NEW.amount
        WHERE id = NEW.user_id;
    END IF;

  ELSIF NEW.amount < 0 THEN
    -- General spend: waterfall purchased → earned
    DECLARE
      v_purchased NUMERIC;
      v_earned    NUMERIC;
      v_debit     NUMERIC := ABS(NEW.amount);
      v_from_p    NUMERIC;
      v_from_e    NUMERIC;
    BEGIN
      SELECT purchased_credits, earned_credits
        INTO v_purchased, v_earned
        FROM profiles WHERE id = NEW.user_id;

      v_from_p := LEAST(v_debit, GREATEST(v_purchased, 0));
      v_from_e := v_debit - v_from_p;

      UPDATE profiles
        SET purchased_credits = purchased_credits - v_from_p,
            earned_credits    = earned_credits    - v_from_e,
            credits_balance   = credits_balance   + NEW.amount
        WHERE id = NEW.user_id;
    END;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 9. Update 'request_cashout' function to handle NUMERIC type
DROP FUNCTION IF EXISTS request_cashout(uuid, integer);
DROP FUNCTION IF EXISTS request_cashout(uuid, numeric);
CREATE OR REPLACE FUNCTION request_cashout(p_user_id uuid, p_amount_credits numeric)
RETURNS TABLE(request_id bigint, success boolean, message text) AS $$
DECLARE
  v_earned NUMERIC;
  v_min_cashout_amount NUMERIC := 20.00;
  new_request_id bigint;
BEGIN
  -- Validate input
  IF p_user_id IS NULL OR p_amount_credits IS NULL THEN
    RETURN QUERY SELECT NULL::bigint, FALSE, 'User ID and amount are required.'::text;
    RETURN;
  END IF;

  IF p_amount_credits < v_min_cashout_amount THEN
      RETURN QUERY SELECT NULL::bigint, FALSE, 'Minimum cashout amount is 20 credits.'::text;
      RETURN;
  END IF;

  -- Check earned credits
  SELECT earned_credits INTO v_earned
  FROM profiles
  WHERE id = p_user_id;

  -- Ensure user exists
  IF NOT FOUND THEN
    RETURN QUERY SELECT NULL::bigint, FALSE, 'User not found.'::text;
    RETURN;
  END IF;

  -- Check for sufficient balance
  IF p_amount_credits > v_earned THEN
    RETURN QUERY SELECT NULL::bigint, FALSE, 'Insufficient earned credits.'::text;
    RETURN;
  END IF;

  -- Create cashout request
  INSERT INTO cashout_requests (user_id, amount_credits, status)
  VALUES (p_user_id, p_amount_credits, 'pending')
  RETURNING id INTO new_request_id;

  -- Deduct from earned credits (hold them in limbo pending approval)
  UPDATE profiles
  SET earned_credits = earned_credits - p_amount_credits
  WHERE id = p_user_id;

  RETURN QUERY SELECT new_request_id, TRUE, 'Cashout request created successfully.'::text;
END;
$$ LANGUAGE plpgsql;

-- 10. Update 'get_cashout_balance' function to return NUMERIC
DROP FUNCTION IF EXISTS get_cashout_balance(uuid);
CREATE OR REPLACE FUNCTION get_cashout_balance(p_user_id uuid)
RETURNS NUMERIC AS $$
DECLARE
  balance NUMERIC;
BEGIN
  SELECT earned_credits INTO balance
  FROM profiles
  WHERE id = p_user_id;
  RETURN COALESCE(balance, 0);
END;
$$ LANGUAGE plpgsql;

-- 11. Update 'increment_earned_credits' function to handle NUMERIC
DROP FUNCTION IF EXISTS increment_earned_credits(uuid, integer);
DROP FUNCTION IF EXISTS increment_earned_credits(uuid, numeric);
CREATE OR REPLACE FUNCTION increment_earned_credits(p_user_id uuid, p_amount numeric)
RETURNS void AS $$
BEGIN
  UPDATE profiles
  SET earned_credits = earned_credits + p_amount
  WHERE id = p_user_id;
END;
$$ LANGUAGE plpgsql;

-- Note: No changes needed for functions that don't directly interact with credit types,
-- like 'get_user_role', 'is_admin', etc. The trigger 'on_transaction_created'
-- correctly calls 'update_balance' which is now updated.
