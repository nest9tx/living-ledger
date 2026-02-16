-- Create ratings table for tracking contributions and trust scores
CREATE TABLE IF NOT EXISTS ratings (
  id BIGSERIAL PRIMARY KEY,
  escrow_id BIGINT NOT NULL REFERENCES credit_escrow(id) ON DELETE CASCADE,
  from_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  to_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  score INTEGER NOT NULL CHECK (score >= 1 AND score <= 5),
  comment TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Prevent duplicate ratings for the same escrow
  UNIQUE(escrow_id, from_user_id)
);

-- Index for fast queries
CREATE INDEX IF NOT EXISTS idx_ratings_to_user ON ratings(to_user_id);
CREATE INDEX IF NOT EXISTS idx_ratings_from_user ON ratings(from_user_id);
CREATE INDEX IF NOT EXISTS idx_ratings_escrow ON ratings(escrow_id);

-- RLS policies
ALTER TABLE ratings ENABLE ROW LEVEL SECURITY;

-- Users can view ratings they gave or received
CREATE POLICY "Users can view their ratings"
  ON ratings FOR SELECT
  USING (auth.uid() = from_user_id OR auth.uid() = to_user_id);

-- Users can create ratings for completed escrows
CREATE POLICY "Users can create ratings"
  ON ratings FOR INSERT
  WITH CHECK (auth.uid() = from_user_id);

-- Add trust score columns to profiles table
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS average_rating DECIMAL(3,2) DEFAULT 0.00,
ADD COLUMN IF NOT EXISTS total_ratings INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_contributions INTEGER DEFAULT 0;

-- Create function to update profile ratings
CREATE OR REPLACE FUNCTION update_profile_ratings()
RETURNS TRIGGER AS $$
BEGIN
  -- Update recipient's average rating and total
  UPDATE profiles
  SET 
    average_rating = (
      SELECT COALESCE(AVG(score), 0)
      FROM ratings
      WHERE to_user_id = NEW.to_user_id
    ),
    total_ratings = (
      SELECT COUNT(*)
      FROM ratings
      WHERE to_user_id = NEW.to_user_id
    )
  WHERE id = NEW.to_user_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-update ratings
CREATE TRIGGER trigger_update_profile_ratings
AFTER INSERT ON ratings
FOR EACH ROW
EXECUTE FUNCTION update_profile_ratings();

-- Create function to update contribution counts
CREATE OR REPLACE FUNCTION update_contribution_counts()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'released' THEN
    -- Increment provider's contribution count
    UPDATE profiles
    SET total_contributions = total_contributions + 1
    WHERE id = NEW.provider_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-update contribution counts
CREATE TRIGGER trigger_update_contribution_counts
AFTER UPDATE OF status ON credit_escrow
FOR EACH ROW
WHEN (OLD.status IS DISTINCT FROM NEW.status AND NEW.status = 'released')
EXECUTE FUNCTION update_contribution_counts();
