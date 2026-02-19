-- Add attachment support to messages table
ALTER TABLE messages
  ADD COLUMN IF NOT EXISTS attachment_path text,
  ADD COLUMN IF NOT EXISTS attachment_filename text,
  ADD COLUMN IF NOT EXISTS attachment_mime_type text;
