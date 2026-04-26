-- Run this file in the Supabase SQL Editor.
-- It creates the tables and seed data required by the backend.

DO $$
BEGIN
  CREATE TYPE movie_language AS ENUM (
    'Hindi Dubbed',
    'South Dubbed',
    'English',
    'Bollywood',
    'Multi Audio'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS admins (
  id BIGSERIAL PRIMARY KEY,
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS categories (
  id BIGSERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,
  slug VARCHAR(120) NOT NULL UNIQUE,
  color_hex CHAR(7) NOT NULL CHECK (color_hex ~ '^#[A-Fa-f0-9]{6}$')
);

CREATE TABLE IF NOT EXISTS movies (
  id BIGSERIAL PRIMARY KEY,
  title VARCHAR(200) NOT NULL,
  slug VARCHAR(220) NOT NULL UNIQUE,
  description VARCHAR(500) NOT NULL,
  language movie_language NOT NULL,
  year INTEGER NOT NULL CHECK (year BETWEEN 1900 AND 2030),
  rating NUMERIC(3, 1) NOT NULL CHECK (rating >= 0 AND rating <= 10),
  genre TEXT[] NOT NULL DEFAULT '{}',
  thumbnail_url TEXT,
  watch_url TEXT NOT NULL,
  is_published BOOLEAN NOT NULL DEFAULT false,
  view_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_movies_language ON movies (language);
CREATE INDEX IF NOT EXISTS idx_movies_year ON movies (year);
CREATE INDEX IF NOT EXISTS idx_movies_published ON movies (is_published);
CREATE INDEX IF NOT EXISTS idx_movies_created_at ON movies (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_movies_title ON movies (title);

CREATE OR REPLACE FUNCTION update_movies_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_movies_updated_at ON movies;

CREATE TRIGGER trg_movies_updated_at
BEFORE UPDATE ON movies
FOR EACH ROW
EXECUTE FUNCTION update_movies_updated_at();

INSERT INTO categories (name, slug, color_hex)
VALUES
  ('Hindi Dubbed', 'hindi-dubbed', '#ff9900'),
  ('South Dubbed', 'south-dubbed', '#b39ddb'),
  ('English', 'english', '#4fc3f7'),
  ('Bollywood', 'bollywood', '#ff9900'),
  ('Multi Audio', 'multi-audio', '#2ecc71')
ON CONFLICT (slug) DO UPDATE
SET
  name = EXCLUDED.name,
  color_hex = EXCLUDED.color_hex;
