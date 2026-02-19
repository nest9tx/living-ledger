-- Track admin refunds on individual transactions
-- admin_refunded: prevents double-refunding
-- refund_of_transaction_id: links refund record back to original

ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS admin_refunded boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS refund_of_transaction_id bigint REFERENCES transactions(id);
