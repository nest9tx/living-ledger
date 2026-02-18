-- Supabase Storage Configuration for Living Ledger Image Uploads
-- This script creates the storage buckets only
-- Storage policies must be configured through the Supabase dashboard due to permission restrictions

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

-- NOTE: Storage RLS policies need to be set up through the Supabase dashboard
-- Go to: Storage > Settings > Policies for each bucket
--
-- For 'listing-images' bucket (public):
-- 1. Allow SELECT for everyone
-- 2. Allow INSERT/UPDATE/DELETE for authenticated users on their own folders
--
-- For 'message-attachments' and 'delivery-files' buckets (private):
-- 1. Allow access only to authorized users based on conversation/escrow participation
-- 2. Set up through dashboard UI with appropriate conditions