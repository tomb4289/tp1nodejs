import { supabase, handleSupabaseError, getUserProfile } from './supabase.js'
import { showNotification } from '../utils/notifications.js'
import { setSentryUser, clearSentryUser, addSentryBreadcrumb } from '../utils/sentry.js'

export class SupabaseAuth {
  constructor() {
    this.currentUser = null
    this.eventListenersInitialized = false
    this.isProcessingAuth = false
    this._isInitialized = false
    this.initialize()
  }

  async initialize() {
    // Set a flag to indicate we're initializing
    this._isInitialized = false
    
    // Check for existing session
    const { data: { session } } = await supabase.auth.getSession()
    
    if (session?.user) {
      await this.handleUserSession(session.user)
    } else {
      // No session found, clear any stale data
      this.currentUser = null
      localStorage.removeItem('currentUser')
    }
    
    // Mark as initialized
    this._isInitialized = true
    
    // Dispatch initialization complete event
    document.dispatchEvent(new CustomEvent('authInitialized', { 
      detail: { user: this.currentUser } 
    }))

    // Listen for auth changes
    supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('Auth state changed:', event, session?.user?.email)
      
      // Prevent duplicate processing
      if (this.isProcessingAuth) {
        console.log('Already processing auth change, skipping...')
        return
      }
      
      if (event === 'SIGNED_IN' && session?.user) {
        this.isProcessingAuth = true
        await this.handleUserSession(session.user)
        this.isProcessingAuth = false
      } else if (event === 'SIGNED_OUT') {
        await this.handleSignOut()
      }
    })
  }

  async handleUserSession(user) {
    try {
      // Prevent duplicate processing
      if (this.currentUser && this.currentUser.id === user.id) {
        console.log('User session already processed, skipping...')
        return
      }
      
      // Wait a moment for the trigger to potentially create the profile
      await new Promise(resolve => setTimeout(resolve, 1000))
      
      // Get user profile from database
      let profile = await getUserProfile(user.id)
      
      // If no profile exists, create one manually
      if (!profile) {
        console.log('No profile found, creating manually...')
        await this.createUserProfile(user, {
          firstName: user.user_metadata?.first_name || 'User',
          lastName: user.user_metadata?.last_name || 'Name',
          dateOfBirth: user.user_metadata?.date_of_birth || null,
          phone: user.user_metadata?.phone || null,
          bio: user.user_metadata?.bio || ''
        })
        
        // Try to get the profile again
        profile = await getUserProfile(user.id)
      }
      
      if (profile) {
        this.currentUser = {
          id: user.id,
          email: user.email,
          firstName: profile.first_name,
          lastName: profile.last_name,
          dateOfBirth: profile.date_of_birth,
          phone: profile.phone,
          bio: profile.bio,
          avatar: {
            color: profile.avatar_color,
            initials: profile.avatar_initials
          },
          createdAt: profile.created_at,
          lastLogin: new Date().toISOString()
        }

        // Set Sentry user context
        setSentryUser(this.currentUser)
        addSentryBreadcrumb('User signed in', 'auth', 'info', { userId: this.currentUser.id })

        // Store in localStorage for compatibility with existing code
        localStorage.setItem('currentUser', JSON.stringify(this.currentUser))
        
        // Dispatch custom event for other modules (only once)
        setTimeout(() => {
          document.dispatchEvent(new CustomEvent('userLoggedIn', { detail: this.currentUser }))
        }, 100)
      } else {
        console.error('Failed to create or retrieve user profile')
        throw new Error('Failed to create user profile')
      }
    } catch (error) {
      console.error('Error handling user session:', error)
      showNotification('Error setting up user account', 'error')
    } finally {
      this.isProcessingAuth = false
    }
  }

  async handleSignOut() {
    this.currentUser = null
    clearSentryUser()
    addSentryBreadcrumb('User signed out', 'auth', 'info')
    
    // Clear localStorage
    localStorage.removeItem('currentUser')
    
    // Dispatch custom event
    document.dispatchEvent(new CustomEvent('userLoggedOut'))
  }

  async signUp(userData) {
    try {
      // First, try to sign up the user
      const { data, error } = await supabase.auth.signUp({
        email: userData.email,
        password: userData.password,
        options: {
          data: {
            first_name: userData.firstName,
            last_name: userData.lastName,
            date_of_birth: userData.dateOfBirth,
            phone: userData.phone,
            bio: userData.bio || ''
          }
        }
      })

      if (error) {
        handleSupabaseError(error, 'signing up')
      }

      // For development/testing with email confirmation disabled
      if (data.user && data.user.email_confirmed_at) {
        // User is immediately confirmed, handle the session
        await this.handleUserSession(data.user)
        return { user: data.user, needsConfirmation: false }
      } else if (data.user) {
        // Email confirmation required
        showNotification('Please check your email to confirm your account', 'info')
        return { user: data.user, needsConfirmation: true }
      }

      return { user: data.user, needsConfirmation: false }
    } catch (error) {
      console.error('Sign up error:', error)
      throw error
    }
  }

  async createUserProfile(user, userData) {
    try {
      // Generate avatar initials and color
      const initials = (userData.firstName.charAt(0) + userData.lastName.charAt(0)).toUpperCase()
      const colors = ['#6366f1', '#8b5cf6', '#ec4899', '#ef4444', '#f59e0b', '#10b981', '#06b6d4', '#3b82f6']
      const color = colors[Math.floor(Math.random() * colors.length)]

      const { error } = await supabase
        .from('profiles')
        .insert({
          id: user.id,
          first_name: userData.firstName,
          last_name: userData.lastName,
          email: user.email,
          date_of_birth: userData.dateOfBirth || null,
          phone: userData.phone || null,
          bio: userData.bio || '',
          avatar_color: color,
          avatar_initials: initials
        })

      if (error) {
        console.error('Error creating profile manually:', error)
        throw error
      }
      
      console.log('Profile created successfully')
    } catch (error) {
      console.error('Error in createUserProfile:', error)
      throw error
    }
  }

  async signIn(email, password) {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      })

      if (error) {
        handleSupabaseError(error, 'signing in')
      }

      return data.user
    } catch (error) {
      console.error('Sign in error:', error)
      throw error
    }
  }

  async signOut() {
    try {
      const { error } = await supabase.auth.signOut()
      
      if (error) {
        handleSupabaseError(error, 'signing out')
      }
    } catch (error) {
      console.error('Sign out error:', error)
      throw error
    }
  }

  async updateProfile(updates) {
    try {
      if (!this.currentUser) {
        throw new Error('No user logged in')
      }

      const { error } = await supabase
        .from('profiles')
        .update({
          first_name: updates.firstName,
          last_name: updates.lastName,
          date_of_birth: updates.dateOfBirth,
          phone: updates.phone,
          bio: updates.bio
        })
        .eq('id', this.currentUser.id)

      if (error) {
        handleSupabaseError(error, 'updating profile')
      }

      // Update current user object
      this.currentUser = {
        ...this.currentUser,
        firstName: updates.firstName,
        lastName: updates.lastName,
        dateOfBirth: updates.dateOfBirth,
        phone: updates.phone,
        bio: updates.bio
      }

      // Update localStorage
      localStorage.setItem('currentUser', JSON.stringify(this.currentUser))

      return this.currentUser
    } catch (error) {
      console.error('Update profile error:', error)
      throw error
    }
  }

  getCurrentUser() {
    // During initialization, try to get user from localStorage as fallback
    if (!this._isInitialized && !this.currentUser) {
      try {
        const storedUser = localStorage.getItem('currentUser')
        if (storedUser) {
          return JSON.parse(storedUser)
        }
      } catch (error) {
        console.warn('Error parsing stored user:', error)
      }
    }
    return this.currentUser
  }

  isLoggedIn() {
    // During initialization, check localStorage as fallback
    if (!this._isInitialized) {
      try {
        const storedUser = localStorage.getItem('currentUser')
        return !!storedUser
      } catch (error) {
        return false
      }
    }
    return !!this.currentUser
  }
  
  isInitialized() {
    return this._isInitialized
  }
}

// Create singleton instance
export const authService = new SupabaseAuth()