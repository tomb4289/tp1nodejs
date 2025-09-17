import { supabase, handleSupabaseError, getCurrentUser, upsertMovie } from './supabase.js'
import { showNotification } from '../utils/notifications.js'
import { addSentryBreadcrumb, captureError } from '../utils/sentry.js'

export class SupabaseChat {
  constructor() {
    this.messagesCache = new Map()
    this.cacheExpiry = 2 * 60 * 1000 // 2 minutes
  }

  // Add a new chat message to Supabase
  async addChatMessage(movieId, message, username = null, movieData = null) {
    try {
      const user = window.auth?.getCurrentUser()
      const isAnonymous = !user || !username
      const userId = typeof user === 'object' ? user.id : user
      
      // Ensure movie exists in database
      if (movieData) {
        await upsertMovie(movieData)
      }

      const { data, error } = await supabase
        .from('chat_messages')
        .insert({
          user_id: isAnonymous ? null : userId,
          movie_id: movieId,
          message: message.trim(),
          username: username || 'Anonymous',
          is_anonymous: isAnonymous
        })
        .select()
        .single()

      if (error) {
        handleSupabaseError(error, 'adding chat message')
      }

      // Clear cache for this movie
      this.clearMovieCache(movieId)

      addSentryBreadcrumb('Chat message added to Supabase', 'user_action', 'info', {
        movieId,
        isAnonymous,
        messageLength: message.length
      })

      return data
    } catch (error) {
      captureError(error, {
        tags: { type: 'chat_add_error' },
        extra: { movieId, messageLength: message.length }
      })
      throw error
    }
  }

  // Get chat messages for a specific movie from Supabase
  async getMovieChats(movieId) {
    try {
      const cacheKey = `movie_${movieId}`
      const cached = this.getCachedData(cacheKey)
      
      if (cached !== null) {
        return cached
      }

      let data, error
      
      try {
        const response = await supabase
          .from('chat_messages')
          .select('*')
          .eq('movie_id', movieId)
          .order('created_at', { ascending: true })
        
        data = response.data
        error = response.error
      } catch (fetchError) {
        // Handle network/fetch errors specifically
        console.error('Network error getting movie chats:', fetchError)
        return [] // Return empty array instead of throwing
      }

      if (error) {
        handleSupabaseError(error, 'getting movie chats')
      }

      // Transform data to match expected format
      const transformedData = (data || []).map(msg => ({
        id: msg.id,
        message: msg.message,
        username: msg.username,
        timestamp: msg.created_at,
        isRegistered: !msg.is_anonymous
      }))

      this.setCachedData(cacheKey, transformedData)
      return transformedData
    } catch (error) {
      captureError(error, {
        tags: { type: 'chat_get_error' },
        extra: { movieId }
      })
      return []
    }
  }

  // Delete a chat message (only by the author)
  async deleteChatMessage(messageId, userId = null) {
    try {
      const currentUser = userId ? { id: userId } : window.auth?.getCurrentUser()
      const targetUserId = typeof currentUser === 'object' ? currentUser.id : currentUser
      
      if (!targetUserId) {
        throw new Error('User must be logged in to delete messages')
      }

      const { error } = await supabase
        .from('chat_messages')
        .delete()
        .eq('id', messageId)
        .eq('user_id', targetUserId)

      if (error) {
        handleSupabaseError(error, 'deleting chat message')
      }

      addSentryBreadcrumb('Chat message deleted from Supabase', 'user_action', 'info', {
        messageId
      })

      return true
    } catch (error) {
      captureError(error, {
        tags: { type: 'chat_delete_error' },
        extra: { messageId }
      })
      throw error
    }
  }

  // Cache management
  getCachedData(key) {
    const cached = this.messagesCache.get(key)
    if (cached && Date.now() - cached.timestamp < this.cacheExpiry) {
      return cached.data
    }
    return null
  }

  setCachedData(key, data) {
    this.messagesCache.set(key, {
      data,
      timestamp: Date.now()
    })
  }

  clearMovieCache(movieId) {
    this.messagesCache.delete(`movie_${movieId}`)
  }

  clearAllCache() {
    this.messagesCache.clear()
  }
}

// Create singleton instance
export const chatService = new SupabaseChat()