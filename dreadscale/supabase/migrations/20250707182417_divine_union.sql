/*
  # Create watchlists table

  1. New Tables
    - `watchlists`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references profiles)
      - `movie_id` (integer, references movies)
      - `added_at` (timestamp)

  2. Security
    - Enable RLS on `watchlists` table
    - Add policies for users to manage their own watchlist
    - Add policy for public read access (for social features)

  3. Constraints
    - Unique constraint on (user_id, movie_id)
*/

-- Create watchlists table
CREATE TABLE IF NOT EXISTS watchlists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  movie_id integer REFERENCES movies(id) ON DELETE CASCADE NOT NULL,
  added_at timestamptz DEFAULT now(),
  
  -- Ensure one entry per user per movie
  UNIQUE(user_id, movie_id)
);

-- Enable RLS
ALTER TABLE watchlists ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can read all watchlists"
  ON watchlists
  FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Users can manage own watchlist"
  ON watchlists
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS watchlists_user_id_idx ON watchlists(user_id);
CREATE INDEX IF NOT EXISTS watchlists_movie_id_idx ON watchlists(movie_id);
CREATE INDEX IF NOT EXISTS watchlists_added_at_idx ON watchlists(added_at DESC);