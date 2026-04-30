CREATE UNIQUE INDEX IF NOT EXISTS idx_bookings_user_date_daily
  ON bookings(user_id, date) WHERE type='daily';
