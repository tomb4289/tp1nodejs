/*
  # Create movie ratings table

  1. New Tables
    - `movie_ratings`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references profiles)
      - `movie_id` (integer, references movies)
      - `category` (text, rating category key)
      - `subcategory` (text, rating subcategory key)
      - `rating` (integer, 0-10 scale)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

  2. Security
    - Enable RLS on `movie_ratings` table
    - Add policies for users to manage their own ratings
    - Add policy for public read access to ratings (for aggregation)

  3. Constraints
    - Unique constraint on (user_id, movie_id, category, subcategory)
    - Check constraint for rating range (0-10)
*/

-- Create movie_ratings table
CREATE TABLE IF NOT EXISTS movie_ratings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  movie_id integer REFERENCES movies(id) ON DELETE CASCADE NOT NULL,
  category text NOT NULL,
  subcategory text NOT NULL,
  rating integer NOT NULL CHECK (rating >= 0 AND rating <= 10),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  -- Ensure one rating per user per movie per category/subcategory
  UNIQUE(user_id, movie_id, category, subcategory)
);

-- Enable RLS
ALTER TABLE movie_ratings ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can read all ratings"
  ON movie_ratings
  FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Users can insert own ratings"
  ON movie_ratings
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own ratings"
  ON movie_ratings
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own ratings"
  ON movie_ratings
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Create trigger for updated_at
CREATE TRIGGER movie_ratings_updated_at
  BEFORE UPDATE ON movie_ratings
  FOR EACH ROW
  EXECUTE FUNCTION handle_updated_at();

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS movie_ratings_user_id_idx ON movie_ratings(user_id);
CREATE INDEX IF NOT EXISTS movie_ratings_movie_id_idx ON movie_ratings(movie_id);
CREATE INDEX IF NOT EXISTS movie_ratings_category_idx ON movie_ratings(category, subcategory);
CREATE INDEX IF NOT EXISTS movie_ratings_rating_idx ON movie_ratings(rating);
CREATE INDEX IF NOT EXISTS movie_ratings_movie_category_idx ON movie_ratings(movie_id, category, subcategory);