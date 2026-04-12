-- =====================================================
-- Regen Estimator — Initial Schema
-- Run this in the Supabase SQL editor after creating
-- your project at https://supabase.com
-- =====================================================

-- Products / pricing catalog
CREATE TABLE products (
  id          BIGSERIAL PRIMARY KEY,
  user_id     UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  unit        TEXT,
  price       NUMERIC(10,2) DEFAULT 0,
  category    TEXT,
  status      TEXT DEFAULT 'active',  -- 'active' | 'archived'
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Estimates (line_items stored as JSONB for flexibility)
CREATE TABLE estimates (
  id           BIGSERIAL PRIMARY KEY,
  user_id      UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  client       TEXT NOT NULL,
  client_email TEXT,
  date         DATE,
  valid_until  DATE,
  status       TEXT DEFAULT 'draft',  -- 'draft' | 'sent' | 'archived'
  subtotal     NUMERIC(10,2) DEFAULT 0,
  tax          NUMERIC(5,2)  DEFAULT 0,
  total        NUMERIC(10,2) DEFAULT 0,
  notes        TEXT,
  line_items   JSONB DEFAULT '[]',
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

-- Per-user business settings (one row per user)
CREATE TABLE user_settings (
  user_id    UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  bizname    TEXT,
  name       TEXT,
  phone      TEXT,
  email      TEXT,
  logo       TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- Row-level security (users can only see their own data)
-- =====================================================
ALTER TABLE products       ENABLE ROW LEVEL SECURITY;
ALTER TABLE estimates      ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_settings  ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users own their products"
  ON products FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users own their estimates"
  ON estimates FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users own their settings"
  ON user_settings FOR ALL USING (auth.uid() = user_id);

-- =====================================================
-- Auto-update updated_at on estimates
-- =====================================================
CREATE OR REPLACE FUNCTION touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER estimates_updated_at
  BEFORE UPDATE ON estimates
  FOR EACH ROW EXECUTE PROCEDURE touch_updated_at();
