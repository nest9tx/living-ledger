-- Add missing DELETE policies to requests and offers tables
-- Run this in Supabase SQL Editor

-- Add delete policy for requests
create policy "Requests delete" on requests
  for delete
  using (auth.uid() = user_id);

-- Add delete policy for offers
create policy "Offers delete" on offers
  for delete
  using (auth.uid() = user_id);
