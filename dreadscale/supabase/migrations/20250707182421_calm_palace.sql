/*
  # Create movie reviews table

  1. New Tables
    - `movie_reviews`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references profiles)
      - `movie_id` (integer, references movies)
      - `review_text` (text)
      - `is_spoiler` (boolean, default false)
      - `helpful_count` (integer, default 0)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

  2. Security
    - Enable RLS on `movie_reviews` table
    - Add policies for users to manage their own reviews
    - Add policy for public read access to reviews

  3. Constraints
    - Unique constraint on (user_id, movie_id) - one review per user per movie
    - Check constraint for review text length
*/

-- Create movie_reviews table
CREATE TABLE IF NOT EXISTS movie_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  movie_id integer REFERENCES movies(id) ON DELETE CASCADE NOT NULL,
  review_text text NOT NULL CHECK (length(review_text) >= 10 AND length(review_text) <= 5000),
  is_spoiler boolean DEFAULT false,
  helpful_count integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  -- Ensure one review per user per movie
  UNIQUE(user_id, movie_id)
);

-- Enable RLS
ALTER TABLE movie_reviews ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Public can read reviews"
  ON movie_reviews
  FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Users can insert own reviews"
  ON movie_reviews
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own reviews"
  ON movie_reviews
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own reviews"
  ON movie_reviews
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Create trigger for updated_at
CREATE TRIGGER movie_reviews_updated_at
  BEFORE UPDATE ON movie_reviews
  FOR EACH ROW
  EXECUTE FUNCTION handle_updated_at();

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS movie_reviews_user_id_idx ON movie_reviews(user_id);
CREATE INDEX IF NOT EXISTS movie_reviews_movie_id_idx ON movie_reviews(movie_id);
CREATE INDEX IF NOT EXISTS movie_reviews_created_at_idx ON movie_reviews(created_at DESC);
CREATE INDEX IF NOT EXISTS movie_reviews_helpful_count_idx ON movie_reviews(helpful_count DESC);
CREATE INDEX IF NOT EXISTS movie_reviews_text_search_idx ON movie_reviews USING gin(to_tsvector('english', review_text));