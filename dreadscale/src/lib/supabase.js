import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables. Please check your .env file.')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true
  }
})

// Helper function to handle Supabase errors
export function handleSupabaseError(error, context = '') {
  console.error(`Supabase error ${context}:`, error)
  
  // Handle network errors specifically
  if (error?.message === 'Failed to fetch' || error?.name === 'TypeError') {
    throw new Error('Unable to connect to the database. Please check your internet connection and try again.')
  }
  
  if (error?.message) {
    throw new Error(error.message)
  }
  
  throw new Error('An unexpected database error occurred')
}

// Helper function to get current user
export async function getCurrentUser() {
  try {
    // First try to get user from auth service (cached)
    if (window.authService && window.authService.isInitialized()) {
      const cachedUser = window.authService.getCurrentUser()
      if (cachedUser) {
        return { id: cachedUser.id, email: cachedUser.email }
      }
    }
    
    // Fallback to direct Supabase call only if auth service not available
    const { data: { user }, error } = await supabase.auth.getUser()
    
    if (error) {
      handleSupabaseError(error, 'getting current user')
    }
    
    return user
  } catch (error) {
    // Handle network/connection errors gracefully
    console.warn('Unable to connect to Supabase:', error.message)
    return null
  }
}

// Helper function to get user profile
export async function getUserProfile(userId = null) {
  const targetUserId = userId || (await getCurrentUser())?.id
  
  if (!targetUserId) {
    return null
  }
  
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', targetUserId)
    .maybeSingle()
  
  if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
    handleSupabaseError(error, 'getting user profile')
  }
  
  return data
}

// Helper function to upsert movie data
export async function upsertMovie(movieData) {
  const { data, error } = await supabase
    .from('movies')
    .upsert({
      id: movieData.id,
      title: movieData.title,
      overview: movieData.overview || '',
      poster_path: movieData.poster_path,
      backdrop_path: movieData.backdrop_path,
      release_date: movieData.release_date,
      vote_average: movieData.vote_average,
      vote_count: movieData.vote_count,
      popularity: movieData.popularity,
      runtime: movieData.runtime,
      genres: movieData.genres || [],
      production_companies: movieData.production_companies || []
    }, {
      onConflict: 'id'
    })
    .select()
    .maybeSingle()
  
  if (error) {
    handleSupabaseError(error, 'upserting movie')
  }
  
  return data
}

// Helper function to check if user is authenticated
export function isAuthenticated() {
  return supabase.auth.getSession().then(({ data: { session } }) => !!session)
}

// Helper function to sign out
export async function signOut() {
  const { error } = await supabase.auth.signOut()
  
  if (error) {
    handleSupabaseError(error, 'signing out')
  }
}