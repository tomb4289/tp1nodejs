import { supabase, handleSupabaseError, getCurrentUser, upsertMovie } from './supabase.js'
import { showNotification } from '../utils/notifications.js'
import { addSentryBreadcrumb, captureError } from '../utils/sentry.js'

export class SupabaseWatchlist {
  constructor() {
    this.watchlistCache = new Map()
    this.cacheExpiry = 5 * 60 * 1000 // 5 minutes
  }

  // Add movie to user's watchlist
  async addToWatchlist(movieData) {
    try {
      const user = window.auth?.getCurrentUser()
      if (!user) {
        throw new Error('User must be logged in to add movies to watchlist')
      }

      const userId = typeof user === 'object' ? user.id : user;

      // Ensure movie exists in database with proper data structure
      const movieToUpsert = {
        id: movieData.id,
        title: movieData.title || 'Unknown Title',
        overview: movieData.overview || '',
        poster_path: movieData.poster_path || null,
        backdrop_path: movieData.backdrop_path || null,
        release_date: movieData.release_date || null,
        vote_average: movieData.vote_average || 0,
        vote_count: movieData.vote_count || 0,
        popularity: movieData.popularity || 0,
        runtime: movieData.runtime || null,
        genres: movieData.genres || [],
        production_companies: movieData.production_companies || []
      };
      
      await upsertMovie(movieToUpsert)

      // Add to watchlist
      const { data, error } = await supabase
        .from('watchlists')
        .insert({
          user_id: userId,
          movie_id: movieData.id
        })
        .select()
        .maybeSingle()

      if (error) {
        // Check if it's a duplicate entry error
        if (error.code === '23505') {
          return false // Movie already in watchlist
        }
        handleSupabaseError(error, 'adding to watchlist')
      }

      // Clear cache
      this.clearUserCache(userId)

      addSentryBreadcrumb('Movie added to watchlist', 'user_action', 'info', {
        movieId: movieData.id,
        movieTitle: movieData.title
      })

      return true
    } catch (error) {
      captureError(error, {
        tags: { type: 'watchlist_add_error' },
        extra: { movieId: movieData.id, movieTitle: movieData.title }
      })
      throw error
    }
  }

  // Remove movie from user's watchlist
  async removeFromWatchlist(movieId) {
    try {
      const user = window.auth?.getCurrentUser()
      if (!user) {
        throw new Error('User must be logged in to remove movies from watchlist')
      }

      const userId = typeof user === 'object' ? user.id : user;

      const { error } = await supabase
        .from('watchlists')
        .delete()
        .eq('user_id', userId)
        .eq('movie_id', movieId)

      if (error) {
        handleSupabaseError(error, 'removing from watchlist')
      }

      // Clear cache
      this.clearUserCache(userId)

      addSentryBreadcrumb('Movie removed from watchlist', 'user_action', 'info', {
        movieId
      })

      return true
    } catch (error) {
      captureError(error, {
        tags: { type: 'watchlist_remove_error' },
        extra: { movieId }
      })
      throw error
    }
  }

  // Check if movie is in user's watchlist
  async isInWatchlist(movieId) {
    try {
      const user = window.auth?.getCurrentUser()
      if (!user) {
        return false
      }

      const userId = typeof user === 'object' ? user.id : user;

      const { data, error } = await supabase
        .from('watchlists')
        .select('id')
        .eq('user_id', userId)
        .eq('movie_id', movieId)
        .maybeSingle()

      if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
        handleSupabaseError(error, 'checking watchlist')
      }

      return !!data
    } catch (error) {
      return false
    }
  }

  // Get user's complete watchlist
  async getUserWatchlist(userId = null) {
    try {
      const currentUser = userId ? { id: userId } : window.auth?.getCurrentUser()
      const targetUserId = typeof currentUser === 'object' ? currentUser.id : currentUser
      
      if (!targetUserId) {
        return []
      }

      const cacheKey = `user_${targetUserId}`
      const cached = this.getCachedData(cacheKey)
      
      if (cached !== null) {
        return cached
      }

      const { data, error } = await supabase
        .from('watchlists')
        .select(`
          *,
          movies (
            id,
            title,
            overview,
            poster_path,
            release_date,
            vote_average
          )
        `)
        .eq('user_id', targetUserId)
        .order('added_at', { ascending: false })

      if (error) {
        handleSupabaseError(error, 'getting user watchlist')
      }

      // Transform data to match expected format
      const transformedData = (data || []).map(item => ({
        id: item.movie_id, // Use the movie_id from watchlist table directly
        title: item.movies?.title || 'Unknown Title',
        overview: item.movies?.overview || '',
        poster_path: item.movies?.poster_path || null,
        release_date: item.movies?.release_date || null,
        vote_average: item.movies?.vote_average || 0,
        addedAt: item.added_at
      }));
      
      console.log('Transformed watchlist data:', transformedData); // Debug log

      this.setCachedData(cacheKey, transformedData)
      return transformedData
    } catch (error) {
      captureError(error, {
        tags: { type: 'watchlist_get_error' },
        extra: { userId }
      })
      return []
    }
  }

  // Get user's watchlist count
  async getUserWatchlistCount(userId = null) {
    try {
      const currentUser = userId ? { id: userId } : window.auth?.getCurrentUser()
      const targetUserId = typeof currentUser === 'object' ? currentUser.id : currentUser
      
      if (!targetUserId) {
        return 0
      }

      const { count, error } = await supabase
        .from('watchlists')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', targetUserId)

      if (error) {
        handleSupabaseError(error, 'getting watchlist count')
      }

      return count || 0
    } catch (error) {
      return 0
    }
  }

  // Import multiple movies to watchlist
  async importWatchlist(movies, onProgress = null) {
    try {
      const user = window.auth?.getCurrentUser()
      if (!user) {
        throw new Error('User must be logged in to import watchlist')
      }

      let successCount = 0
      let failedMovies = []

      for (let i = 0; i < movies.length; i++) {
        const movie = movies[i]
        
        if (onProgress) {
          onProgress(i + 1, movies.length, movie.title)
        }

        try {
          const wasAdded = await this.addToWatchlist(movie)
          if (wasAdded) {
            successCount++
          }
        } catch (error) {
          console.error(`Failed to add ${movie.title}:`, error)
          failedMovies.push(movie)
        }

        // Small delay to avoid overwhelming the database
        await new Promise(resolve => setTimeout(resolve, 50))
      }

      addSentryBreadcrumb('Watchlist import completed', 'user_action', 'info', {
        successCount,
        failedCount: failedMovies.length,
        totalMovies: movies.length
      })

      return {
        successCount,
        failedMovies,
        totalProcessed: movies.length
      }
    } catch (error) {
      captureError(error, {
        tags: { type: 'watchlist_import_error' },
        extra: { movieCount: movies.length }
      })
      throw error
    }
  }

  // Cache management
  getCachedData(key) {
    const cached = this.watchlistCache.get(key)
    if (cached && Date.now() - cached.timestamp < this.cacheExpiry) {
      return cached.data
    }
    return null
  }

  setCachedData(key, data) {
    this.watchlistCache.set(key, {
      data,
      timestamp: Date.now()
    })
  }

  clearUserCache(userId) {
    this.watchlistCache.delete(`user_${userId}`)
  }

  clearAllCache() {
    this.watchlistCache.clear()
  }
}

// Create singleton instance
export const watchlistService = new SupabaseWatchlist()