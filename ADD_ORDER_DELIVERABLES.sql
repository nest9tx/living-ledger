-- ============================================================
-- Order Deliverables Table
-- Stores metadata for files uploaded by providers as order
-- deliverables. Actual files live in the 'delivery-files'
-- Supabase Storage bucket.
-- Run this in the Supabase SQL editor.
-- ============================================================

CREATE TABLE IF NOT EXISTS order_deliverables (
  id            bigserial     PRIMARY KEY,
  escrow_id     bigint        NOT NULL REFERENCES credit_escrow(id) ON DELETE CASCADE,
  uploader_id   uuid          NOT NULL REFERENCES auth.users(id),
  storage_path  text          NOT NULL,
  filename      text          NOT NULL,
  file_size     bigint        NOT NULL,
  mime_type     text          NOT NULL,
  created_at    timestamptz   NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_order_deliverables_escrow
  ON order_deliverables(escrow_id);

-- RLS
ALTER TABLE order_deliverables ENABLE ROW LEVEL SECURITY;

-- Both parties on the order can view deliverables
CREATE POLICY "parties can view deliverables"
  ON order_deliverables
  FOR SELECT
  USING (
    uploader_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM credit_escrow e
      WHERE e.id = escrow_id
        AND (e.payer_id = auth.uid() OR e.provider_id = auth.uid())
    )
  );

-- Only the uploader (provider) can insert
CREATE POLICY "provider can upload deliverable"
  ON order_deliverables
  FOR INSERT
  WITH CHECK (uploader_id = auth.uid());

-- Uploaders can delete their own records
CREATE POLICY "uploader can delete deliverable"
  ON order_deliverables
  FOR DELETE
  USING (uploader_id = auth.uid());
