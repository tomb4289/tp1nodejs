import { supabase, handleSupabaseError, getCurrentUser, upsertMovie } from './supabase.js'
import { showNotification } from '../utils/notifications.js'
import { addSentryBreadcrumb, captureError } from '../utils/sentry.js'
import { debounce } from '../utils/debounce.js'

export class SupabaseRatings {
  constructor() {
    this.ratingsCache = new Map()
    this.batchCache = new Map() // Cache for batch-fetched data
    this.cacheExpiry = 5 * 60 * 1000 // 5 minutes
  }

  // Batch operations for better performance
  pendingOperations = new Map();
  
  // Debounced movie upsert to avoid multiple calls
  debouncedUpsertMovie = debounce(async (movieData) => {
    if (movieData) await upsertMovie(movieData);
  }, 500);

  // Save user rating to Supabase
  async saveUserRating(movieId, category, subcategory, rating, movieData = null) {
    try {
      const user = await getCurrentUser()
      if (!user) {
        throw new Error('User must be logged in to rate movies')
      }

      // Ensure movie exists in database with debouncing
      if (movieData && !this.pendingOperations.has(`movie_${movieId}`)) {
        this.pendingOperations.set(`movie_${movieId}`, true);
        this.debouncedUpsertMovie(movieData);
      }

      // Upsert rating (insert or update)
      const { data, error } = await supabase
        .from('movie_ratings')
        .upsert({
          user_id: user.id,
          movie_id: movieId,
          category,
          subcategory,
          rating
        }, {
          onConflict: 'user_id,movie_id,category,subcategory'
        })
        .select()
        .maybeSingle()

      if (error) {
        handleSupabaseError(error, 'saving rating')
      }

      // Clear cache immediately for this movie
      this.clearMovieCache(movieId)
      
      // Clear batch cache for this user/movie to force refresh
      const batchKey = `user_ratings_${movieId}_${user.id}`
      this.batchCache.delete(batchKey)
      
      // Clear rating stats cache for this movie
      const statsKey = `rating_stats_${movieId}`
      this.batchCache.delete(statsKey)
      
      // Clear DreadScore cache for this movie
      const dreadScoreKey = `dreadscore_${movieId}`
      this.batchCache.delete(dreadScoreKey)

      addSentryBreadcrumb('Rating saved to Supabase', 'user_action', 'info', {
        movieId,
        category,
        subcategory,
        rating
      })

      return data
    } catch (error) {
      captureError(error, {
        tags: { type: 'rating_save_error' },
        extra: { movieId, category, subcategory, rating }
      })
      throw error
    }
  }

  // Get user's rating for a specific movie and category
  async getUserRating(movieId, category, subcategory, userId = null) {
    try {
      // Use cached user data instead of making new request
      const targetUserId = userId || window.auth?.getCurrentUser()?.id
      
      if (!targetUserId) {
        return null
      }

      // Check batch cache first
      const batchKey = `user_ratings_${movieId}_${targetUserId}`
      if (this.batchCache.has(batchKey)) {
        const userRatings = this.batchCache.get(batchKey)
        const ratingKey = `${category}_${subcategory}`
        return userRatings[ratingKey] || null
      }

      const { data, error } = await supabase
        .from('movie_ratings')
        .select('rating')
        .eq('user_id', targetUserId)
        .eq('movie_id', movieId)
        .eq('category', category)
        .eq('subcategory', subcategory)
        .maybeSingle()

      if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
        handleSupabaseError(error, 'getting user rating')
      }

      return data?.rating ?? null
    } catch (error) {
      console.error('Error getting user rating:', error)
      return null
    }
  }

  // Batch fetch user ratings for a movie
  async batchFetchUserRatings(movieId, userId = null) {
    try {
      const targetUserId = userId || window.auth?.getCurrentUser()?.id
      
      if (!targetUserId) {
        return {}
      }

      const batchKey = `user_ratings_${movieId}_${targetUserId}`
      
      // Check if already cached
      if (this.batchCache.has(batchKey)) {
        return this.batchCache.get(batchKey)
      }

      const { data, error } = await supabase
        .from('movie_ratings')
        .select('category, subcategory, rating')
        .eq('user_id', targetUserId)
        .eq('movie_id', movieId)

      if (error && error.code !== 'PGRST116') {
        handleSupabaseError(error, 'batch fetching user ratings')
      }

      // Transform to lookup object
      const ratingsLookup = {}
      if (data) {
        data.forEach(rating => {
          const key = `${rating.category}_${rating.subcategory}`
          ratingsLookup[key] = rating.rating
        })
      }

      // Cache the result
      this.batchCache.set(batchKey, ratingsLookup)
      
      // Set expiry
      setTimeout(() => {
        this.batchCache.delete(batchKey)
      }, this.cacheExpiry)

      return ratingsLookup
    } catch (error) {
      console.error('Error batch fetching user ratings:', error)
      return {}
    }
  }

  // Batch fetch rating stats for a movie
  async batchFetchRatingStats(movieId) {
    try {
      const batchKey = `rating_stats_${movieId}`
      
      // Check if already cached
      if (this.batchCache.has(batchKey)) {
        return this.batchCache.get(batchKey)
      }

      const { data, error } = await supabase
        .from('movie_rating_stats')
        .select('category, subcategory, average_rating, rating_count')
        .eq('movie_id', movieId)

      if (error && error.code !== 'PGRST116') {
        handleSupabaseError(error, 'batch fetching rating stats')
      }

      // Transform to lookup object
      const statsLookup = {}
      if (data) {
        data.forEach(stat => {
          const key = `${stat.category}_${stat.subcategory}`
          statsLookup[key] = {
            averageRating: stat.average_rating ? parseFloat(stat.average_rating).toFixed(1) : null,
            ratingCount: stat.rating_count || 0
          }
        })
      }

      // Cache the result
      this.batchCache.set(batchKey, statsLookup)
      
      // Set expiry
      setTimeout(() => {
        this.batchCache.delete(batchKey)
      }, this.cacheExpiry)

      return statsLookup
    } catch (error) {
      console.error('Error batch fetching rating stats:', error)
      return {}
    }
  }

  // Get DreadScore for a single movie (optimized)
  async getDreadScore(movieId) {
    try {
      const batchKey = `dreadscore_${movieId}`
      
      // Check if already cached
      if (this.batchCache.has(batchKey)) {
        return this.batchCache.get(batchKey)
      }

      const { data, error } = await supabase
        .from('movie_dreadscore')
        .select('dreadscore, total_ratings')
        .eq('movie_id', movieId)
        .maybeSingle()

      if (error) {
        if (error.code === 'PGRST116') {
          // No DreadScore available
          this.batchCache.set(batchKey, null)
          setTimeout(() => {
            this.batchCache.delete(batchKey)
          }, this.cacheExpiry)
          return null
        }
        handleSupabaseError(error, 'fetching DreadScore')
      }

      const result = data ? {
        dreadScore: data.dreadscore ? parseFloat(data.dreadscore).toFixed(1) : null,
        totalRatings: data.total_ratings || 0
      } : null

      // Cache the result
      this.batchCache.set(batchKey, result)
      
      // Set expiry
      setTimeout(() => {
        this.batchCache.delete(batchKey)
      }, this.cacheExpiry)

      return result
    } catch (error) {
      console.error('Error fetching DreadScore:', error)
      return null
    }
  }

  // Batch fetch DreadScores for multiple movies
  async batchFetchDreadScores(movieIds) {
    try {
      if (!movieIds || movieIds.length === 0) {
        return {}
      }

      // Check cache for each movie first
      const results = {}
      const uncachedIds = []
      
      for (const movieId of movieIds) {
        const cached = await this.getDreadScore(movieId)
        if (cached !== null) {
          results[movieId] = cached
        } else {
          uncachedIds.push(movieId)
        }
      }
      
      // If all were cached, return results
      if (uncachedIds.length === 0) {
        return results
      }
      
      // Fetch remaining uncached DreadScores
      const { data, error } = await supabase
        .from('movie_dreadscore')
        .select('movie_id, dreadscore, total_ratings')
        .in('movie_id', uncachedIds)

      if (error) {
        handleSupabaseError(error, 'batch fetching DreadScores')
      }

      // Process and cache results
      if (data) {
        data.forEach(score => {
          const result = {
            dreadScore: score.dreadscore ? parseFloat(score.dreadscore).toFixed(1) : null,
            totalRatings: score.total_ratings || 0
          }
          results[score.movie_id] = result
          
          // Cache individual result
          const batchKey = `dreadscore_${score.movie_id}`
          this.batchCache.set(batchKey, result)
          setTimeout(() => {
            this.batchCache.delete(batchKey)
          }, this.cacheExpiry)
        })
      }

      return results
    } catch (error) {
      console.error('Error batch fetching DreadScores:', error)
      return {}
    }
  }

  // Clear user's rating for a specific movie and category
  async clearUserRating(movieId, category, subcategory, userId = null) {
    try {
      const targetUserId = userId || window.auth?.getCurrentUser()?.id
      
      if (!targetUserId) {
        throw new Error('User must be logged in to clear ratings')
      }

      const { error } = await supabase
        .from('movie_ratings')
        .delete()
        .eq('user_id', targetUserId)
        .eq('movie_id', movieId)
        .eq('category', category)
        .eq('subcategory', subcategory)

      if (error) {
        handleSupabaseError(error, 'clearing rating')
      }

      // Clear cache for this movie
      this.clearMovieCache(movieId)

      // Clear batch cache for this user/movie
      const batchKey = `user_ratings_${movieId}_${targetUserId}`
      this.batchCache.delete(batchKey)
      
      // Clear rating stats and DreadScore cache
      const statsKey = `rating_stats_${movieId}`
      this.batchCache.delete(statsKey)
      
      const dreadScoreKey = `dreadscore_${movieId}`
      this.batchCache.delete(dreadScoreKey)

      addSentryBreadcrumb('Rating cleared from Supabase', 'user_action', 'info', {
        movieId,
        category,
        subcategory
      })

      return true
    } catch (error) {
      captureError(error, {
        tags: { type: 'rating_clear_error' },
        extra: { movieId, category, subcategory }
      })
      throw error
    }
  }

  // Clear all ratings for a user on a specific movie
  async clearAllUserRatings(movieId, userId = null) {
    try {
      const targetUserId = userId || window.auth?.getCurrentUser()?.id
      
      if (!targetUserId) {
        throw new Error('User must be logged in to clear ratings')
      }

      const { data, error } = await supabase
        .from('movie_ratings')
        .delete()
        .eq('user_id', targetUserId)
        .eq('movie_id', movieId)
        .select()

      if (error) {
        handleSupabaseError(error, 'clearing all ratings')
      }

      // Clear cache for this movie
      this.clearMovieCache(movieId)

      // Clear batch cache for this user/movie
      const batchKey = `user_ratings_${movieId}_${targetUserId}`
      this.batchCache.delete(batchKey)
      
      // Clear rating stats and DreadScore cache
      const statsKey = `rating_stats_${movieId}`
      this.batchCache.delete(statsKey)
      
      const dreadScoreKey = `dreadscore_${movieId}`
      this.batchCache.delete(dreadScoreKey)

      addSentryBreadcrumb('All ratings cleared from Supabase', 'user_action', 'info', {
        movieId,
        clearedCount: data?.length || 0
      })

      return data?.length || 0
    } catch (error) {
      captureError(error, {
        tags: { type: 'rating_clear_all_error' },
        extra: { movieId }
      })
      throw error
    }
  }

  // Get average rating for a specific category/subcategory
  async getAverageRating(movieId, category, subcategory) {
    try {
      // Try to get from batch cache first
      const batchKey = `rating_stats_${movieId}`
      if (this.batchCache.has(batchKey)) {
        const stats = this.batchCache.get(batchKey)
        const ratingKey = `${category}_${subcategory}`
        return stats[ratingKey]?.averageRating || null
      }
      
      const cacheKey = `avg_${movieId}_${category}_${subcategory}`
      const cached = this.getCachedData(cacheKey)
      if (cached !== null) {
        return cached
      }

      const { data, error } = await supabase
        .from('movie_rating_stats')
        .select('average_rating')
        .eq('movie_id', movieId)
        .eq('category', category)
        .eq('subcategory', subcategory)
        .limit(1)
        .maybeSingle()

      if (error) {
        if (error.code === 'PGRST116') {
          // No rows returned - this is normal for unrated content
          this.setCachedData(cacheKey, null)
          return null
        }
        console.error('Error getting average rating:', error)
        return null
      }

      const result = data?.average_rating ? parseFloat(data.average_rating).toFixed(1) : null
      this.setCachedData(cacheKey, result)
      
      return result
    } catch (error) {
      captureError(error, {
        tags: { type: 'rating_get_average_error' },
        extra: { movieId, category, subcategory }
      })
      return null
    }
  }

  // Get total number of ratings for a category/subcategory
  async getRatingCount(movieId, category, subcategory) {
    try {
      // Try to get from batch cache first
      const batchKey = `rating_stats_${movieId}`
      if (this.batchCache.has(batchKey)) {
        const stats = this.batchCache.get(batchKey)
        const ratingKey = `${category}_${subcategory}`
        return stats[ratingKey]?.ratingCount || 0
      }
      
      const cacheKey = `count_${movieId}_${category}_${subcategory}`
      const cached = this.getCachedData(cacheKey)
      if (cached !== null) {
        return cached
      }

      const { data, error } = await supabase
        .from('movie_rating_stats')
        .select('rating_count')
        .eq('movie_id', movieId)
        .eq('category', category)
        .eq('subcategory', subcategory)
        .limit(1)
        .maybeSingle()

      if (error) {
        if (error.code === 'PGRST116') {
          // No rows returned - this is normal for unrated content
          this.setCachedData(cacheKey, 0)
          return 0
        }
        console.error('Error getting rating count:', error)
        return 0
      }

      const result = data?.rating_count || 0
      this.setCachedData(cacheKey, result)
      
      return result
    } catch (error) {
      console.error('Error getting rating count:', error)
      return 0
    }
  }

  // Get unique users who have rated this movie (across all categories)
  async getUniqueRaterCount(movieId) {
    try {
      const cacheKey = `unique_raters_${movieId}`
      const cached = this.getCachedData(cacheKey)
      
      if (cached !== null) {
        return cached
      }

      const { data, error } = await supabase
        .from('movie_ratings')
        .select('user_id', { count: 'exact' })
        .eq('movie_id', movieId)

      if (error) {
        // Handle network errors gracefully for non-critical operations
        if (error?.message?.includes('Failed to fetch') || error?.name === 'TypeError') {
          console.warn('Unable to connect to Supabase for unique rater count:', error.message)
          return 0
        }
        handleSupabaseError(error, 'getting unique rater count')
        return 0
      }

      // Count unique users
      const uniqueUsers = new Set(data.map(rating => rating.user_id))
      const result = uniqueUsers.size
      
      this.setCachedData(cacheKey, result)
      return result
    } catch (error) {
      // Handle all errors gracefully for this non-critical operation
      console.warn('Unable to get unique rater count:', error.message)
      return 0
    }
  }

  // Get overall DreadScore for a movie
  async getOverallAverageRating(movieId) {
    try {
      // Use the optimized getDreadScore method
      const result = await this.getDreadScore(movieId)
      return result?.dreadScore || null
    } catch (error) {
      return Promise.resolve(null)
    }
  }

  // Get unique rater count for a movie (optimized)
  async getUniqueRaterCount(movieId) {
    try {
      // Try to get from DreadScore cache first
      const dreadScoreResult = await this.getDreadScore(movieId)
      if (dreadScoreResult && dreadScoreResult.totalRatings) {
        // Use total ratings from DreadScore view as approximation
        return Math.ceil(dreadScoreResult.totalRatings / 10) // Rough estimate
      }
      
      const cacheKey = `unique_raters_${movieId}`
      const cached = this.getCachedData(cacheKey)
      if (cached !== null) {
        return cached
      }

      const { data, error } = await supabase
        .from('movie_ratings')
        .select('user_id', { count: 'exact' })
        .eq('movie_id', movieId)
        .limit(1)
        .maybeSingle()

      if (error) {
        // Handle network errors gracefully for non-critical operations
        if (error?.message?.includes('Failed to fetch') || error?.name === 'TypeError') {
          console.warn('Unable to connect to Supabase for unique rater count:', error.message)
          return 0
        }
        handleSupabaseError(error, 'getting unique rater count')
        return 0
      }

      // Count unique users
      const uniqueUsers = new Set(data.map(rating => rating.user_id))
      const result = uniqueUsers.size
      
      this.setCachedData(cacheKey, result)
      return result
    } catch (error) {
      // Handle all errors gracefully for this non-critical operation
      console.warn('Unable to get unique rater count:', error.message)
      return 0
    }
  }

  // Get count of unique movies a user has rated
  async getMoviesRatedCount(userId = null) {
    try {
      const targetUserId = userId || window.auth?.getCurrentUser()?.id
      
      if (!targetUserId) {
        return 0
      }

      const { data, error } = await supabase
        .from('movie_ratings')
        .select('movie_id')
        .eq('user_id', targetUserId)

      if (error) {
        // Handle network errors gracefully for non-critical operations
        if (error?.message?.includes('Failed to fetch') || error?.name === 'TypeError') {
          console.warn('Unable to connect to Supabase for movies rated count:', error.message)
          return 0
        }
        handleSupabaseError(error, 'getting movies rated count')
      }

      // Count unique movies
      const uniqueMovies = new Set(data.map(rating => rating.movie_id))
      return uniqueMovies.size
    } catch (error) {
      // Handle all errors gracefully for this non-critical operation
      console.warn('Unable to get movies rated count:', error.message)
      return 0
    }
  }

  // Check if user has any ratings for a movie
  async hasUserRatings(movieId, userId = null) {
    try {
      const targetUserId = userId || window.auth?.getCurrentUser()?.id
      
      if (!targetUserId) {
        return false
      }

      const { data, error } = await supabase
        .from('movie_ratings')
        .select('id')
        .eq('user_id', targetUserId)
        .eq('movie_id', movieId)
        .limit(1)

      if (error) {
        handleSupabaseError(error, 'checking user ratings')
      }

      return data.length > 0
    } catch (error) {
      return false
    }
  }

  // Get movies filtered by multiple rating criteria
  async getMoviesWithRatings(filters, sortOrder = 'desc', limit = 20, offset = 0) {
    try {
      // For now, return empty array as this is complex to implement with multiple filters
      // The frontend will handle filtering by checking each movie individually
      return []
    } catch (error) {
      return []
    }
  }

  // Get movies that have any ratings (for DreadScore sorting)
  async getMoviesWithAnyRatings(limit = 100) {
    try {
      const { data, error } = await supabase
        .from('movie_dreadscore')
        .select(`
          movie_id,
          dreadscore,
          movies (*)
        `)
        .order('dreadscore', { ascending: false })
        .limit(limit)

      if (error) {
        handleSupabaseError(error, 'getting movies with ratings')
      }

      return (data || []).map(item => ({
        ...item.movies,
        dreadScore: item.dreadscore
      }))
    } catch (error) {
      return []
    }
  }

  // Cache management
  getCachedData(key) {
    const cached = this.ratingsCache.get(key)
    if (cached && Date.now() - cached.timestamp < this.cacheExpiry) {
      return cached.data
    }
    return null
  }

  setCachedData(key, data) {
    this.ratingsCache.set(key, {
      data,
      timestamp: Date.now()
    })
  }

  clearMovieCache(movieId) {
    // Clear all cache entries for this movie
    for (const key of this.ratingsCache.keys()) {
      if (key.includes(`_${movieId}_`) || key.includes(`${movieId}`)) {
        this.ratingsCache.delete(key)
      }
    }
    
    // Clear batch cache entries for this movie
    for (const key of this.batchCache.keys()) {
      if (key.includes(`_${movieId}_`) || key.includes(`${movieId}`)) {
        this.batchCache.delete(key)
      }
    }
  }

  clearAllCache() {
    this.ratingsCache.clear()
    this.batchCache.clear()
  }
}

// Create singleton instance
export const ratingsService = new SupabaseRatings()