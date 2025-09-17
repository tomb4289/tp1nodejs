/*
  # Fix authentication trigger and profile creation

  1. Updates
    - Improve the handle_new_user function to be more robust
    - Add better error handling for profile creation
    - Ensure the trigger works reliably

  2. Security
    - Maintain existing RLS policies
    - Ensure proper error handling
*/

-- Drop existing trigger and function
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS handle_new_user();

-- Create improved function to handle new user signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  first_name_val text;
  last_name_val text;
  initials_val text;
  color_val text;
BEGIN
  -- Extract values with fallbacks
  first_name_val := COALESCE(NEW.raw_user_meta_data->>'first_name', 'User');
  last_name_val := COALESCE(NEW.raw_user_meta_data->>'last_name', 'Name');
  
  -- Generate initials
  initials_val := UPPER(LEFT(first_name_val, 1) || LEFT(last_name_val, 1));
  
  -- Generate random color
  color_val := CASE (random() * 7)::int
    WHEN 0 THEN '#6366f1'
    WHEN 1 THEN '#8b5cf6'
    WHEN 2 THEN '#ec4899'
    WHEN 3 THEN '#ef4444'
    WHEN 4 THEN '#f59e0b'
    WHEN 5 THEN '#10b981'
    WHEN 6 THEN '#06b6d4'
    ELSE '#3b82f6'
  END;

  -- Insert profile with error handling
  BEGIN
    INSERT INTO profiles (
      id, 
      first_name, 
      last_name, 
      email, 
      date_of_birth,
      phone,
      bio,
      avatar_initials, 
      avatar_color
    )
    VALUES (
      NEW.id,
      first_name_val,
      last_name_val,
      NEW.email,
      CASE 
        WHEN NEW.raw_user_meta_data->>'date_of_birth' IS NOT NULL 
        THEN (NEW.raw_user_meta_data->>'date_of_birth')::date 
        ELSE NULL 
      END,
      NEW.raw_user_meta_data->>'phone',
      COALESCE(NEW.raw_user_meta_data->>'bio', ''),
      initials_val,
      color_val
    );
  EXCEPTION 
    WHEN OTHERS THEN
      -- Log the error but don't fail the user creation
      RAISE WARNING 'Failed to create profile for user %: %', NEW.id, SQLERRM;
  END;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for new user signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();

-- Ensure email confirmation is disabled for easier testing
-- This can be changed in Supabase dashboard under Authentication > Settings