-- OpenClaw Hub Map - Supabase Schema
-- Run this in Supabase SQL Editor: https://supabase.com/dashboard/project/_/sql

-- Categories: lobster (Human Lobster/Builder), meetup (Meetup & IRL Event), business (Business)
CREATE TYPE spot_category AS ENUM ('lobster', 'meetup', 'business');

-- Spots table
CREATE TABLE spots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  city TEXT NOT NULL,
  category spot_category NOT NULL,
  image_url TEXT,
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

-- Index for map queries
CREATE INDEX spots_lat_lng_idx ON spots (lat, lng);
CREATE INDEX spots_category_idx ON spots (category);

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER spots_updated_at
  BEFORE UPDATE ON spots
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Row Level Security (RLS)
ALTER TABLE spots ENABLE ROW LEVEL SECURITY;

-- Anyone can read
CREATE POLICY "Public read access" ON spots
  FOR SELECT USING (true);

-- Only authenticated users can insert (created_by set to current user)
CREATE POLICY "Authenticated users can insert" ON spots
  FOR INSERT WITH CHECK (auth.role() = 'authenticated' AND created_by = auth.uid());

-- Users can update/delete only their own spots
CREATE POLICY "Users can update own spots" ON spots
  FOR UPDATE USING (auth.uid() = created_by);

CREATE POLICY "Users can delete own spots" ON spots
  FOR DELETE USING (auth.uid() = created_by);

-- Storage bucket for images (spots + creations)
-- Run in Dashboard > Storage > New bucket: name "spot-images", Public: Yes
-- Policies (Storage > Policies > New policy):
-- 1. Public read: SELECT, bucket spot-images, USING (true)
-- 2. Auth upload: INSERT, bucket spot-images, WITH CHECK (auth.role() = 'authenticated')

-- ========== MIGRATIONS (run only if spots table already exists) ==========
-- If you already ran the schema before, run from this line down.

-- Add event_date to spots (for meetup/events calendar)
ALTER TABLE spots ADD COLUMN IF NOT EXISTS event_date DATE;

-- Help & skills table (ask for help, offer services, post bounties)
CREATE TABLE IF NOT EXISTS help_skills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL CHECK (type IN ('help', 'offer', 'bounty')),
  title TEXT NOT NULL,
  description TEXT,
  skills TEXT,
  contact TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS help_skills_type_idx ON help_skills (type);

ALTER TABLE help_skills ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read help_skills" ON help_skills FOR SELECT USING (true);
CREATE POLICY "Auth insert help_skills" ON help_skills FOR INSERT WITH CHECK (auth.role() = 'authenticated' AND created_by = auth.uid());
CREATE POLICY "Auth update own help_skills" ON help_skills FOR UPDATE USING (auth.uid() = created_by);
CREATE POLICY "Auth delete own help_skills" ON help_skills FOR DELETE USING (auth.uid() = created_by);

-- Creations gallery
CREATE TABLE IF NOT EXISTS creations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  image_url TEXT,
  link TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

ALTER TABLE creations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read creations" ON creations FOR SELECT USING (true);
CREATE POLICY "Auth insert creations" ON creations FOR INSERT WITH CHECK (auth.role() = 'authenticated' AND created_by = auth.uid());
CREATE POLICY "Auth update own creations" ON creations FOR UPDATE USING (auth.uid() = created_by);
CREATE POLICY "Auth delete own creations" ON creations FOR DELETE USING (auth.uid() = created_by);
