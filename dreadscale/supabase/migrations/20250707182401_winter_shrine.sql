/*
  # Create movies table for caching TMDB data

  1. New Tables
    - `movies`
      - `id` (integer, primary key, TMDB movie ID)
      - `title` (text)
      - `overview` (text)
      - `poster_path` (text)
      - `backdrop_path` (text)
      - `release_date` (date)
      - `vote_average` (decimal)
      - `vote_count` (integer)
      - `popularity` (decimal)
      - `runtime` (integer, optional)
      - `genres` (jsonb, array of genre objects)
      - `production_companies` (jsonb, array of company objects)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

  2. Security
    - Enable RLS on `movies` table
    - Add policy for public read access
    - Add policy for authenticated users to insert/update (for caching)
*/

-- Create movies table
CREATE TABLE IF NOT EXISTS movies (
  id integer PRIMARY KEY, -- TMDB movie ID
  title text NOT NULL,
  overview text DEFAULT '',
  poster_path text,
  backdrop_path text,
  release_date date,
  vote_average decimal(3,1) DEFAULT 0,
  vote_count integer DEFAULT 0,
  popularity decimal(8,3) DEFAULT 0,
  runtime integer,
  genres jsonb DEFAULT '[]'::jsonb,
  production_companies jsonb DEFAULT '[]'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE movies ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Public can read movies"
  ON movies
  FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Authenticated users can insert movies"
  ON movies
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update movies"
  ON movies
  FOR UPDATE
  TO authenticated
  USING (true);

-- Create trigger for updated_at
CREATE TRIGGER movies_updated_at
  BEFORE UPDATE ON movies
  FOR EACH ROW
  EXECUTE FUNCTION handle_updated_at();

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS movies_title_idx ON movies USING gin(to_tsvector('english', title));
CREATE INDEX IF NOT EXISTS movies_release_date_idx ON movies(release_date);
CREATE INDEX IF NOT EXISTS movies_popularity_idx ON movies(popularity DESC);
CREATE INDEX IF NOT EXISTS movies_vote_average_idx ON movies(vote_average DESC);