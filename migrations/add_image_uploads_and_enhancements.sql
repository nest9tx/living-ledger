-- Enhanced Listings with Image Upload Support
-- Migration: Add image uploads, quantity, and expiration to listings

-- Add image support and enhancements to offers table
ALTER TABLE offers 
ADD COLUMN IF NOT EXISTS images JSONB DEFAULT '[]',
ADD COLUMN IF NOT EXISTS quantity INTEGER DEFAULT NULL,
ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '30 days'),
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;

-- Add image support and enhancements to requests table  
ALTER TABLE requests
ADD COLUMN IF NOT EXISTS images JSONB DEFAULT '[]',
ADD COLUMN IF NOT EXISTS quantity INTEGER DEFAULT NULL,
ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '30 days'),
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_offers_active ON offers(is_active, expires_at);
CREATE INDEX IF NOT EXISTS idx_requests_active ON requests(is_active, expires_at);
CREATE INDEX IF NOT EXISTS idx_offers_expires ON offers(expires_at) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_requests_expires ON requests(expires_at) WHERE is_active = TRUE;

-- Create table for listing images metadata (for better organization)
CREATE TABLE IF NOT EXISTS listing_images (
  id BIGSERIAL PRIMARY KEY,
  listing_type TEXT NOT NULL CHECK (listing_type IN ('offer', 'request')),
  listing_id BIGINT NOT NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL, -- Path in Supabase Storage
  filename TEXT NOT NULL,
  file_size BIGINT NOT NULL,
  mime_type TEXT NOT NULL,
  upload_order INTEGER DEFAULT 0, -- For ordering multiple images
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for listing images
CREATE INDEX IF NOT EXISTS idx_listing_images_offer ON listing_images(listing_type, listing_id) WHERE listing_type = 'offer';
CREATE INDEX IF NOT EXISTS idx_listing_images_request ON listing_images(listing_type, listing_id) WHERE listing_type = 'request';
CREATE INDEX IF NOT EXISTS idx_listing_images_user ON listing_images(user_id);

-- Add foreign key constraints (will be created via triggers since we have both offer and request tables)
-- Note: We'll handle referential integrity in application logic since listing_id points to different tables

-- Create table for message attachments (for image sharing in conversations)
CREATE TABLE IF NOT EXISTS message_attachments (
  id BIGSERIAL PRIMARY KEY,
  message_id BIGINT NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL, -- Path in Supabase Storage
  filename TEXT NOT NULL,
  file_size BIGINT NOT NULL,
  mime_type TEXT NOT NULL,
  attachment_type TEXT DEFAULT 'image' CHECK (attachment_type IN ('image', 'document', 'other')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for message attachments
CREATE INDEX IF NOT EXISTS idx_message_attachments_message ON message_attachments(message_id);
CREATE INDEX IF NOT EXISTS idx_message_attachments_user ON message_attachments(user_id);

-- Create table for work delivery files (finished products)
CREATE TABLE IF NOT EXISTS delivery_files (
  id BIGSERIAL PRIMARY KEY,
  escrow_id BIGINT NOT NULL REFERENCES credit_escrow(id) ON DELETE CASCADE,
  provider_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL, -- Path in Supabase Storage
  filename TEXT NOT NULL,
  file_size BIGINT NOT NULL,
  mime_type TEXT NOT NULL,
  delivery_message TEXT,
  upload_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for delivery files
CREATE INDEX IF NOT EXISTS idx_delivery_files_escrow ON delivery_files(escrow_id);
CREATE INDEX IF NOT EXISTS idx_delivery_files_provider ON delivery_files(provider_id);

-- Add delivery tracking to escrow table
ALTER TABLE credit_escrow
ADD COLUMN IF NOT EXISTS has_delivery BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMPTZ;

-- Create RLS policies for listing images
ALTER TABLE listing_images ENABLE ROW LEVEL SECURITY;

-- Users can view all listing images (public)
CREATE POLICY "listing_images_select" ON listing_images
  FOR SELECT USING (TRUE);

-- Users can only insert their own listing images
CREATE POLICY "listing_images_insert" ON listing_images
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can only update/delete their own listing images
CREATE POLICY "listing_images_update" ON listing_images
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "listing_images_delete" ON listing_images
  FOR DELETE USING (auth.uid() = user_id);

-- Create RLS policies for message attachments
ALTER TABLE message_attachments ENABLE ROW LEVEL SECURITY;

-- Users can view attachments in conversations they're part of
CREATE POLICY "message_attachments_select" ON message_attachments
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM messages m 
      WHERE m.id = message_id 
      AND (m.from_user_id = auth.uid() OR m.to_user_id = auth.uid())
    )
  );

-- Users can only insert attachments to their own messages
CREATE POLICY "message_attachments_insert" ON message_attachments
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can only delete their own attachments
CREATE POLICY "message_attachments_delete" ON message_attachments
  FOR DELETE USING (auth.uid() = user_id);

-- Create RLS policies for delivery files
ALTER TABLE delivery_files ENABLE ROW LEVEL SECURITY;

-- Both provider and buyer can view delivery files for their escrow
CREATE POLICY "delivery_files_select" ON delivery_files
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM credit_escrow e 
      WHERE e.id = escrow_id 
      AND (e.provider_id = auth.uid() OR e.payer_id = auth.uid())
    )
  );

-- Only the provider can insert delivery files
CREATE POLICY "delivery_files_insert" ON delivery_files
  FOR INSERT WITH CHECK (
    auth.uid() = provider_id AND
    EXISTS (
      SELECT 1 FROM credit_escrow e 
      WHERE e.id = escrow_id 
      AND e.provider_id = auth.uid()
      AND e.status = 'held'
    )
  );

-- Only the provider can update/delete their delivery files (before buyer acceptance)
CREATE POLICY "delivery_files_update" ON delivery_files
  FOR UPDATE USING (
    auth.uid() = provider_id AND
    EXISTS (
      SELECT 1 FROM credit_escrow e 
      WHERE e.id = escrow_id 
      AND e.status = 'held'
    )
  );

CREATE POLICY "delivery_files_delete" ON delivery_files
  FOR DELETE USING (
    auth.uid() = provider_id AND
    EXISTS (
      SELECT 1 FROM credit_escrow e 
      WHERE e.id = escrow_id 
      AND e.status = 'held'
    )
  );

-- Create function to automatically expire old listings
CREATE OR REPLACE FUNCTION expire_old_listings()
RETURNS void AS $$
BEGIN
  -- Mark expired offers as inactive
  UPDATE offers 
  SET is_active = FALSE 
  WHERE is_active = TRUE 
    AND expires_at < NOW();
    
  -- Mark expired requests as inactive  
  UPDATE requests 
  SET is_active = FALSE 
  WHERE is_active = TRUE 
    AND expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

-- Create a function that can be called via pg_cron (if available) or manually
-- This would ideally run daily to clean up expired listings
COMMENT ON FUNCTION expire_old_listings() IS 'Marks listings as inactive after their expiration date. Should be run daily.';

-- Function to clean up orphaned images (images without corresponding listings)
CREATE OR REPLACE FUNCTION cleanup_orphaned_images()
RETURNS void AS $$
BEGIN
  -- Delete listing images where the listing no longer exists
  DELETE FROM listing_images li
  WHERE (
    li.listing_type = 'offer' AND 
    NOT EXISTS (SELECT 1 FROM offers o WHERE o.id = li.listing_id)
  ) OR (
    li.listing_type = 'request' AND 
    NOT EXISTS (SELECT 1 FROM requests r WHERE r.id = li.listing_id)
  );
  
  -- Delete message attachments where the message no longer exists  
  DELETE FROM message_attachments ma
  WHERE NOT EXISTS (SELECT 1 FROM messages m WHERE m.id = ma.message_id);
  
  -- Delete delivery files where the escrow no longer exists
  DELETE FROM delivery_files df
  WHERE NOT EXISTS (SELECT 1 FROM credit_escrow e WHERE e.id = df.escrow_id);
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION cleanup_orphaned_images() IS 'Removes orphaned image records. Should be run periodically.';