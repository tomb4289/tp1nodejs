/*
  # Create views and functions for rating aggregations

  1. Views
    - `movie_rating_stats` - Aggregated rating statistics per movie/category/subcategory
    - `movie_dreadscore` - Overall DreadScore calculation per movie
    - `user_rating_stats` - User rating statistics

  2. Functions
    - `get_movie_dreadscore(movie_id)` - Calculate DreadScore for a movie
    - `get_similar_users(user_id)` - Find users with similar rating patterns
*/

-- Create view for movie rating statistics
CREATE OR REPLACE VIEW movie_rating_stats AS
SELECT 
  movie_id,
  category,
  subcategory,
  COUNT(*) as rating_count,
  AVG(rating::decimal) as average_rating,
  MIN(rating) as min_rating,
  MAX(rating) as max_rating,
  STDDEV(rating::decimal) as rating_stddev
FROM movie_ratings
GROUP BY movie_id, category, subcategory;

-- Create view for movie DreadScore calculation
CREATE OR REPLACE VIEW movie_dreadscore AS
WITH weighted_ratings AS (
  SELECT 
    mr.movie_id,
    mr.category,
    mr.subcategory,
    AVG(mr.rating::decimal) as avg_rating,
    COUNT(*) as rating_count,
    CASE 
      -- Violence category weights
      WHEN mr.category = 'violence' AND mr.subcategory = 'physicalViolence' THEN 0.9
      WHEN mr.category = 'violence' AND mr.subcategory = 'weaponViolence' THEN 1.0
      WHEN mr.category = 'violence' AND mr.subcategory = 'goreBlood' THEN 1.0
      WHEN mr.category = 'violence' AND mr.subcategory = 'torture' THEN 1.0
      WHEN mr.category = 'violence' AND mr.subcategory = 'jumpScares' THEN 0.6
      WHEN mr.category = 'violence' AND mr.subcategory = 'animalCruelty' THEN 1.0
      -- Sexual category weights
      WHEN mr.category = 'sexual' AND mr.subcategory = 'romance' THEN -0.5
      WHEN mr.category = 'sexual' AND mr.subcategory = 'sexualNonExplicit' THEN 0.6
      WHEN mr.category = 'sexual' AND mr.subcategory = 'sexualExplicit' THEN 1.0
      WHEN mr.category = 'sexual' AND mr.subcategory = 'sexualViolence' THEN 1.0
      -- Language category weights
      WHEN mr.category = 'language' AND mr.subcategory = 'profanity' THEN 0.5
      WHEN mr.category = 'language' AND mr.subcategory = 'humor' THEN -0.3
      -- Disturbing category weights
      WHEN mr.category = 'disturbing' AND mr.subcategory = 'bodyHorror' THEN 1.0
      WHEN mr.category = 'disturbing' AND mr.subcategory = 'substanceUse' THEN 0.7
      WHEN mr.category = 'disturbing' AND mr.subcategory = 'mentalHealthCrises' THEN 0.8
      WHEN mr.category = 'disturbing' AND mr.subcategory = 'selfHarmSuicide' THEN 1.0
      WHEN mr.category = 'disturbing' AND mr.subcategory = 'childEndangerment' THEN 1.0
      WHEN mr.category = 'disturbing' AND mr.subcategory = 'discrimination' THEN 0.8
      WHEN mr.category = 'disturbing' AND mr.subcategory = 'deathGrief' THEN 0.6
      WHEN mr.category = 'disturbing' AND mr.subcategory = 'crimeIllegal' THEN 0.5
      WHEN mr.category = 'disturbing' AND mr.subcategory = 'psychologicalHorror' THEN 0.9
      WHEN mr.category = 'disturbing' AND mr.subcategory = 'intenseSituations' THEN 0.5
      ELSE 1.0
    END as weight
  FROM movie_ratings mr
  GROUP BY mr.movie_id, mr.category, mr.subcategory
)
SELECT 
  movie_id,
  ROUND(
    SUM(avg_rating * ABS(weight)) / NULLIF(SUM(ABS(weight)), 0),
    1
  ) as dreadscore,
  SUM(rating_count) as total_ratings,
  COUNT(DISTINCT category || '_' || subcategory) as categories_rated
FROM weighted_ratings
GROUP BY movie_id;

-- Create view for user rating statistics
CREATE OR REPLACE VIEW user_rating_stats AS
SELECT 
  user_id,
  COUNT(DISTINCT movie_id) as movies_rated,
  COUNT(*) as total_ratings,
  AVG(rating::decimal) as average_rating,
  MIN(rating) as min_rating,
  MAX(rating) as max_rating
FROM movie_ratings
GROUP BY user_id;

-- Function to get DreadScore for a specific movie
CREATE OR REPLACE FUNCTION get_movie_dreadscore(p_movie_id integer)
RETURNS decimal AS $$
BEGIN
  RETURN (
    SELECT dreadscore 
    FROM movie_dreadscore 
    WHERE movie_id = p_movie_id
  );
END;
$$ LANGUAGE plpgsql;

-- Function to find similar users based on rating patterns
CREATE OR REPLACE FUNCTION get_similar_users(p_user_id uuid, p_limit integer DEFAULT 10)
RETURNS TABLE(
  similar_user_id uuid,
  similarity_score decimal,
  common_movies integer
) AS $$
BEGIN
  RETURN QUERY
  WITH user_ratings AS (
    SELECT movie_id, category, subcategory, rating
    FROM movie_ratings
    WHERE user_id = p_user_id
  ),
  other_user_ratings AS (
    SELECT 
      mr.user_id,
      mr.movie_id,
      mr.category,
      mr.subcategory,
      mr.rating,
      ur.rating as target_user_rating
    FROM movie_ratings mr
    INNER JOIN user_ratings ur ON (
      mr.movie_id = ur.movie_id AND 
      mr.category = ur.category AND 
      mr.subcategory = ur.subcategory
    )
    WHERE mr.user_id != p_user_id
  ),
  similarity_calc AS (
    SELECT 
      our.user_id,
      COUNT(*) as common_ratings,
      -- Pearson correlation coefficient
      (
        COUNT(*) * SUM(our.rating * our.target_user_rating) - 
        SUM(our.rating) * SUM(our.target_user_rating)
      ) / NULLIF(
        SQRT(
          (COUNT(*) * SUM(our.rating * our.rating) - SUM(our.rating) * SUM(our.rating)) *
          (COUNT(*) * SUM(our.target_user_rating * our.target_user_rating) - SUM(our.target_user_rating) * SUM(our.target_user_rating))
        ), 0
      ) as correlation
    FROM other_user_ratings our
    GROUP BY our.user_id
    HAVING COUNT(*) >= 5 -- Require at least 5 common ratings
  )
  SELECT 
    sc.user_id,
    ROUND(sc.correlation, 3),
    sc.common_ratings
  FROM similarity_calc sc
  WHERE sc.correlation IS NOT NULL
  ORDER BY sc.correlation DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;