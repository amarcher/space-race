-- When the "your order shipped" email went out, so /shop/admin can show it and
-- offer a send for orders marked shipped before the email existed.
-- Apply before deploying the code that reads it.
ALTER TABLE orders ADD COLUMN IF NOT EXISTS shipped_email_sent_at timestamptz;
