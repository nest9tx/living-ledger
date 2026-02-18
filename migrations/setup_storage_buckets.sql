-- Supabase Storage Configuration for Living Ledger Image Uploads
-- This script sets up storage buckets and policies for secure image handling

-- Create storage buckets for different types of uploads
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES 
  (
    'listing-images', 
    'listing-images',
    true, -- Public bucket for listing images (can be viewed by anyone)
    5242880, -- 5MB limit per image
    ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
  ),
  (
    'message-attachments',
    'message-attachments', 
    false, -- Private bucket for message attachments
    10485760, -- 10MB limit for message attachments
    ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf', 'text/plain', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
  ),
  (
    'delivery-files',
    'delivery-files',
    false, -- Private bucket for work deliveries  
    52428800, -- 50MB limit for delivery files
    ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf', 'text/plain', 'application/zip', 'application/x-zip-compressed', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']
  )
ON CONFLICT (id) DO UPDATE SET
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Storage RLS policies for listing images (public bucket)
CREATE POLICY "listing_images_public_read" 
ON storage.objects FOR SELECT 
USING (bucket_id = 'listing-images');

CREATE POLICY "listing_images_authenticated_upload" 
ON storage.objects FOR INSERT 
WITH CHECK (
  bucket_id = 'listing-images' 
  AND auth.role() = 'authenticated'
  AND (storage.foldername(name))[1] = auth.uid()::text -- Users can only upload to their own folder
);

CREATE POLICY "listing_images_owner_update" 
ON storage.objects FOR UPDATE 
USING (
  bucket_id = 'listing-images' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "listing_images_owner_delete" 
ON storage.objects FOR DELETE 
USING (
  bucket_id = 'listing-images' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Storage RLS policies for message attachments (private bucket)
CREATE POLICY "message_attachments_conversation_read" 
ON storage.objects FOR SELECT 
USING (
  bucket_id = 'message-attachments'
  AND EXISTS (
    -- User can access if they're part of a conversation that has this attachment
    SELECT 1 FROM message_attachments ma
    JOIN messages m ON m.id = ma.message_id
    WHERE ma.storage_path = name
    AND (m.from_user_id = auth.uid() OR m.to_user_id = auth.uid())
  )
);

CREATE POLICY "message_attachments_authenticated_upload" 
ON storage.objects FOR INSERT 
WITH CHECK (
  bucket_id = 'message-attachments' 
  AND auth.role() = 'authenticated'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "message_attachments_owner_delete" 
ON storage.objects FOR DELETE 
USING (
  bucket_id = 'message-attachments' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Storage RLS policies for delivery files (private bucket)
CREATE POLICY "delivery_files_escrow_read" 
ON storage.objects FOR SELECT 
USING (
  bucket_id = 'delivery-files'
  AND EXISTS (
    -- Both provider and buyer can access delivery files for their escrow
    SELECT 1 FROM delivery_files df
    JOIN credit_escrow e ON e.id = df.escrow_id
    WHERE df.storage_path = name
    AND (e.provider_id = auth.uid() OR e.buyer_id = auth.uid())
  )
);

CREATE POLICY "delivery_files_provider_upload" 
ON storage.objects FOR INSERT 
WITH CHECK (
  bucket_id = 'delivery-files' 
  AND auth.role() = 'authenticated'
  AND (storage.foldername(name))[1] = auth.uid()::text
  -- Additional check that user is a provider will be handled in app logic
);

CREATE POLICY "delivery_files_provider_delete" 
ON storage.objects FOR DELETE 
USING (
  bucket_id = 'delivery-files' 
  AND EXISTS (
    SELECT 1 FROM delivery_files df
    JOIN credit_escrow e ON e.id = df.escrow_id
    WHERE df.storage_path = name
    AND df.provider_id = auth.uid()
    AND e.status = 'held' -- Can only delete before completion
  )
);

-- Enable RLS on storage.objects
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;