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
  date_of_birth_val date;
BEGIN
  -- Extract values with fallbacks and better error handling
  BEGIN
    first_name_val := COALESCE(NEW.raw_user_meta_data->>'first_name', 'User');
    last_name_val := COALESCE(NEW.raw_user_meta_data->>'last_name', 'Name');
    
    -- Generate initials safely
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

    -- Handle date of birth safely
    date_of_birth_val := NULL;
    IF NEW.raw_user_meta_data->>'date_of_birth' IS NOT NULL AND 
       NEW.raw_user_meta_data->>'date_of_birth' != '' THEN
      BEGIN
        date_of_birth_val := (NEW.raw_user_meta_data->>'date_of_birth')::date;
      EXCEPTION 
        WHEN OTHERS THEN
          date_of_birth_val := NULL;
      END;
    END IF;

    -- Insert profile with comprehensive error handling
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
      date_of_birth_val,
      NEW.raw_user_meta_data->>'phone',
      COALESCE(NEW.raw_user_meta_data->>'bio', ''),
      initials_val,
      color_val
    );
    
    RAISE LOG 'Successfully created profile for user %', NEW.id;
    
  EXCEPTION 
    WHEN unique_violation THEN
      -- Profile already exists, this is okay
      RAISE LOG 'Profile already exists for user %', NEW.id;
    WHEN OTHERS THEN
      -- Log the error but don't fail the user creation
      RAISE WARNING 'Failed to create profile for user %: % (SQLSTATE: %)', NEW.id, SQLERRM, SQLSTATE;
  END;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for new user signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();

-- Ensure RLS policies are correct
DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;
CREATE POLICY "Users can insert own profile"
  ON profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

-- Add a policy to allow the trigger function to insert profiles
DROP POLICY IF EXISTS "System can insert profiles" ON profiles;
CREATE POLICY "System can insert profiles"
  ON profiles
  FOR INSERT
  TO service_role
  WITH CHECK (true);