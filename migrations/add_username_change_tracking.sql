-- Add username change tracking to profiles
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS username_changed_at timestamptz,
  ADD COLUMN IF NOT EXISTS username_change_count int NOT NULL DEFAULT 0;

-- Ensure username is unique (add constraint if not already present)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'profiles_username_key'
  ) THEN
    ALTER TABLE profiles ADD CONSTRAINT profiles_username_key UNIQUE (username);
  END IF;
END$$;

NOTIFY pgrst, 'reload schema';
