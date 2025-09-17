/*
  # Create chat messages table for movie discussions

  1. New Tables
    - `chat_messages`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references profiles, nullable for anonymous)
      - `movie_id` (integer, references movies)
      - `message` (text)
      - `username` (text, for display)
      - `is_anonymous` (boolean)
      - `created_at` (timestamp)

  2. Security
    - Enable RLS on `chat_messages` table
    - Add policies for public read access
    - Add policies for authenticated users to post messages
    - Add policies for users to delete their own messages

  3. Constraints
    - Check constraint for message length
*/

-- Create chat_messages table
CREATE TABLE IF NOT EXISTS chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  movie_id integer REFERENCES movies(id) ON DELETE CASCADE NOT NULL,
  message text NOT NULL CHECK (length(message) >= 1 AND length(message) <= 500),
  username text NOT NULL,
  is_anonymous boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Public can read chat messages"
  ON chat_messages
  FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Authenticated users can insert messages"
  ON chat_messages
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (auth.uid() = user_id AND is_anonymous = false) OR 
    (user_id IS NULL AND is_anonymous = true)
  );

CREATE POLICY "Users can delete own messages"
  ON chat_messages
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS chat_messages_movie_id_idx ON chat_messages(movie_id);
CREATE INDEX IF NOT EXISTS chat_messages_created_at_idx ON chat_messages(created_at DESC);
CREATE INDEX IF NOT EXISTS chat_messages_user_id_idx ON chat_messages(user_id);