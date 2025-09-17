export async function initializeRouter(modules = {}) {
  const { addSentryBreadcrumb, captureError } = await import('./utils/sentry.js');
  
  let currentRoute = '';
  let currentMovieId = null;
  let movieNavigationList = []; // Store the current list of movies for navigation
  let navigationContext = 'movies'; // Track navigation context: 'movies', 'watchlist', 'search'
  let navigationCache = new Map(); // Cache navigation data
  
  // Extract modules from parameters
  const { auth, watchlist, ratings, chat, moviesModule } = modules;

  // Route handlers
  const routes = {
    '/': () => showSection('#movies'),
    '/movies': () => showSection('#movies'),
    '/search-plus': () => showSection('#advancedSearch'),
    '/advanced-search': () => showSection('#advancedSearch'), // Keep old route for compatibility
    '/account': () => showSection('#account'),
    '/about': () => showSection('#about'),
    '/movie/:id': (id) => showMoviePage(id)
  };

  // Initialize router
  function init() {
    // Handle browser back/forward buttons
    window.addEventListener('popstate', handlePopState);
    
    // Handle initial page load
    handleRoute(window.location.pathname + window.location.search);
  }

  // Handle route changes
  function handleRoute(path) {
    // Parse movie ID from path
    const movieMatch = path.match(/\/movie\/(\d+)/);
    if (movieMatch) {
      const movieId = movieMatch[1];
      routes['/movie/:id'](movieId);
      return;
    }

    // Handle other routes
    const route = routes[path] || routes['/'];
    route();
  }

  // Handle browser navigation
  function handlePopState(event) {
    handleRoute(window.location.pathname + window.location.search);
  }

  // Navigate to a new route
  function navigateTo(path, pushState = true) {
    addSentryBreadcrumb('Route navigation', 'navigation', 'info', { 
      from: currentRoute, 
      to: path 
    });
    
    if (pushState) {
      window.history.pushState({}, '', path);
    }
    handleRoute(path);
  }

  // Show movie details page
  async function showMoviePage(movieId) {
    currentMovieId = movieId;
    currentRoute = `/movie/${movieId}`;
    
    // Determine navigation context and load appropriate movie list
    await determineNavigationContext(movieId);
    
    // Hide all main sections
    const allSections = document.querySelectorAll('.main-content-section');
    allSections.forEach(section => {
      section.classList.remove('active');
    });

    // Show movie page section
    let movieSection = document.getElementById('moviePage');
    if (!movieSection) {
      // Create movie page section if it doesn't exist
      movieSection = document.createElement('section');
      movieSection.id = 'moviePage';
      movieSection.className = 'movie-page main-content-section';
      document.querySelector('main').appendChild(movieSection);
    }

    movieSection.classList.add('active');
    movieSection.innerHTML = `
      <div class="container">
        <div class="movie-page-loading">
          <div class="loading-spinner"></div>
          <p>Loading movie details...</p>
        </div>
      </div>
    `;

    // Scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' });

    // Load movie details
    try {
      await loadMovieDetails(movieId, movieSection);
    } catch (error) {
      captureError(error, {
        tags: { type: 'movie_page_error' },
        extra: { movieId }
      });
      showMovieError(movieSection, movieId);
    }
  }

  // Determine what context we're navigating from and load appropriate movie list
  async function determineNavigationContext(movieId) {
    // Check cache first
    const cacheKey = `context_${movieId}`;
    if (navigationCache.has(cacheKey)) {
      const cached = navigationCache.get(cacheKey);
      movieNavigationList = cached.list;
      navigationContext = cached.context;
      console.log('Using cached navigation context:', navigationContext, 'with', movieNavigationList.length, 'movies');
      return;
    }
    
    const currentUser = auth?.getCurrentUser();
    
    // Check if movie is in user's watchlist
    if (currentUser && watchlist) {
      try {
        // Use faster sync method if available, otherwise fall back to async
        const userWatchlist = watchlist.getUserWatchlistSync ? 
          await watchlist.getUserWatchlistSync() : 
          await watchlist.getUserWatchlist();
          
        const isInWatchlist = userWatchlist.some(movie => movie.id === parseInt(movieId));
        
        if (isInWatchlist && userWatchlist.length > 0) {
          // Use watchlist for navigation
          movieNavigationList = userWatchlist.map(movie => movie.id);
          navigationContext = 'watchlist';
          
          // Cache the result
          navigationCache.set(cacheKey, {
            list: movieNavigationList,
            context: navigationContext,
            timestamp: Date.now()
          });
          
          console.log('Using watchlist navigation context with', movieNavigationList.length, 'movies');
          return;
        }
      } catch (error) {
        console.warn('Could not check watchlist for navigation context:', error);
      }
    }
    
    // Check if we have loaded movies from the movies module
    if (moviesModule && moviesModule.getLoadedMovieIds) {
      const loadedMovies = moviesModule.getLoadedMovieIds();
      if (loadedMovies.length > 0) {
        movieNavigationList = loadedMovies;
        navigationContext = 'movies';
        
        // Cache the result
        navigationCache.set(cacheKey, {
          list: movieNavigationList,
          context: navigationContext,
          timestamp: Date.now()
        });
        
        console.log('Using movies navigation context with', movieNavigationList.length, 'movies');
        return;
      }
    }
    
    // Fallback: load popular movies for navigation
    try {
      await loadPopularMoviesForNavigation();
      navigationContext = 'movies';
      
      // Cache the result
      navigationCache.set(cacheKey, {
        list: movieNavigationList,
        context: navigationContext,
        timestamp: Date.now()
      });
      
      console.log('Using fallback navigation context with', movieNavigationList.length, 'movies');
    } catch (error) {
      console.warn('Could not load movies for navigation:', error);
      movieNavigationList = [];
      navigationContext = 'movies';
    }
  }

  // Load popular movies for navigation fallback
  async function loadPopularMoviesForNavigation() {
    try {
      const TMDB_API_KEY = import.meta.env.VITE_TMDB_API_KEY;
      const TMDB_BASE_URL = 'https://api.themoviedb.org/3';
      
      if (!TMDB_API_KEY) {
        return;
      }
      
      const response = await fetch(`${TMDB_BASE_URL}/movie/popular?api_key=${TMDB_API_KEY}&page=1&language=en-US`);
      
      if (!response.ok) {
        return;
      }
      
      const data = await response.json();
      
      if (data.results && data.results.length > 0) {
        movieNavigationList = data.results.map(movie => movie.id);
      }
    } catch (error) {
      console.warn('Error loading popular movies for navigation:', error);
    }
  }

  // Fetch additional ratings from OMDb API
  async function fetchAdditionalRatings(movieTitle, year) {
    // Import cache utilities
    const { getCachedOMDbRating, setCachedOMDbRating, getFallbackOMDbRating } = await import('./utils/omdb-cache.js');
    
    console.log('DEBUG: fetchAdditionalRatings called with:', movieTitle, year);
    
    // Check cache first
    const cachedRating = getCachedOMDbRating(movieTitle, year);
    if (cachedRating) {
      console.log('DEBUG: Found cached rating:', cachedRating);
      return cachedRating;
    }
    
    try {
      // Get OMDb API key from environment variables
      const omdbApiKey = import.meta.env.VITE_OMDB_API_KEY;
      console.log('DEBUG: OMDb API key available:', !!omdbApiKey);
      
      if (!omdbApiKey) {
        // Try to get a fallback from cache first
        const fallbackRating = getFallbackOMDbRating(movieTitle);
        if (fallbackRating) {
          console.log('DEBUG: Using fallback rating (no API key):', fallbackRating);
          return fallbackRating;
        }
        
        // Only generate mock data if no cache available
        const mockRatings = {
          imdbRating: "N/A",
          rottenTomatoesRating: "N/A"
        };
        console.log('DEBUG: OMDb API key not found and no cache available, generated mock ratings for', movieTitle, ':', mockRatings);
        return mockRatings;
      }
      
      const searchTitle = encodeURIComponent(movieTitle);
      const apiUrl = `https://www.omdbapi.com/?t=${searchTitle}&y=${year}&apikey=${omdbApiKey}`;
      console.log('DEBUG: Making OMDb API request to:', apiUrl.replace(omdbApiKey, 'HIDDEN'));
      
      const response = await fetch(`https://www.omdbapi.com/?t=${searchTitle}&y=${year}&apikey=${omdbApiKey}`);
      
      if (!response.ok) {
        console.log('DEBUG: OMDb API request failed with status:', response.status);
        throw new Error('OMDb API request failed');
      }
      
      const data = await response.json();
      console.log('DEBUG: OMDb API response:', data);
      
      if (data.Response === 'False') {
        console.log('DEBUG: OMDb API returned False response:', data.Error);
        // Try to get a fallback from cache first
        const fallbackRating = getFallbackOMDbRating(movieTitle);
        if (fallbackRating) {
          console.log('DEBUG: Using fallback rating (API returned False):', fallbackRating);
          return fallbackRating;
        }
        
        // Only generate mock data if no cache available
        const mockFallbackRatings = {
          imdbRating: "N/A",
          rottenTomatoesRating: "N/A"
        };
        console.log('DEBUG: Movie not found in OMDb and no cache available, generated mock ratings for', movieTitle, ':', mockFallbackRatings);
        return mockFallbackRatings;
      }
      
      // Extract ratings
      const imdbRating = data.imdbRating !== 'N/A' ? data.imdbRating : null;
      let rottenTomatoesRating = null;
      
      if (data.Ratings) {
        const rtRating = data.Ratings.find(rating => rating.Source === 'Rotten Tomatoes');
        if (rtRating) {
          rottenTomatoesRating = rtRating.Value;
        }
      }
      
      const realRatings = {
        imdbRating,
        rottenTomatoesRating
      };
      
      // Cache the real ratings for future use
      setCachedOMDbRating(movieTitle, year, realRatings);
      
      console.log('DEBUG: Fetched real ratings from OMDb for', movieTitle, ':', realRatings);
      return realRatings;
    } catch (error) {
      console.warn('DEBUG: Error fetching additional ratings:', error);
      
      // Try to get a fallback from cache first
      const fallbackRating = getFallbackOMDbRating(movieTitle);
      if (fallbackRating) {
        console.log('DEBUG: Using fallback rating (error occurred):', fallbackRating);
        return fallbackRating;
      }
      
      // Only generate mock data if no cache available
      const errorFallbackRatings = {
        imdbRating: "N/A",
        rottenTomatoesRating: "N/A"
      };
      console.log('DEBUG: API error and no cache available, generated mock ratings for', movieTitle, ':', errorFallbackRatings);
      return errorFallbackRatings;
    }
  }

  // Load movie details from API
  async function loadMovieDetails(movieId, container) {
    try {
      const TMDB_API_KEY = import.meta.env.VITE_TMDB_API_KEY;
      const TMDB_BASE_URL = 'https://api.themoviedb.org/3';
      
      if (!TMDB_API_KEY) {
        throw new Error('API key not configured');
      }
      
      const response = await fetch(`${TMDB_BASE_URL}/movie/${movieId}?api_key=${TMDB_API_KEY}&append_to_response=credits,videos,similar&language=en-US`);
      
      if (!response.ok) {
        throw new Error('Movie not found');
      }
      
      const movie = await response.json();
      
      // Fetch additional ratings
      const year = movie.release_date ? new Date(movie.release_date).getFullYear() : null;
      const additionalRatings = await fetchAdditionalRatings(movie.title, year);
      console.log('DEBUG: Fetched additional ratings for', movie.title, ':', additionalRatings);
      
      // Combine movie data with additional ratings
      const enhancedMovie = {
        ...movie,
        additionalRatings
      };
      
      console.log('DEBUG: Enhanced movie additionalRatings:', enhancedMovie.additionalRatings);
      
      displayMoviePage(enhancedMovie, container);
    } catch (error) {
      captureError(error, {
        tags: { type: 'movie_api_error' },
        extra: { movieId }
      });
      showFallbackMovieDetails(movieId, container);
    }
  }

  // Show fallback movie details
  function showFallbackMovieDetails(movieId, container) {
    const fallbackMovie = {
      id: movieId,
      title: "Movie Details",
      overview: "Unable to load movie details at this time. Please try again later.",
      poster_path: "https://images.pexels.com/photos/7991579/pexels-photo-7991579.jpeg?auto=compress&cs=tinysrgb&w=500",
      backdrop_path: "https://images.pexels.com/photos/7991579/pexels-photo-7991579.jpeg?auto=compress&cs=tinysrgb&w=1200",
      release_date: "2024-01-01",
      vote_average: 7.5,
      runtime: 120,
      genres: [
        { id: 18, name: "Drama" }
      ],
      production_companies: [
        { name: "Unknown Studio" }
      ],
      credits: {
        cast: [
          { name: "Actor Name", character: "Character Name" }
        ]
      },
      videos: {
        results: []
      },
      additionalRatings: {
        imdbRating: "8.2",
        rottenTomatoesRating: "92%"
      }
    };

    displayMoviePage(fallbackMovie, container);
  }

  // Display movie page content
  function displayMoviePage(movie, container) {
    // Use globally available module instances instead of re-initializing
    const ratings = window.ratings;
    const watchlist = window.watchlist;
    const chat = window.chat;
    const currentUser = window.auth ? window.auth.getCurrentUser() : null;

    if (!ratings || !watchlist || !chat) {
      console.error('Required modules not initialized');
      showMovieError(container, movie.id);
      return;
    }

    // Set the current movie ID for the modules
    if (ratings.setCurrentMovieId) {
      ratings.setCurrentMovieId(movie.id);
    }
    if (watchlist.setCurrentMovieId) {
      watchlist.setCurrentMovieId(movie.id);
    }
    if (chat.setCurrentMovieId) {
      chat.setCurrentMovieId(movie.id);
    }

    // Get next movie ID for navigation
    const nextMovieId = getNextMovieId(movie.id);
    const hasNextMovie = nextMovieId !== null;
      const previousMovieId = getPreviousMovieId(movie.id);
      const hasPreviousMovie = previousMovieId !== null;
      
    // Standardize movie data to ensure consistency
    const standardizedMovie = {
      id: movie.id,
      title: movie.title || 'Unknown Title',
      overview: movie.overview || 'No overview available for this movie.',
      poster_path: movie.poster_path,
      backdrop_path: movie.backdrop_path,
      release_date: movie.release_date,
      vote_average: movie.vote_average || 0,
      vote_count: movie.vote_count || 0,
      popularity: movie.popularity || 0,
      runtime: movie.runtime,
      budget: movie.budget,
      revenue: movie.revenue,
      genres: movie.genres || [],
      production_companies: movie.production_companies || [],
      credits: movie.credits || { cast: [] },
      videos: movie.videos || { results: [] },
      additionalRatings: movie.additionalRatings || {} // Ensure additionalRatings is copied
    };
    
      const pageContent = `
        <div class="container">
          <div class="movie-page-header">
            <div class="movie-page-nav">
              ${hasPreviousMovie ? `
                <button class="btn btn-secondary prev-btn" onclick="navigateToMovie(${previousMovieId})">
                  <span class="btn-icon">←</span>
                  Previous ${getNavigationContextLabel()}
                </button>
              ` : `
                <button class="btn btn-secondary back-btn" onclick="history.back()">
                  <span class="btn-icon">←</span>
                  Back
                </button>
              `}
              ${hasNextMovie ? `
                <button class="btn btn-primary next-btn" onclick="navigateToMovie(${nextMovieId})">
                  <span class="btn-icon">→</span>
                  Next ${getNavigationContextLabel()}
                </button>
              ` : ''}
            </div>
            <div class="movie-page-breadcrumb">
              <a href="/movies" onclick="navigateTo('/movies'); return false;">Movies</a>
              <span class="breadcrumb-separator">›</span>
              ${navigationContext === 'watchlist' ? `
                <span class="breadcrumb-item">Watchlist</span>
                <span class="breadcrumb-separator">›</span>
              ` : ''}
              <span class="current-page">${standardizedMovie.title}</span>
            </div>
          </div>

          <div class="movie-page-content">
            <div class="movie-hero">
              <div class="movie-hero-backdrop">
                <img src="${getHighResImageUrl(standardizedMovie.backdrop_path)}" alt="${standardizedMovie.title}" onerror="this.src='https://images.pexels.com/photos/7991579/pexels-photo-7991579.jpeg?auto=compress&cs=tinysrgb&w=1920'">
                <div class="movie-hero-overlay"></div>
              </div>
              
              <div class="movie-hero-content">
                <div class="movie-poster-section">
                  <img src="${getImageUrl(standardizedMovie.poster_path)}" alt="${standardizedMovie.title}" class="movie-poster-large" onerror="this.src='https://images.pexels.com/photos/7991579/pexels-photo-7991579.jpeg?auto=compress&cs=tinysrgb&w=500'">
                </div>
                
                <div class="movie-info-section">
                  <h1 class="movie-title">${standardizedMovie.title}</h1>
                  
                  <div class="movie-meta-info">
                    ${createStandardizedStatsGrid(standardizedMovie)}
                    
                    ${standardizedMovie.genres.length > 0 ? `
                      <div class="movie-genres">
                        ${standardizedMovie.genres.map(genre => `<span class="genre-tag">${genre.name}</span>`).join('')}
                      </div>
                    ` : ''}
                    
                    <div class="movie-actions">
                      ${watchlist.createWatchlistButton(standardizedMovie.id, currentUser)}
                      ${createTrailerButton(standardizedMovie.videos)}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div class="movie-details-sections">
              <div class="movie-section">
                <h2>Overview</h2>
                <div class="movie-details-info">
                  <div class="movie-info-grid">
                    ${standardizedMovie.release_date ? `
                      <div class="info-item">
                        <span class="info-label">Release Date</span>
                        <span class="info-value">${formatDate(standardizedMovie.release_date)}</span>
                      </div>
                    ` : ''}
                    ${standardizedMovie.runtime ? `
                      <div class="info-item">
                        <span class="info-label">Runtime</span>
                        <span class="info-value">${standardizedMovie.runtime} minutes</span>
                      </div>
                    ` : ''}
                    ${standardizedMovie.budget && standardizedMovie.budget > 0 ? `
                      <div class="info-item">
                        <span class="info-label">Budget</span>
                        <span class="info-value">$${formatCurrency(standardizedMovie.budget)}</span>
                      </div>
                    ` : ''}
                    ${standardizedMovie.revenue && standardizedMovie.revenue > 0 ? `
                      <div class="info-item">
                        <span class="info-label">Revenue</span>
                        <span class="info-value">$${formatCurrency(standardizedMovie.revenue)}</span>
                      </div>
                    ` : ''}
                    ${standardizedMovie.popularity ? `
                      <div class="info-item">
                        <span class="info-label">Popularity</span>
                        <span class="info-value">${standardizedMovie.popularity.toFixed(1)}</span>
                      </div>
                    ` : ''}
                  </div>
                </div>
                <p class="movie-overview">${standardizedMovie.overview}</p>
                
                ${standardizedMovie.production_companies.length > 0 ? `
                  <div class="production-info">
                    <h4>Production</h4>
                    <p>${standardizedMovie.production_companies.map(company => company.name).join(', ')}</p>
                  </div>
                ` : ''}
              </div>
              
              ${standardizedMovie.credits.cast.length > 0 ? `
                <div class="movie-section">
                  <h2>Cast</h2>
                  <div class="cast-grid">
                    ${standardizedMovie.credits.cast.slice(0, 12).map(actor => `
                      <div class="cast-member">
                        <div class="actor-info">
                          <div class="actor-details">
                            <strong class="actor-name">${actor.name}</strong>
                            <span class="actor-character">${actor.character}</span>
                          </div>
                          <div class="actor-image">
                            <img src="${getActorImageUrl(actor.profile_path)}" 
                                 alt="${actor.name}" 
                                 loading="lazy"
                                 onerror="this.src='https://images.pexels.com/photos/1222271/pexels-photo-1222271.jpeg?auto=compress&cs=tinysrgb&w=200'">
                          </div>
                        </div>
                      </div>
                    `).join('')}
                  </div>
                </div>
              ` : ''}

              <div class="movie-section">
                ${ratings.createRatingInterface(standardizedMovie.id, currentUser)}
                ${hasNextMovie ? `
                  <div class="rating-next-button">
                    <button class="btn btn-primary next-movie-btn" onclick="navigateToMovie(${nextMovieId})">
                      <span class="btn-icon">→</span>
                      Next ${getNavigationContextLabel()}
                    </button>
                  </div>
                ` : ''}
              </div>
              
              <div class="movie-section">
                ${chat.createChatInterface(standardizedMovie.id)}
              </div>
            </div>
          </div>
        </div>
      `;

      container.innerHTML = pageContent;
      
      // Initialize rating event listeners after the content is rendered
      if (ratings.initializeEventListeners) {
        ratings.initializeEventListeners();
      }
      
      // Update page title
      document.title = `${standardizedMovie.title} - DreadScale`;
  }
  
  // Create standardized stats grid with consistent layout
  function createStandardizedStatsGrid(movie) {
    const additionalRatings = movie.additionalRatings || {};
    console.log('DEBUG: Creating stats grid for', movie.title, 'with additionalRatings:', additionalRatings);
    console.log('DEBUG: Full movie object keys:', Object.keys(movie));
    
    // Check if we have valid ratings or need to generate fallbacks
    let imdbRating, rtRating;
    
    if (additionalRatings.imdbRating && additionalRatings.imdbRating !== null) {
      imdbRating = additionalRatings.imdbRating;
    } else {
      imdbRating = "N/A";
      console.log('DEBUG: Generated fallback IMDB rating:', imdbRating);
    }
    
    if (additionalRatings.rottenTomatoesRating && additionalRatings.rottenTomatoesRating !== null) {
      rtRating = additionalRatings.rottenTomatoesRating;
    } else {
      rtRating = "N/A";
      console.log('DEBUG: Generated fallback RT rating:', rtRating);
    }
    
    console.log('DEBUG: Final ratings - IMDB:', imdbRating, 'RT:', rtRating);
    
    return `
      <div class="movie-stats-grid">
        <div class="stat">
          <span class="stat-label">TMDB</span>
          <span class="stat-value">⭐ ${movie.vote_average > 0 ? movie.vote_average.toFixed(1) : 'N/A'}</span>
        </div>
        <div class="stat">
          <span class="stat-label">IMDB</span>
          <span class="stat-value">🎬 ${imdbRating === "N/A" ? "N/A" : imdbRating}</span>
        </div>
        <div class="stat">
          <span class="stat-label">RT</span>
          <span class="stat-value">🍅 ${rtRating === "N/A" ? "N/A" : rtRating}</span>
        </div>
      </div>
    `;
  }

  // Get the next movie ID from the current navigation list
  function getNextMovieId(currentMovieId) {
    if (!movieNavigationList || movieNavigationList.length === 0) {
      return null;
    }
    
    const currentIndex = movieNavigationList.indexOf(parseInt(currentMovieId));
    if (currentIndex === -1 || currentIndex === movieNavigationList.length - 1) {
      return null; // Movie not found or is the last movie
    }
    
    return movieNavigationList[currentIndex + 1];
  }
  
  // Get the previous movie ID from the current navigation list
  function getPreviousMovieId(currentMovieId) {
    if (!movieNavigationList || movieNavigationList.length === 0) {
      return null;
    }
    
    const currentIndex = movieNavigationList.indexOf(parseInt(currentMovieId));
    if (currentIndex === -1 || currentIndex === 0) {
      return null; // Movie not found or is the first movie
    }
    
    return movieNavigationList[currentIndex - 1];
  }
  
  // Clear navigation cache when needed
  function clearNavigationCache() {
    navigationCache.clear();
  }
  
  // Clean up old cache entries (older than 5 minutes)
  function cleanupNavigationCache() {
    const now = Date.now();
    const maxAge = 5 * 60 * 1000; // 5 minutes
    
    for (const [key, value] of navigationCache.entries()) {
      if (now - value.timestamp > maxAge) {
        navigationCache.delete(key);
      }
    }
  }
  
  // Run cache cleanup periodically
  setInterval(cleanupNavigationCache, 60000); // Every minute
  // Show movie error page
  
  // Get navigation context label for UI
  function getNavigationContextLabel() {
    switch (navigationContext) {
      case 'watchlist':
        return 'in Watchlist';
      case 'search':
        return 'in Results';
      default:
        return 'Movie';
    }
  }
  
  function showMovieError(container, movieId) {
    container.innerHTML = `
      <div class="container">
        <div class="movie-page-header">
          <button class="btn btn-secondary back-btn" onclick="history.back()">
            <span class="btn-icon">←</span>
            Back
          </button>
        </div>
        
        <div class="movie-error">
          <div class="error-icon">🎬</div>
          <h2>Movie Not Found</h2>
          <p>Sorry, we couldn't find the movie you're looking for.</p>
          <div class="error-actions">
            <button class="btn btn-primary" onclick="navigateTo('/movies')">
              <span class="btn-icon">🎬</span>
              Browse Movies
            </button>
          </div>
        </div>
      </div>
    `;
  }

  // Show section (for non-movie pages)
  function showSection(sectionId) {
    // Hide all main content sections
    const allSections = document.querySelectorAll('.main-content-section');
    allSections.forEach(section => {
      section.classList.remove('active');
    });

    // Show target section
    const targetSection = document.querySelector(sectionId);
    if (targetSection) {
      targetSection.classList.add('active');
      
      // Smooth scroll to top of section
      const offsetTop = targetSection.offsetTop - 70; // Account for fixed navbar
      window.scrollTo({
        top: offsetTop,
        behavior: 'smooth'
      });

      // Update account page content if showing account section
      if (sectionId === '#account') {
        // Get auth module and update account page
        if (auth && auth.updateAccountPage) {
          auth.updateAccountPage();
        }
      }

      // Initialize advanced search if showing advanced search section
      if (sectionId === '#advancedSearch') {
        if (moviesModule && moviesModule.initializeAdvancedSearch) {
          moviesModule.initializeAdvancedSearch();
        }
      }
    }

    // Update active navigation link
    updateActiveNavLink(sectionId);
    
    // Update page title
    const titles = {
      '#movies': 'Movies - DreadScale',
      '#advancedSearch': 'Search + - DreadScale',
      '#account': 'Account - DreadScale',
      '#about': 'About - DreadScale'
    };
    document.title = titles[sectionId] || 'DreadScale';
  }

  // Update active navigation link
  function updateActiveNavLink(activeSection) {
    const navLinks = document.querySelectorAll('.nav-link');
    navLinks.forEach(link => {
      link.classList.remove('active');
      if (link.getAttribute('href') === activeSection) {
        link.classList.add('active');
      }
    });

    // Update footer nav links
    const footerLinks = document.querySelectorAll('.footer-nav-link');
    footerLinks.forEach(link => {
      link.classList.remove('active');
      if (link.getAttribute('href') === activeSection) {
        link.classList.add('active');
      }
    });
  }

  // Utility functions
  function getImageUrl(path) {
    if (!path) return 'https://images.pexels.com/photos/7991579/pexels-photo-7991579.jpeg?auto=compress&cs=tinysrgb&w=500';
    if (path.startsWith('http')) return path;
    return `https://image.tmdb.org/t/p/w500${path}`;
  }

  // High resolution image URL for backdrop images
  function getHighResImageUrl(path) {
    if (!path) return 'https://images.pexels.com/photos/7991579/pexels-photo-7991579.jpeg?auto=compress&cs=tinysrgb&w=1920';
    if (path.startsWith('http')) return path;
    return `https://image.tmdb.org/t/p/w1280${path}`;
  }

  // Get actor profile image URL
  function getActorImageUrl(path) {
    if (!path) return 'https://images.pexels.com/photos/1222271/pexels-photo-1222271.jpeg?auto=compress&cs=tinysrgb&w=200';
    if (path.startsWith('http')) return path;
    return `https://image.tmdb.org/t/p/w185${path}`;
  }
  function formatDate(dateString) {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  }
  
  // Create trailer button
  function createTrailerButton(videos) {
    if (!videos || !videos.results || videos.results.length === 0) {
      return '';
    }
    
    // Find the first trailer or teaser
    const trailer = videos.results.find(video => 
      video.type === 'Trailer' && video.site === 'YouTube'
    ) || videos.results.find(video => 
      video.type === 'Teaser' && video.site === 'YouTube'
    ) || videos.results.find(video => 
      video.site === 'YouTube'
    );
    
    if (!trailer) {
      return '';
    }
    
    return `
      <button class="btn btn-primary trailer-btn" data-video-key="${trailer.key}" data-video-name="${trailer.name}">
        <span class="btn-icon">▶️</span>
        Watch Trailer
      </button>
    `;
  }
  
  // Handle trailer button clicks
  document.addEventListener('click', (e) => {
    if (e.target.closest('.trailer-btn')) {
      const button = e.target.closest('.trailer-btn');
      const videoKey = button.dataset.videoKey;
      const videoName = button.dataset.videoName;
      
      if (videoKey) {
        openTrailerModal(videoKey, videoName);
      }
    }
    
    // Close trailer modal
    if (e.target.closest('.trailer-modal-close') || e.target.closest('.trailer-modal-overlay')) {
      if (e.target === e.target.closest('.trailer-modal-overlay') || e.target.closest('.trailer-modal-close')) {
        closeTrailerModal();
      }
    }
  });
  
  // Open trailer modal
  function openTrailerModal(videoKey, videoName) {
    // Create modal if it doesn't exist
    let modal = document.getElementById('trailerModal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'trailerModal';
      modal.className = 'trailer-modal-overlay';
      modal.innerHTML = `
        <div class="trailer-modal">
          <div class="trailer-modal-header">
            <h3 id="trailerTitle">Trailer</h3>
            <button class="trailer-modal-close">×</button>
          </div>
          <div class="trailer-modal-content">
            <div class="trailer-video-container">
              <iframe id="trailerVideo" 
                      width="100%" 
                      height="100%" 
                      frameborder="0" 
                      allowfullscreen>
              </iframe>
            </div>
          </div>
        </div>
      `;
      document.body.appendChild(modal);
    }
    
    // Update modal content
    document.getElementById('trailerTitle').textContent = videoName || 'Trailer';
    document.getElementById('trailerVideo').src = `https://www.youtube.com/embed/${videoKey}?autoplay=1&rel=0`;
    
    // Show modal
    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
  }
  
  // Close trailer modal
  function closeTrailerModal() {
    const modal = document.getElementById('trailerModal');
    if (modal) {
      modal.style.display = 'none';
      document.body.style.overflow = 'auto';
      
      // Stop video playback
      const iframe = document.getElementById('trailerVideo');
      if (iframe) {
        iframe.src = '';
      }
    }
  }
  
  // Close modal on escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeTrailerModal();
    }
  });
  
  // Format currency values
  function formatCurrency(amount) {
    if (amount >= 1000000000) {
      return (amount / 1000000000).toFixed(1) + 'B';
    } else if (amount >= 1000000) {
      return (amount / 1000000).toFixed(1) + 'M';
    } else if (amount >= 1000) {
      return (amount / 1000).toFixed(1) + 'K';
    }
    return amount.toLocaleString();
  }

  // Make navigateTo globally available
  window.navigateTo = navigateTo;

  // Public API
  return {
    init,
    navigateTo,
    showMoviePage,
    getCurrentRoute: () => currentRoute,
    getCurrentMovieId: () => currentMovieId,
    clearNavigationCache
  };
}