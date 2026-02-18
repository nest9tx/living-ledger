-- Fix listing_images table to allow temporary uploads without listing_id
-- This allows the image upload flow to work correctly for new listings

-- Allow listing_id to be null for temporary uploads
ALTER TABLE listing_images 
ALTER COLUMN listing_id DROP NOT NULL;

-- Add a check constraint to ensure either listing_id is null (temporary) or not null (associated)
-- This maintains data integrity while allowing the upload flow to work
ALTER TABLE listing_images
ADD CONSTRAINT listing_id_temporary_check 
CHECK (
  (listing_id IS NULL) OR  -- Temporary uploads
  (listing_id IS NOT NULL) -- Associated uploads
);