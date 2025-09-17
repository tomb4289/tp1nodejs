// OMDb Rating Cache System
// Stores real ratings locally to use as fallbacks when API limit is reached

class OMDbCache {
  constructor() {
    this.cacheKey = 'omdb_ratings_cache';
    this.metaKey = 'omdb_cache_meta';
    this.maxCacheSize = 1000; // Maximum number of movies to cache
    this.cacheExpiry = 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds
  }

  // Get cached rating for a movie
  getCachedRating(movieTitle, year) {
    try {
      const cache = this.getCache();
      const key = this.generateKey(movieTitle, year);
      
      const cachedData = cache[key];
      if (cachedData && this.isValidCache(cachedData) && this.hasValidRatings(cachedData.ratings)) {
        console.log('Using cached OMDb rating for', movieTitle, ':', cachedData.ratings);
        return cachedData.ratings;
      }
      
      return null;
    } catch (error) {
      console.warn('Error reading OMDb cache:', error);
      return null;
    }
  }

  // Check if cached ratings have valid (non-null) values
  hasValidRatings(ratings) {
    if (!ratings) return false;
    
    // Consider ratings valid if at least one rating is not null
    return ratings.imdbRating !== null || ratings.rottenTomatoesRating !== null;
  }

  // Store rating in cache
  setCachedRating(movieTitle, year, ratings) {
    try {
      const cache = this.getCache();
      const key = this.generateKey(movieTitle, year);
      
      // Store with timestamp
      cache[key] = {
        ratings,
        timestamp: Date.now(),
        movieTitle,
        year
      };
      
      // Clean up old entries if cache is too large
      this.cleanupCache(cache);
      
      // Save to localStorage
      localStorage.setItem(this.cacheKey, JSON.stringify(cache));
      
      // Update metadata
      this.updateCacheMeta();
      
      console.log('Cached OMDb rating for', movieTitle, ':', ratings);
    } catch (error) {
      console.warn('Error saving to OMDb cache:', error);
    }
  }

  // Generate cache key for a movie
  generateKey(movieTitle, year) {
    const normalizedTitle = movieTitle.toLowerCase().replace(/[^a-z0-9]/g, '');
    return `${normalizedTitle}_${year || 'unknown'}`;
  }

  // Get the entire cache
  getCache() {
    try {
      const cacheData = localStorage.getItem(this.cacheKey);
      return cacheData ? JSON.parse(cacheData) : {};
    } catch (error) {
      console.warn('Error parsing OMDb cache:', error);
      return {};
    }
  }

  // Check if cached data is still valid
  isValidCache(cachedData) {
    if (!cachedData || !cachedData.timestamp) {
      return false;
    }
    
    const age = Date.now() - cachedData.timestamp;
    return age < this.cacheExpiry;
  }

  // Clean up old or excess cache entries
  cleanupCache(cache) {
    const entries = Object.entries(cache);
    
    // Remove expired entries
    const validEntries = entries.filter(([key, data]) => this.isValidCache(data));
    
    // If still too many entries, remove oldest ones
    if (validEntries.length > this.maxCacheSize) {
      validEntries.sort((a, b) => b[1].timestamp - a[1].timestamp); // Sort by timestamp, newest first
      const keepEntries = validEntries.slice(0, this.maxCacheSize);
      
      // Clear cache and rebuild with kept entries
      const newCache = {};
      keepEntries.forEach(([key, data]) => {
        newCache[key] = data;
      });
      
      // Replace cache content
      Object.keys(cache).forEach(key => delete cache[key]);
      Object.assign(cache, newCache);
      
      console.log(`Cleaned up OMDb cache: kept ${keepEntries.length} entries`);
    }
  }

  // Update cache metadata
  updateCacheMeta() {
    const meta = {
      lastUpdated: Date.now(),
      totalEntries: Object.keys(this.getCache()).length,
      version: '1.0'
    };
    
    localStorage.setItem(this.metaKey, JSON.stringify(meta));
  }

  // Get cache statistics
  getCacheStats() {
    const cache = this.getCache();
    const entries = Object.values(cache);
    const validEntries = entries.filter(data => this.isValidCache(data));
    
    return {
      totalEntries: entries.length,
      validEntries: validEntries.length,
      expiredEntries: entries.length - validEntries.length,
      oldestEntry: entries.length > 0 ? Math.min(...entries.map(e => e.timestamp)) : null,
      newestEntry: entries.length > 0 ? Math.max(...entries.map(e => e.timestamp)) : null,
      cacheSize: this.estimateCacheSize()
    };
  }

  // Estimate cache size in KB
  estimateCacheSize() {
    try {
      const cacheData = localStorage.getItem(this.cacheKey);
      return cacheData ? Math.round(cacheData.length / 1024) : 0;
    } catch (error) {
      return 0;
    }
  }

  // Clear entire cache
  clearCache() {
    localStorage.removeItem(this.cacheKey);
    localStorage.removeItem(this.metaKey);
    console.log('OMDb cache cleared');
  }

  // Get a fallback rating from cache (any similar movie)
  getFallbackRating(movieTitle) {
    try {
      const cache = this.getCache();
      const entries = Object.values(cache).filter(data => this.isValidCache(data));
      
      if (entries.length === 0) {
        console.log('DEBUG: No cache entries available for fallback');
        return null;
      }
      
      // Try to find a movie with similar title first
      const normalizedTitle = movieTitle.toLowerCase();
      const similarMovie = entries.find(entry => {
        const entryTitle = entry.movieTitle.toLowerCase();
        const titleWords = normalizedTitle.split(' ').filter(word => word.length > 2);
        const entryWords = entryTitle.split(' ').filter(word => word.length > 2);
        
        // Check if any significant words match
        return titleWords.some(word => entryWords.some(entryWord => 
          entryWord.includes(word) || word.includes(entryWord)
        ));
      });
      
      if (similarMovie) {
        console.log('DEBUG: Using similar movie rating as fallback for', movieTitle, ':', similarMovie.ratings);
        return similarMovie.ratings;
      }
      
      // Otherwise, return a rating from a movie with similar score range
      // Prefer movies with moderate ratings (7-9 range) as they're more common
      const moderateRatings = entries.filter(entry => {
        const rating = parseFloat(entry.ratings.imdbRating);
        return rating >= 7.0 && rating <= 9.0;
      });
      
      const sourceEntries = moderateRatings.length > 0 ? moderateRatings : entries;
      const randomEntry = sourceEntries[Math.floor(Math.random() * sourceEntries.length)];
      
      console.log('DEBUG: Using cached rating as fallback for', movieTitle, ':', randomEntry.ratings);
      return randomEntry.ratings;
      
    } catch (error) {
      console.warn('Error getting fallback rating:', error);
      return null;
    }
  }

  // Export cache data for backup
  exportCache() {
    const cache = this.getCache();
    const meta = this.getCacheStats();
    
    return {
      cache,
      meta,
      exportDate: new Date().toISOString()
    };
  }

  // Import cache data from backup
  importCache(data) {
    try {
      if (data.cache && typeof data.cache === 'object') {
        localStorage.setItem(this.cacheKey, JSON.stringify(data.cache));
        this.updateCacheMeta();
        console.log('OMDb cache imported successfully');
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error importing OMDb cache:', error);
      return false;
    }
  }
}

// Create singleton instance
export const omdbCache = new OMDbCache();

// Export utility functions
export function getCachedOMDbRating(movieTitle, year) {
  return omdbCache.getCachedRating(movieTitle, year);
}

export function setCachedOMDbRating(movieTitle, year, ratings) {
  omdbCache.setCachedRating(movieTitle, year, ratings);
}

export function getFallbackOMDbRating(movieTitle) {
  return omdbCache.getFallbackRating(movieTitle);
}

export function getOMDbCacheStats() {
  return omdbCache.getCacheStats();
}

export function clearOMDbCache() {
  omdbCache.clearCache();
}