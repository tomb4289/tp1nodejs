/*
  # Create users table and authentication setup

  1. New Tables
    - `profiles`
      - `id` (uuid, primary key, references auth.users)
      - `first_name` (text)
      - `last_name` (text)
      - `email` (text, unique)
      - `date_of_birth` (date, optional)
      - `phone` (text, optional)
      - `bio` (text, optional)
      - `avatar_color` (text)
      - `avatar_initials` (text)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

  2. Security
    - Enable RLS on `profiles` table
    - Add policies for users to read/update their own profile
    - Add policy for public read access to basic profile info
*/

-- Create profiles table
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  first_name text NOT NULL,
  last_name text NOT NULL,
  email text UNIQUE NOT NULL,
  date_of_birth date,
  phone text,
  bio text DEFAULT '',
  avatar_color text NOT NULL DEFAULT '#6366f1',
  avatar_initials text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can read own profile"
  ON profiles
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON profiles
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

-- Create policy for public read access to basic profile info (for reviews/ratings display)
CREATE POLICY "Public can read basic profile info"
  ON profiles
  FOR SELECT
  TO public
  USING (true);

-- Create function to handle profile updates
CREATE OR REPLACE FUNCTION handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for updated_at
CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION handle_updated_at();

-- Create function to handle new user signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, first_name, last_name, email, avatar_initials, avatar_color)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'first_name', 'User'),
    COALESCE(NEW.raw_user_meta_data->>'last_name', 'Name'),
    NEW.email,
    UPPER(LEFT(COALESCE(NEW.raw_user_meta_data->>'first_name', 'U'), 1) || LEFT(COALESCE(NEW.raw_user_meta_data->>'last_name', 'N'), 1)),
    CASE (random() * 7)::int
      WHEN 0 THEN '#6366f1'
      WHEN 1 THEN '#8b5cf6'
      WHEN 2 THEN '#ec4899'
      WHEN 3 THEN '#ef4444'
      WHEN 4 THEN '#f59e0b'
      WHEN 5 THEN '#10b981'
      WHEN 6 THEN '#06b6d4'
      ELSE '#3b82f6'
    END
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for new user signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();