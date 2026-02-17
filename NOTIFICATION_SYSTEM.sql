-- IN-APP NOTIFICATION SYSTEM
-- Visual indicators for orders, disputes, and important updates

-- Create notifications table
CREATE TABLE IF NOT EXISTS notifications (
  id bigserial PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('new_order', 'dispute_filed', 'dispute_resolved', 'order_completed', 'late_delivery')),
  title text NOT NULL,
  message text NOT NULL,
  related_escrow_id bigint REFERENCES credit_escrow(id) ON DELETE CASCADE,
  related_offer_id bigint REFERENCES offers(id) ON DELETE CASCADE,
  related_request_id bigint REFERENCES requests(id) ON DELETE CASCADE,
  is_read boolean DEFAULT false,
  created_at timestamptz DEFAULT NOW(),
  read_at timestamptz
);

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON notifications(user_id, is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_user_created ON notifications(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_notifications_type ON notifications(type);
CREATE INDEX IF NOT EXISTS idx_notifications_created ON notifications(created_at);

-- Enable RLS
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see their own notifications
CREATE POLICY "Users can view own notifications" ON notifications
  FOR SELECT USING (auth.uid() = user_id);

-- Policy: System can create notifications for any user
CREATE POLICY "System can create notifications" ON notifications
  FOR INSERT WITH CHECK (true);

-- Policy: Users can update their own notifications (mark as read)
CREATE POLICY "Users can update own notifications" ON notifications
  FOR UPDATE USING (auth.uid() = user_id);

-- Function to create notifications
CREATE OR REPLACE FUNCTION create_notification(
  target_user_id uuid,
  notification_type text,
  notification_title text,
  notification_message text,
  escrow_id bigint DEFAULT NULL,
  offer_id bigint DEFAULT NULL,
  request_id bigint DEFAULT NULL
) RETURNS void AS $$
BEGIN
  INSERT INTO notifications (
    user_id, type, title, message, 
    related_escrow_id, related_offer_id, related_request_id
  ) VALUES (
    target_user_id, notification_type, notification_title, notification_message,
    escrow_id, offer_id, request_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION create_notification(uuid, text, text, text, bigint, bigint, bigint) TO authenticated, anon, service_role;

COMMENT ON TABLE notifications IS 'In-app notifications for orders, disputes, and updates';
COMMENT ON COLUMN notifications.type IS 'Notification type: new_order, dispute_filed, dispute_resolved, order_completed, late_delivery';
COMMENT ON COLUMN notifications.is_read IS 'Whether user has acknowledged this notification';
COMMENT ON FUNCTION create_notification IS 'Helper function to create notifications for users';

-- Migration complete
SELECT 'In-app notification system initialized' as status;