-- =====================================================
-- Migration 002: clients table + sync columns
-- Run in Supabase SQL editor after 001_initial_schema.sql
-- =====================================================

-- Add local_id (app-side integer ID) for upsert matching
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS local_id  INTEGER,
  ADD COLUMN IF NOT EXISTS desc      TEXT;

ALTER TABLE estimates
  ADD COLUMN IF NOT EXISTS local_id                INTEGER,
  ADD COLUMN IF NOT EXISTS include_product_details BOOLEAN DEFAULT FALSE;

-- Add default tax rate and notes to user_settings
ALTER TABLE user_settings
  ADD COLUMN IF NOT EXISTS tax   NUMERIC(5,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS notes TEXT;

-- Unique indexes so upsert(onConflict: 'user_id,local_id') works
CREATE UNIQUE INDEX IF NOT EXISTS products_user_local  ON products (user_id, local_id);
CREATE UNIQUE INDEX IF NOT EXISTS estimates_user_local ON estimates(user_id, local_id);

-- =====================================================
-- Clients table (missing from migration 001)
-- =====================================================
CREATE TABLE IF NOT EXISTS clients (
  id         BIGSERIAL   PRIMARY KEY,
  user_id    UUID        REFERENCES auth.users(id) ON DELETE CASCADE,
  local_id   INTEGER,
  name       TEXT        NOT NULL,
  emails     JSONB       DEFAULT '[]',
  phone      TEXT,
  notes      TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE clients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users own their clients"
  ON clients FOR ALL USING (auth.uid() = user_id);

CREATE UNIQUE INDEX IF NOT EXISTS clients_user_local ON clients(user_id, local_id);
