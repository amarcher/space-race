-- Add the available-now fulfillment state without rewriting historical orders.
-- Apply before deploying checkout sessions that use ship_window = 'in_stock'.
BEGIN;
ALTER TABLE orders DROP CONSTRAINT orders_ship_window_check;
ALTER TABLE orders ADD CONSTRAINT orders_ship_window_check
  CHECK (ship_window IN ('early', 'january', 'in_stock'));
COMMIT;
