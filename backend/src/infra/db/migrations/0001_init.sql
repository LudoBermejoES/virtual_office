CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY,
  google_sub TEXT UNIQUE NOT NULL,
  email TEXT UNIQUE NOT NULL,
  domain TEXT NOT NULL,
  name TEXT NOT NULL,
  avatar_url TEXT,
  role TEXT NOT NULL CHECK (role IN ('admin','member')),
  is_invited_external INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS offices (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  tmj_filename TEXT NOT NULL,
  tile_width INTEGER NOT NULL,
  tile_height INTEGER NOT NULL,
  cells_x INTEGER NOT NULL,
  cells_y INTEGER NOT NULL,
  map_width INTEGER NOT NULL,
  map_height INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS office_tilesets (
  id INTEGER PRIMARY KEY,
  office_id INTEGER NOT NULL REFERENCES offices(id) ON DELETE CASCADE,
  ordinal INTEGER NOT NULL,
  image_name TEXT NOT NULL,
  filename TEXT NOT NULL,
  mime_type TEXT NOT NULL CHECK (mime_type IN ('image/png','image/webp')),
  UNIQUE(office_id, ordinal),
  UNIQUE(office_id, image_name)
);

CREATE TABLE IF NOT EXISTS desks (
  id INTEGER PRIMARY KEY,
  office_id INTEGER NOT NULL REFERENCES offices(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  x INTEGER NOT NULL,
  y INTEGER NOT NULL,
  source TEXT NOT NULL CHECK (source IN ('manual','tiled')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(office_id, label)
);

CREATE TABLE IF NOT EXISTS bookings (
  id INTEGER PRIMARY KEY,
  desk_id INTEGER NOT NULL REFERENCES desks(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('daily','fixed')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(desk_id, date)
);

CREATE INDEX IF NOT EXISTS idx_bookings_user_date ON bookings(user_id, date);
CREATE INDEX IF NOT EXISTS idx_bookings_office_date ON bookings(date);

CREATE TABLE IF NOT EXISTS invitations (
  id INTEGER PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  invited_by_user_id INTEGER NOT NULL REFERENCES users(id),
  token TEXT UNIQUE NOT NULL,
  expires_at TEXT NOT NULL,
  accepted_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
