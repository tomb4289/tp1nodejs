import axios from 'axios';
import { showNotification } from './utils/notifications.js';
import { captureError, addSentryBreadcrumb, withSentryApiTracking } from './utils/sentry.js';

const TMDB_API_KEY = import.meta.env.VITE_TMDB_API_KEY;
const TMDB_BASE_URL = 'https://api.themoviedb.org/3';

export function initializeMovies() {
  let currentPage = 1;
  let currentCategory = 'popular';
  let currentSearchQuery = '';
  let isLoading = false;
  let allMovies = [];
  let moviesPerPage = 6;
  let dreadScoreSortOrder = null; // null = no sorting, 'asc' = ascending, 'desc' = descending
  let autoLoadEnabled = false;
  let isAutoLoading = false;

  // Advanced search state
  let advancedSearchState = {
    query: '',
    filters: [], // Array of {category, subcategory, minScore, maxScore}
    sortOrder: 'desc',
    moviesPerPage: 12,
    currentPage: 1,
    isActive: false
  };

  // Fallback movies data for when API fails
  const fallbackMovies = [
    {
      id: 278,
      title: "The Shawshank Redemption",
      overview: "Framed in the 1940s for the double murder of his wife and her lover, upstanding banker Andy Dufresne begins a new life at the Shawshank prison, where he puts his accounting skills to work for an amoral warden. During his long stretch in prison, Dufresne comes to be admired by the other inmates -- including an older prisoner named Red -- for his integrity and unquenchable sense of hope.",
      poster_path: "https://images.pexels.com/photos/7991579/pexels-photo-7991579.jpeg?auto=compress&cs=tinysrgb&w=500",
      backdrop_path: "https://images.pexels.com/photos/7991579/pexels-photo-7991579.jpeg?auto=compress&cs=tinysrgb&w=1200",
      release_date: "1994-09-23",
      vote_average: 9.3,
      popularity: 95.5
    },
    {
      id: 238,
      title: "The Godfather",
      overview: "Spanning the years 1945 to 1955, a chronicle of the fictional Italian-American Corleone crime family. When organized crime family patriarch, Vito Corleone barely survives an attempt on his life, his youngest son, Michael steps in to take care of the would-be killers, launching a campaign of bloody revenge.",
      poster_path: "https://images.pexels.com/photos/7991579/pexels-photo-7991579.jpeg?auto=compress&cs=tinysrgb&w=500",
      backdrop_path: "https://images.pexels.com/photos/7991579/pexels-photo-7991579.jpeg?auto=compress&cs=tinysrgb&w=1200",
      release_date: "1972-03-14",
      vote_average: 9.2,
      popularity: 88.3
    },
    {
      id: 240,
      title: "The Godfather: Part II",
      overview: "In the continuing saga of the Corleone crime family, a young Vito Corleone grows up in Sicily and in 1910s New York. In the 1950s, Michael Corleone attempts to expand the family business into Las Vegas, Hollywood and Cuba.",
      poster_path: "https://images.pexels.com/photos/7991579/pexels-photo-7991579.jpeg?auto=compress&cs=tinysrgb&w=500",
      backdrop_path: "https://images.pexels.com/photos/7991579/pexels-photo-7991579.jpeg?auto=compress&cs=tinysrgb&w=1200",
      release_date: "1974-12-20",
      vote_average: 9.0,
      popularity: 82.1
    },
    {
      id: 424,
      title: "Schindler's List",
      overview: "The true story of how businessman Oskar Schindler saved over a thousand Jewish lives from the Nazis while they worked as slaves in his factory during World War II.",
      poster_path: "https://images.pexels.com/photos/7991579/pexels-photo-7991579.jpeg?auto=compress&cs=tinysrgb&w=500",
      backdrop_path: "https://images.pexels.com/photos/7991579/pexels-photo-7991579.jpeg?auto=compress&cs=tinysrgb&w=1200",
      release_date: "1993-11-30",
      vote_average: 8.9,
      popularity: 75.8
    },
    {
      id: 19404,
      title: "Dilwale Dulhania Le Jayenge",
      overview: "Raj is a rich, carefree, happy-go-lucky second generation NRI. Simran is the daughter of Chaudhary Baldev Singh, who in spite of being an NRI is very strict about adherence to Indian values. Simran has left for India to be married to her childhood fiancé. Raj leaves for India with a mission at his hands, to claim his lady love under the noses of her whole family. Thus begins a saga.",
      poster_path: "https://images.pexels.com/photos/7991579/pexels-photo-7991579.jpeg?auto=compress&cs=tinysrgb&w=500",
      backdrop_path: "https://images.pexels.com/photos/7991579/pexels-photo-7991579.jpeg?auto=compress&cs=tinysrgb&w=1200",
      release_date: "1995-10-20",
      vote_average: 8.7,
      popularity: 68.9
    },
    {
      id: 389,
      title: "12 Angry Men",
      overview: "The defense and the prosecution have rested and the jury is filing into the jury room to decide if a young Spanish-American is guilty or innocent of murdering his father. What begins as an open and shut case soon becomes a mini-drama of each of the jurors' prejudices and preconceptions about the trial, the accused, and each other.",
      poster_path: "https://images.pexels.com/photos/7991579/pexels-photo-7991579.jpeg?auto=compress&cs=tinysrgb&w=500",
      backdrop_path: "https://images.pexels.com/photos/7991579/pexels-photo-7991579.jpeg?auto=compress&cs=tinysrgb&w=1200",
      release_date: "1957-04-10",
      vote_average: 8.5,
      popularity: 62.4
    },
    {
      id: 155,
      title: "The Dark Knight",
      overview: "Batman raises the stakes in his war on crime. With the help of Lt. Jim Gordon and District Attorney Harvey Dent, Batman sets out to dismantle the remaining criminal organizations that plague the streets. The partnership proves to be effective, but they soon find themselves prey to a reign of chaos unleashed by a rising criminal mastermind known to the terrified citizens of Gotham as the Joker.",
      poster_path: "https://images.pexels.com/photos/7991579/pexels-photo-7991579.jpeg?auto=compress&cs=tinysrgb&w=500",
      backdrop_path: "https://images.pexels.com/photos/7991579/pexels-photo-7991579.jpeg?auto=compress&cs=tinysrgb&w=1200",
      release_date: "2008-07-16",
      vote_average: 9.0,
      popularity: 98.7
    },
    {
      id: 496243,
      title: "Parasite",
      overview: "All unemployed, Ki-taek's family takes peculiar interest in the wealthy and glamorous Parks for their livelihood until they get entangled in an unexpected incident.",
      poster_path: "https://images.pexels.com/photos/7991579/pexels-photo-7991579.jpeg?auto=compress&cs=tinysrgb&w=500",
      backdrop_path: "https://images.pexels.com/photos/7991579/pexels-photo-7991579.jpeg?auto=compress&cs=tinysrgb&w=1200",
      release_date: "2019-05-30",
      vote_average: 8.5,
      popularity: 91.2
    },
    {
      id: 129,
      title: "Spirited Away",
      overview: "A young girl, Chihiro, becomes trapped in a strange new world of spirits. When her parents undergo a mysterious transformation, she must call upon the courage she never knew she had to free her family.",
      poster_path: "https://images.pexels.com/photos/7991579/pexels-photo-7991579.jpeg?auto=compress&cs=tinysrgb&w=500",
      backdrop_path: "https://images.pexels.com/photos/7991579/pexels-photo-7991579.jpeg?auto=compress&cs=tinysrgb&w=1200",
      release_date: "2001-07-20",
      vote_average: 8.6,
      popularity: 79.3
    },
    {
      id: 372058,
      title: "Your Name",
      overview: "High schoolers Mitsuha and Taki are complete strangers living separate lives. But one night, they suddenly switch places. Mitsuha wakes up in Taki's body, and he in hers. This bizarre occurrence continues to happen randomly, and the two must adjust their lives around each other.",
      poster_path: "https://images.pexels.com/photos/7991579/pexels-photo-7991579.jpeg?auto=compress&cs=tinysrgb&w=500",
      backdrop_path: "https://images.pexels.com/photos/7991579/pexels-photo-7991579.jpeg?auto=compress&cs=tinysrgb&w=1200",
      release_date: "2016-08-26",
      vote_average: 8.5,
      popularity: 73.6
    },
    {
      id: 13,
      title: "Forrest Gump",
      overview: "A man with a low IQ has accomplished great things in his life and been present during significant historic events—in each case, far exceeding what anyone imagined he could do. But despite all he has achieved, his one true love eludes him.",
      poster_path: "https://images.pexels.com/photos/7991579/pexels-photo-7991579.jpeg?auto=compress&cs=tinysrgb&w=500",
      backdrop_path: "https://images.pexels.com/photos/7991579/pexels-photo-7991579.jpeg?auto=compress&cs=tinysrgb&w=1200",
      release_date: "1994-06-23",
      vote_average: 8.5,
      popularity: 87.4
    },
    {
      id: 769,
      title: "GoodFellas",
      overview: "The true story of Henry Hill, a half-Irish, half-Sicilian Brooklyn kid who is adopted by neighbourhood gangsters at an early age and climbs the ranks of a Mafia family under the guidance of Jimmy Conway.",
      poster_path: "https://images.pexels.com/photos/7991579/pexels-photo-7991579.jpeg?auto=compress&cs=tinysrgb&w=500",
      backdrop_path: "https://images.pexels.com/photos/7991579/pexels-photo-7991579.jpeg?auto=compress&cs=tinysrgb&w=1200",
      release_date: "1990-09-12",
      vote_average: 8.5,
      popularity: 84.1
    }
  ];

  // Initialize movies on page load
  loadMovies();
  setupEventListeners();

  // Check if API key is available
  if (!TMDB_API_KEY) {
    const error = new Error('TMDB API key is not configured. Please check your .env file.');
    captureError(error, { tags: { type: 'configuration_error' } });
    showNotification('Movie database is not configured properly', 'error');
  }

  async function loadMovies(reset = false) {
    if (isLoading) return;
    
    if (reset) {
      currentPage = 1;
      allMovies = [];
      // Reset auto-load when doing a fresh search/filter
      autoLoadEnabled = false;
    }

    isLoading = true;
    showLoadingState();

    try {
      let movies;
      
      addSentryBreadcrumb('Loading movies', 'user_action', 'info', { 
        category: currentCategory, 
        page: currentPage,
        searchQuery: currentSearchQuery 
      });
      
      if (currentSearchQuery) {
        movies = await withSentryApiTracking(
          () => searchMovies(currentSearchQuery, currentPage),
          'tmdb_search'
        )();
      } else {
        movies = await withSentryApiTracking(
          () => fetchMoviesByCategory(currentCategory, currentPage),
          'tmdb_category'
        )();
      }

      if (reset) {
        allMovies = movies;
      } else {
        allMovies = [...allMovies, ...movies];
      }

      displayMovies();
      currentPage++;
    } catch (error) {
      captureError(error, {
        tags: { type: 'movie_loading_error', category: currentCategory },
        extra: { page: currentPage, searchQuery: currentSearchQuery }
      });
      
      if (currentPage === 1) {
        // Use fallback data for first page
        allMovies = fallbackMovies;
        displayMovies();
      }
      showNotification('Failed to load movies. Showing cached results.', 'error');
    } finally {
      isLoading = false;
    }
  }

  async function fetchMoviesByCategory(category, page) {
    const response = await axios.get(`${TMDB_BASE_URL}/movie/${category}`, {
      params: {
        api_key: TMDB_API_KEY,
        page: page,
        language: 'en-US'
      }
    });
    return response.data.results || [];
  }

  async function searchMovies(query, page) {
    const response = await axios.get(`${TMDB_BASE_URL}/search/movie`, {
      params: {
        api_key: TMDB_API_KEY,
        query: query,
        page: page,
        language: 'en-US'
      }
    });
    
    // Sort search results by popularity in descending order (most popular first)
    const results = response.data.results || [];
    return results.sort((a, b) => (b.popularity || 0) - (a.popularity || 0));
  }

  async function displayMovies() {
    const moviesGrid = document.getElementById('moviesGrid');
    if (!moviesGrid) return;

    // Apply DreadScore sorting if active
    let moviesToDisplay = [...allMovies];
    if (dreadScoreSortOrder && window.ratings) {
      moviesToDisplay = await sortMoviesByDreadScore(moviesToDisplay, dreadScoreSortOrder);
    }

    // Slice movies based on moviesPerPage setting
    const displayedMovies = moviesToDisplay.slice(0, currentPage * moviesPerPage);
    
    // Create movie cards asynchronously
    const movieCards = await Promise.all(
      displayedMovies.map(movie => createMovieCard(movie))
    );
    moviesGrid.innerHTML = movieCards.join('');

    // Load rating summaries after cards are rendered with a longer delay to ensure DOM is ready
    setTimeout(() => {
      loadRatingSummaries();
    }, 200);

    // Update load more button visibility
    updateLoadMoreButton(displayedMovies.length, moviesToDisplay.length);
  }

  async function sortMoviesByDreadScore(movies, order) {
    if (!window.ratingsService) return movies;

    // Get all scores first
    const moviesWithScores = await Promise.all(
      movies.map(async (movie) => {
        const score = await window.ratingsService.getOverallAverageRating(movie.id);
        return {
          ...movie,
          dreadScore: parseFloat(score) || 0
        };
      })
    );

    return moviesWithScores.sort((a, b) => {
      const scoreA = a.dreadScore;
      const scoreB = b.dreadScore;
      
      return order === 'asc' ? scoreA - scoreB : scoreB - scoreA;
    });
  }

  async function createMovieCard(movie) {
    const currentUser = JSON.parse(localStorage.getItem('currentUser'));
    
    // Get rating summary from ratings module - will be populated asynchronously
    let ratingSummary = `
      <div class="content-rating-summary" data-movie-id="${movie.id}">
        <span class="content-rating-label">DreadScore:</span>
        <span class="content-rating-value loading-rating">Loading...</span>
      </div>
    `;

    // Get watchlist button from watchlist module
    let watchlistButton = '';
    if (window.watchlist) {
      watchlistButton = window.watchlist.createWatchlistButton(movie.id, currentUser);
    }

    return `
      <div class="movie-card" data-movie-id="${movie.id}">
        <div class="movie-poster">
          <img src="${getImageUrl(movie.poster_path)}" alt="${movie.title}" loading="lazy" onerror="this.src='https://images.pexels.com/photos/7991579/pexels-photo-7991579.jpeg?auto=compress&cs=tinysrgb&w=500'">
          <div class="movie-overlay">
            <button class="btn btn-primary movie-details-btn" onclick="navigateToMovie(${movie.id})">
              <span class="btn-icon">👁️</span>
              View Details
            </button>
          </div>
        </div>
        <div class="movie-info">
          <h3 class="movie-title">${movie.title}</h3>
          <div class="movie-meta">
            <span class="movie-year">${getYear(movie.release_date)}</span>
            <div class="movie-rating">
              <span class="rating-star">⭐</span>
              <span>${movie.vote_average ? movie.vote_average.toFixed(1) : 'N/A'}</span>
            </div>
          </div>
          <p class="movie-overview">${movie.overview || 'No overview available.'}</p>
          ${ratingSummary}
          <div class="movie-card-actions">
            ${watchlistButton}
          </div>
        </div>
      </div>
    `;
  }

  // Load rating summaries for all visible movie cards
  const loadRatingSummaries = async () => {
    if (!window.ratingsService) {
      // Retry after a short delay if ratingsService isn't available yet
      setTimeout(loadRatingSummaries, 500);
      return;
    }

    const ratingSummaries = document.querySelectorAll('.content-rating-summary[data-movie-id]');
    
    if (ratingSummaries.length === 0) {
      // No rating summaries found, try again after a short delay
      setTimeout(loadRatingSummaries, 300);
      return;
    }
    
    // Get all movie IDs and batch fetch DreadScores
    const movieIds = Array.from(ratingSummaries).map(summary => parseInt(summary.dataset.movieId)).filter(id => !isNaN(id));
    
    if (movieIds.length === 0) return;
    
    try {
      // Batch fetch DreadScores for all visible movies
      const dreadScores = await window.ratingsService.batchFetchDreadScores(movieIds);
      
      // Update all summaries with fetched data
      ratingSummaries.forEach(summary => {
        const movieId = parseInt(summary.dataset.movieId);
        if (!movieId) return;

        const scoreData = dreadScores[movieId];
        if (scoreData && scoreData.dreadScore !== null) {
          summary.innerHTML = `
            <span class="content-rating-label">DreadScore:</span>
            <span class="content-rating-value">${scoreData.dreadScore}/10</span>
            <span class="content-rating-count">(${scoreData.totalRatings})</span>
            <button class="rawscore-dropdown-btn" data-movie-id="${movieId}">
              <span class="dropdown-icon">?</span>
            </button>
          `;
        } else {
          summary.innerHTML = '<span class="no-ratings">No content ratings</span>';
        }
      });
    } catch (error) {
      console.error('Error batch loading rating summaries:', error);
      
      // Fallback to individual processing if batch fails
      await loadRatingSummariesFallback(ratingSummaries);
    }
  };

  // Fallback method for individual processing
  const loadRatingSummariesFallback = async (ratingSummaries) => {
    // Process summaries in batches to avoid blocking the UI
    const batchSize = 5;
    const movieIds = Array.from(ratingSummaries).map(summary => 
      parseInt(summary.dataset.movieId)
    ).filter(id => !isNaN(id));
    
    if (movieIds.length === 0) return;

    try {
      // Batch fetch DreadScores for all visible movies
      const dreadScoresData = await window.ratingsService.batchFetchDreadScores(movieIds);
      
      // Update all summaries with the fetched data
      ratingSummaries.forEach(summary => {
        const movieId = parseInt(summary.dataset.movieId);
        if (!movieId) return;

        const movieData = dreadScoresData[movieId];
        
        if (movieData && movieData.dreadScore !== null) {
          summary.innerHTML = `
            <span class="content-rating-label">DreadScore:</span>
            <span class="content-rating-value">${movieData.dreadScore}/10</span>
            <span class="content-rating-count">(${movieData.totalRatings})</span>
            <button class="rawscore-dropdown-btn" data-movie-id="${movieId}">
              <span class="dropdown-icon">ⓘ</span>
            </button>
          `;
        } else {
          summary.innerHTML = '<span class="no-ratings">No content ratings</span>';
        }
      });
    } catch (error) {
      console.error('Error batch loading rating summaries:', error);
      // Fallback to showing no ratings for all
      ratingSummaries.forEach(summary => {
        summary.innerHTML = '<span class="no-ratings">No content ratings</span>';
      });
    }
  };

  // Optimized sort by DreadScore using batch fetching
  async function sortMoviesByDreadScore(movies, order) {
    if (!window.ratingsService) return movies;

    try {
      // Extract movie IDs
      const movieIds = movies.map(movie => movie.id);
      
      // Batch fetch DreadScores
      const dreadScoresData = await window.ratingsService.batchFetchDreadScores(movieIds);
      
      // Add scores to movies and sort
      const moviesWithScores = movies.map(movie => ({
        ...movie,
        dreadScore: dreadScoresData[movie.id]?.dreadScore ? 
          parseFloat(dreadScoresData[movie.id].dreadScore) : 0
      }));

      return moviesWithScores.sort((a, b) => {
        const scoreA = a.dreadScore;
        const scoreB = b.dreadScore;
        
        return order === 'asc' ? scoreA - scoreB : scoreB - scoreA;
      });
    } catch (error) {
      console.error('Error sorting movies by DreadScore:', error);
      return movies;
    }
  }

  // Update the existing sortMoviesByDreadScore function
  const originalSortMoviesByDreadScore = sortMoviesByDreadScore;
  sortMoviesByDreadScore = async (movies, order) => {
    return await originalSortMoviesByDreadScore(movies, order);
  };

  // Optimized getOverallAverageRating that uses batch cache when possible
  const getOverallAverageRating = async (movieId) => {
    try {
      // Try batch cache first
      const dreadScoresData = await window.ratingsService.batchFetchDreadScores([movieId]);
      const movieData = dreadScoresData[movieId];
      
      if (movieData) {
        return movieData.dreadScore;
      }
      
      // Fallback to individual call
      return await window.ratingsService.getOverallAverageRating(movieId);
    } catch (error) {
      console.error('Error getting overall average rating:', error);
      return null;
    }
  };

  function showLoadingState() {
    const moviesGrid = document.getElementById('moviesGrid');
    if (!moviesGrid) return;

    if (currentPage === 1) {
      moviesGrid.innerHTML = `
        <div class="loading-movies">
          <div class="loading-spinner"></div>
          <p>Loading amazing movies...</p>
        </div>
      `;
    }
  }

  function updateLoadMoreButton(displayedCount, totalCount) {
    const loadMoreBtn = document.getElementById('loadMoreBtn');
    if (!loadMoreBtn) return;

    if (displayedCount >= totalCount) {
      loadMoreBtn.style.display = 'none';
    } else {
      loadMoreBtn.style.display = 'block';
    }
  }

  function setupEventListeners() {
    // Category filter
    const categoryFilter = document.getElementById('categoryFilter');
    if (categoryFilter) {
      categoryFilter.addEventListener('change', (e) => {
        currentCategory = e.target.value;
        currentSearchQuery = '';
        dreadScoreSortOrder = null;
        updateDreadScoreButton();
        loadMovies(true);
      });
    }

    // Search input
    const movieSearch = document.getElementById('movieSearch');
    if (movieSearch) {
      let searchTimeout;
      movieSearch.addEventListener('input', (e) => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
          currentSearchQuery = e.target.value.trim();
          dreadScoreSortOrder = null;
          autoLoadEnabled = false; // Reset auto-load on search
          updateDreadScoreButton();
          loadMovies(true);
        }, 500);
      });

      // Enter key for search
      movieSearch.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          triggerSearch();
        }
      });
    }

    // Search button
    const movieSearchBtn = document.getElementById('movieSearchBtn');
    if (movieSearchBtn) {
      movieSearchBtn.addEventListener('click', (e) => {
        e.preventDefault();
        triggerSearch();
        autoLoadEnabled = false; // Reset auto-load on manual search
      });
    }

    // DreadScore filter button
    const dreadScoreFilter = document.getElementById('dreadScoreFilter');
    if (dreadScoreFilter) {
      dreadScoreFilter.addEventListener('click', () => {
        if (dreadScoreSortOrder === null) {
          dreadScoreSortOrder = 'desc';
        } else if (dreadScoreSortOrder === 'desc') {
          dreadScoreSortOrder = 'asc';
        } else {
          dreadScoreSortOrder = null;
        }
        updateDreadScoreButton();
        displayMovies();
      });
    }

    // Movies per page filter
    const moviesPerPageFilter = document.getElementById('moviesPerPageFilter');
    if (moviesPerPageFilter) {
      moviesPerPageFilter.addEventListener('change', (e) => {
        moviesPerPage = parseInt(e.target.value);
        autoLoadEnabled = false; // Reset auto-load when changing page size
        displayMovies();
      });
    }

    // Load more button
    const loadMoreBtn = document.getElementById('loadMoreBtn');
    if (loadMoreBtn) {
      loadMoreBtn.addEventListener('click', () => {
        // Enable auto-load after first manual click
        if (!autoLoadEnabled) {
          autoLoadEnabled = true;
          showAutoLoadNotification();
          setupAutoLoadScrollListener();
        }
        
        if (dreadScoreSortOrder === null) {
          loadMovies();
        } else {
          // If DreadScore sorting is active, just show more from current results
          displayMovies();
        }
        
        // Update button text temporarily
        const originalText = loadMoreBtn.innerHTML;
        loadMoreBtn.innerHTML = '<div class="loading-spinner-small"></div>Loading...';
        setTimeout(() => { loadMoreBtn.innerHTML = originalText; }, 1000);
      });
    }

    // Movie card clicks
    document.addEventListener('click', (e) => {
      const movieCard = e.target.closest('.movie-card');
      if (movieCard && !e.target.closest('button') && !e.target.closest('.rawscore-dropdown-btn')) {
        const movieId = movieCard.dataset.movieId;
        navigateToMovie(movieId);
      }
    });

    // Refresh movie cards event
    document.addEventListener('refreshMovieCards', () => {
      displayMovies();
     // Also reload rating summaries when movie cards refresh
     setTimeout(loadRatingSummaries, 200);
    });

    // Load rating summaries when ratings service becomes available
    if (window.ratingsService) {
   
   // Also load rating summaries when DOM is ready
   setTimeout(loadRatingSummaries, 600);
      setTimeout(loadRatingSummaries, 500);
    }
  }

  // Show notification when auto-load is enabled
  function showAutoLoadNotification() {
    import('./utils/notifications.js').then(({ showNotification }) => {
      showNotification('Auto-load enabled! Movies will load automatically when you scroll to the bottom.', 'info');
    });
  }

  // Setup scroll listener for auto-loading
  function setupAutoLoadScrollListener() {
    let scrollTimeout;
    
    const handleScroll = () => {
      if (!autoLoadEnabled || isAutoLoading || isLoading) return;
      
      clearTimeout(scrollTimeout);
      scrollTimeout = setTimeout(() => {
        const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
        const windowHeight = window.innerHeight;
        const documentHeight = document.documentElement.scrollHeight;
        
        // Check if user is within 200px of the bottom
        if (scrollTop + windowHeight >= documentHeight - 200) {
          handleAutoLoad();
        }
      }, 100); // Debounce scroll events
    };
    
    // Use passive listener for better performance
    window.addEventListener('scroll', handleScroll, { passive: true });
  }

  // Handle automatic loading
  async function handleAutoLoad() {
    if (isAutoLoading || isLoading) return;
    
    isAutoLoading = true;
    
    // Show auto-loading indicator
    showAutoLoadIndicator();
    
    try {
      if (dreadScoreSortOrder === null) {
        await loadMovies();
      } else {
        // If DreadScore sorting is active, just show more from current results
        displayMovies();
      }
    } catch (error) {
      console.error('Auto-load failed:', error);
    } finally {
      isAutoLoading = false;
      hideAutoLoadIndicator();
    }
  }

  // Show auto-loading indicator
  function showAutoLoadIndicator() {
    const loadMoreBtn = document.getElementById('loadMoreBtn');
    if (loadMoreBtn) {
      loadMoreBtn.innerHTML = '<div class="loading-spinner-small"></div>Auto-loading...';
    }
  }

  // Hide auto-loading indicator
  function hideAutoLoadIndicator() {
    const loadMoreBtn = document.getElementById('loadMoreBtn');
    if (loadMoreBtn) {
      loadMoreBtn.innerHTML = '<span class="btn-icon">📽️</span>Load More Movies';
    }
  }

  // Trigger search function
  function triggerSearch() {
    const movieSearch = document.getElementById('movieSearch');
    if (movieSearch) {
      currentSearchQuery = movieSearch.value.trim();
      dreadScoreSortOrder = null;
      autoLoadEnabled = false; // Reset auto-load on category change
      updateDreadScoreButton();
      autoLoadEnabled = false; // Reset auto-load on search
      loadMovies(true);
    }
  }

  function updateDreadScoreButton() {
    const dreadScoreFilter = document.getElementById('dreadScoreFilter');
    const sortArrow = dreadScoreFilter?.querySelector('.sort-arrow');
    
    if (!dreadScoreFilter || !sortArrow) return;

    // Remove active class and reset arrow
    dreadScoreFilter.classList.remove('active');
    
    if (dreadScoreSortOrder === null) {
      sortArrow.textContent = '↓';
      sortArrow.style.opacity = '0.5';
    } else {
      dreadScoreFilter.classList.add('active');
      sortArrow.style.opacity = '1';
      sortArrow.textContent = dreadScoreSortOrder === 'desc' ? '↓' : '↑';
    }
  }

  // Advanced Search Functions
  function initializeAdvancedSearch() {
    console.log('Initializing advanced search...');
    
    // Populate category filter
    populateAdvancedFilters();
    
    // Setup event listeners
    setupAdvancedSearchListeners();
  }

  function populateAdvancedFilters() {
    const addFilterBtn = document.getElementById('addFilterBtn');
    if (!addFilterBtn || !window.ratings) return;

    // Populate will be handled when adding filters
  }

  function setupAdvancedSearchListeners() {
    const applyBtn = document.getElementById('applyAdvancedFilters');
    const clearBtn = document.getElementById('clearAdvancedFilters');
    const loadMoreBtn = document.getElementById('loadMoreAdvancedBtn');
    const searchInput = document.getElementById('advancedMovieSearch');
    const sortOrder = document.getElementById('advancedSortOrder');
    const moviesPerPage = document.getElementById('advancedMoviesPerPage');
    const addFilterBtn = document.getElementById('addFilterBtn');

    // Search input
    if (searchInput) {
      let searchTimeout;
      searchInput.addEventListener('input', (e) => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
          advancedSearchState.query = e.target.value.trim();
        }, 300);
      });

      // Enter key for advanced search
      searchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          applyAdvancedFilters();
        }
      });
    }

    // Advanced search button
    const advancedSearchBtn = document.getElementById('advancedSearchBtn');
    if (advancedSearchBtn) {
      advancedSearchBtn.addEventListener('click', (e) => {
        e.preventDefault();
        applyAdvancedFilters();
      });
    }

    // Sort order change
    if (sortOrder) {
      sortOrder.addEventListener('change', (e) => {
        advancedSearchState.sortOrder = e.target.value;
      });
    }

    // Movies per page change
    if (moviesPerPage) {
      moviesPerPage.addEventListener('change', (e) => {
        advancedSearchState.moviesPerPage = parseInt(e.target.value);
      });
    }

    // Add filter button
    if (addFilterBtn) {
      addFilterBtn.addEventListener('click', () => {
        addNewFilter();
      });
    }

    // Apply filters
    if (applyBtn) {
      applyBtn.addEventListener('click', () => {
        applyAdvancedFilters();
      });
    }

    // Clear filters
    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        clearAdvancedFilters();
      });
    }

    // Load more results
    if (loadMoreBtn) {
      loadMoreBtn.addEventListener('click', () => {
        loadMoreAdvancedResults();
      });
    }
  }

  function addNewFilter() {
    if (!window.ratings) return;

    import('./ratings.js').then(({ RATING_CATEGORIES }) => {
      const filterId = Date.now().toString();
      const filterHtml = createFilterHtml(filterId, RATING_CATEGORIES);
      
      const filtersContainer = document.getElementById('filtersContainer');
      filtersContainer.insertAdjacentHTML('beforeend', filterHtml);
      
      // Setup event listeners for this filter
      setupFilterListeners(filterId, RATING_CATEGORIES);
    });
  }

  function createFilterHtml(filterId, RATING_CATEGORIES) {
    return `
      <div class="filter-item" data-filter-id="${filterId}">
        <div class="filter-header">
          <h4>Content Filter ${document.querySelectorAll('.filter-item').length + 1}</h4>
          <button class="remove-filter-btn" data-filter-id="${filterId}" title="Remove filter">×</button>
        </div>
        
        <div class="filter-controls">
          <div class="filter-group">
            <label>Category</label>
            <select class="category-select" data-filter-id="${filterId}">
              <option value="">Select category...</option>
              ${Object.entries(RATING_CATEGORIES).map(([key, category]) => 
                `<option value="${key}">${category.name}</option>`
              ).join('')}
            </select>
          </div>
          
          <div class="filter-group">
            <label>Subcategory</label>
            <select class="subcategory-select" data-filter-id="${filterId}" disabled>
              <option value="">Select subcategory...</option>
            </select>
          </div>
          
          <div class="filter-group">
            <label>Min Score</label>
            <select class="min-score-select" data-filter-id="${filterId}">
              <option value="0">0 (Any)</option>
              ${Array.from({length: 10}, (_, i) => i + 1).map(score => 
                `<option value="${score}">${score}</option>`
              ).join('')}
            </select>
          </div>
          
          <div class="filter-group">
            <label>Max Score</label>
            <select class="max-score-select" data-filter-id="${filterId}">
              ${Array.from({length: 11}, (_, i) => i).map(score => 
                `<option value="${score}" ${score === 10 ? 'selected' : ''}>${score === 0 ? '0' : score}</option>`
              ).join('')}
            </select>
          </div>
        </div>
      </div>
    `;
  }

  function setupFilterListeners(filterId, RATING_CATEGORIES) {
    const categorySelect = document.querySelector(`.category-select[data-filter-id="${filterId}"]`);
    const subcategorySelect = document.querySelector(`.subcategory-select[data-filter-id="${filterId}"]`);
    const removeBtn = document.querySelector(`.remove-filter-btn[data-filter-id="${filterId}"]`);
    
    // Category change
    if (categorySelect) {
      categorySelect.addEventListener('change', (e) => {
        const categoryKey = e.target.value;
        populateSubcategoriesForFilter(filterId, categoryKey, RATING_CATEGORIES);
      });
    }
    
    // Remove filter
    if (removeBtn) {
      removeBtn.addEventListener('click', () => {
        removeFilter(filterId);
      });
    }
  }

  function populateSubcategoriesForFilter(filterId, categoryKey, RATING_CATEGORIES) {
    const subcategorySelect = document.querySelector(`.subcategory-select[data-filter-id="${filterId}"]`);
    if (!subcategorySelect) return;

    subcategorySelect.innerHTML = '<option value="">Select subcategory...</option>';
    subcategorySelect.disabled = !categoryKey;

    if (categoryKey) {
      const category = RATING_CATEGORIES[categoryKey];
      if (category && category.subcategories) {
        Object.entries(category.subcategories).forEach(([key, subcategory]) => {
          const option = document.createElement('option');
          option.value = key;
          option.textContent = subcategory.name;
          subcategorySelect.appendChild(option);
        });
      }
    }
  }

  function removeFilter(filterId) {
    const filterElement = document.querySelector(`.filter-item[data-filter-id="${filterId}"]`);
    if (filterElement) {
      filterElement.remove();
      
      // Update filter numbers
      const remainingFilters = document.querySelectorAll('.filter-item');
      remainingFilters.forEach((filter, index) => {
        const header = filter.querySelector('.filter-header h4');
        if (header) {
          header.textContent = `Content Filter ${index + 1}`;
        }
      });
    }
  }

  function collectFiltersFromUI() {
    const filters = [];
    const filterItems = document.querySelectorAll('.filter-item');
    
    filterItems.forEach(item => {
      const filterId = item.dataset.filterId;
      const category = item.querySelector(`.category-select[data-filter-id="${filterId}"]`)?.value;
      const subcategory = item.querySelector(`.subcategory-select[data-filter-id="${filterId}"]`)?.value;
      const minScore = parseInt(item.querySelector(`.min-score-select[data-filter-id="${filterId}"]`)?.value) || 0;
      const maxScore = parseInt(item.querySelector(`.max-score-select[data-filter-id="${filterId}"]`)?.value) || 10;
      
      if (category && subcategory) {
        filters.push({ category, subcategory, minScore, maxScore });
      }
    });
    
    return filters;
  }

  async function applyAdvancedFilters() {
    const filters = collectFiltersFromUI();
    
    if (filters.length === 0) {
      showNotification('Please add at least one content filter', 'error');
      return;
    }

    advancedSearchState.isActive = true;
    advancedSearchState.currentPage = 1;
    advancedSearchState.filters = filters;

    const statusElement = document.getElementById('advancedSearchStatus');
    const resultsGrid = document.getElementById('advancedSearchMoviesGrid');
    const loadMoreBtn = document.getElementById('loadMoreAdvancedBtn');

    if (statusElement) {
      statusElement.innerHTML = `
        <div class="loading-movies">
          <div class="loading-spinner"></div>
          <p>Searching for movies...</p>
        </div>
      `;
    }

    try {
      // Use a smaller, more manageable set of movies for filtering
      let moviesToFilter = [];
      
      addSentryBreadcrumb('Advanced search started', 'user_action', 'info', {
        query: advancedSearchState.query
      });
      
      if (advancedSearchState.query) {
        // Search for movies - limit to first 2 pages for performance
        moviesToFilter = await withSentryApiTracking(
          () => searchMovies(advancedSearchState.query, 1),
          'tmdb_advanced_search'
        )();
      } else {
        // Get popular movies - limit to first 2 pages for performance
        moviesToFilter = await withSentryApiTracking(
          () => fetchMoviesByCategory('popular', 1),
          'tmdb_popular_for_advanced_search'
        )();
      }

      if (statusElement) {
        statusElement.innerHTML = `
          <div class="loading-movies">
            <div class="loading-spinner"></div>
            <p>Filtering movies by content ratings...</p>
          </div>
        `;
      }

      // Filter movies that have ratings in the selected subcategories
      const filteredMovies = await getMoviesWithRatings(moviesToFilter, advancedSearchState.filters);
      
      if (statusElement) {
        statusElement.innerHTML = `
          <div class="loading-movies">
            <div class="loading-spinner"></div>
            <p>Sorting results...</p>
          </div>
        `;
      }

      // Sort by average rating across filters
      const sortedMovies = filteredMovies.length > 0 ? 
        await sortMoviesByAverageScore(filteredMovies, advancedSearchState.filters, advancedSearchState.sortOrder) :
        [];
      
      // Store results
      advancedSearchState.results = sortedMovies;
      
      // Display results
      displayAdvancedSearchResults();
      
    } catch (error) {
      captureError(error, {
        tags: { type: 'advanced_search_error' },
        extra: { searchState: advancedSearchState }
      });
      
      if (statusElement) {
        statusElement.innerHTML = `
          <div class="search-status">
            <p style="color: var(--text-secondary);">Error occurred while searching. Please try again.</p>
          </div>
        `;
      }
    }
  }

  const getMoviesWithRatings = async (allMovies, filters) => {
    if (!window.ratingsService) return [];

    const filteredMovies = [];
    const maxMoviesToCheck = Math.min(allMovies.length, 50); // Limit to 50 movies for performance
    
    for (let i = 0; i < maxMoviesToCheck; i++) {
      const movie = allMovies[i];
      // Movie must satisfy ALL filters
      let satisfiesAllFilters = true;
      
      for (const filter of filters) {
        try {
          const avgRating = await window.ratingsService.getAverageRating(movie.id, filter.category, filter.subcategory);
          const numericRating = avgRating ? parseFloat(avgRating) : null;
        
          // If no rating exists, exclude the movie
          if (numericRating === null || isNaN(numericRating)) {
            satisfiesAllFilters = false;
            break;
          }
        
          // Check if rating is within the specified range
          if (!(numericRating >= filter.minScore && numericRating <= filter.maxScore)) {
            satisfiesAllFilters = false;
            break;
          }
        } catch (error) {
          console.error(`Error checking rating for movie ${movie.id}:`, error);
          satisfiesAllFilters = false;
          break;
        }
      }
      
      if (satisfiesAllFilters) {
        filteredMovies.push(movie);
      }
      
      // Stop if we have enough results
      if (filteredMovies.length >= 20) {
        break;
      }
    }
    
    return filteredMovies;
  }

  async function sortMoviesByAverageScore(movies, filters, sortOrder) {
    if (!window.ratingsService) return movies;

    // Calculate average scores for all movies
    const moviesWithScores = await Promise.all(
      movies.map(async (movie) => {
        const score = await calculateAverageFilterScore(movie.id, filters);
        return {
          ...movie,
          averageScore: score
        };
      })
    );

    return moviesWithScores.sort((a, b) => {
      // Calculate average score across all filters for each movie
      const scoreA = a.averageScore;
      const scoreB = b.averageScore;
      
      return sortOrder === 'asc' ? scoreA - scoreB : scoreB - scoreA;
    });
  }

  function displayAdvancedSearchResults() {
    const statusElement = document.getElementById('advancedSearchStatus');
    const resultsGrid = document.getElementById('advancedSearchMoviesGrid');
    const loadMoreBtn = document.getElementById('loadMoreAdvancedBtn');

    const results = advancedSearchState.results || [];
    const startIndex = 0;
    const endIndex = advancedSearchState.currentPage * advancedSearchState.moviesPerPage;
    const displayedMovies = results.slice(startIndex, endIndex);

    // Update status
    if (statusElement) {
      if (results.length === 0) {
        statusElement.innerHTML = `
          <div class="search-status">
            <p style="color: var(--text-secondary);">No movies found matching the specified content filters.</p>
          </div>
        `;
      } else {
        const filterSummary = advancedSearchState.filters.map(filter => {
          return `${getSubcategoryName(filter.category, filter.subcategory)}: ${filter.minScore}-${filter.maxScore}`;
        }).join(', ');
        
        statusElement.innerHTML = `
          <div class="search-results-summary">
            <h4>Search Results</h4>
            <p>Found <strong>${results.length}</strong> movies matching content filters</p>
            <p class="filter-summary">Filters: ${filterSummary}</p>
            <p>Showing <strong>${Math.min(displayedMovies.length, results.length)}</strong> of <strong>${results.length}</strong> results</p>
          </div>
        `;
      }
    }

    // Display movies
    if (resultsGrid) {
      if (displayedMovies.length > 0) {
        // Create movie cards asynchronously for advanced search too
        Promise.all(displayedMovies.map(movie => createAdvancedSearchMovieCard(movie)))
          .then(movieCards => {
            resultsGrid.innerHTML = movieCards.join('');
          });
      } else {
        resultsGrid.innerHTML = '';
      }
    }

    // Update load more button
    if (loadMoreBtn) {
      if (displayedMovies.length < results.length) {
        loadMoreBtn.style.display = 'block';
      } else {
        loadMoreBtn.style.display = 'none';
      }
    }
  }

  function getSubcategoryName(categoryKey, subcategoryKey) {
    if (!window.ratings) return 'Unknown';
    
    // This will need to be imported when needed
    return `${categoryKey}/${subcategoryKey}`;
  }

  async function createAdvancedSearchMovieCard(movie) {
    const currentUser = JSON.parse(localStorage.getItem('currentUser'));
    
    // Get specific subcategory rating
    let filtersRating = '';
    if (window.ratingsService && advancedSearchState.filters.length > 0) {
      const filterRatings = await Promise.all(
        advancedSearchState.filters.map(async (filter) => {
          const avgRating = await window.ratingsService.getAverageRating(movie.id, filter.category, filter.subcategory);
          const ratingCount = await window.ratingsService.getRatingCount(movie.id, filter.category, filter.subcategory);
        
          return {
            filter,
            avgRating,
            ratingCount
          };
        })
      );
      
      filtersRating = `
        <div class="advanced-rating-display">
          <div class="filters-ratings">
            ${filterRatings.map(({ filter, avgRating, ratingCount }) => `
              <div class="filter-rating">
                <span class="filter-name">${getSubcategoryDisplayName(filter.category, filter.subcategory)}</span>
                <span class="filter-score">${avgRating !== null ? `${avgRating}/10` : 'N/A'}</span>
              </div>
            `).join('')}
          </div>
        </div>
      `;
    }

    // Get watchlist button
    let watchlistButton = '';
    if (window.watchlist) {
      watchlistButton = window.watchlist.createWatchlistButton(movie.id, currentUser);
    }

    return `
      <div class="movie-card" data-movie-id="${movie.id}">
        <div class="movie-poster">
          <img src="${getImageUrl(movie.poster_path)}" alt="${movie.title}" loading="lazy" onerror="this.src='https://images.pexels.com/photos/7991579/pexels-photo-7991579.jpeg?auto=compress&cs=tinysrgb&w=500'">
          <div class="movie-overlay">
            <button class="btn btn-primary movie-details-btn" onclick="navigateToMovie(${movie.id})">
              <span class="btn-icon">👁️</span>
              View Details
            </button>
          </div>
        </div>
        <div class="movie-info">
          <h3 class="movie-title">${movie.title}</h3>
          <div class="movie-meta">
            <span class="movie-year">${getYear(movie.release_date)}</span>
            <div class="movie-rating">
              <span class="rating-star">⭐</span>
              <span>${movie.vote_average ? movie.vote_average.toFixed(1) : 'N/A'}</span>
            </div>
          </div>
          <p class="movie-overview">${movie.overview || 'No overview available.'}</p>
          ${filtersRating}
          <div class="movie-card-actions">
            ${watchlistButton}
          </div>
        </div>
      </div>
    `;
  }

  function getSubcategoryDisplayName(categoryKey, subcategoryKey) {
    // This is a simplified version - in a real implementation, 
    // you'd import the RATING_CATEGORIES to get the proper names
    const categoryNames = {
      violence: 'Violence',
      sexual: 'Sexual',
      language: 'Language',
      disturbing: 'Disturbing'
    };
    
    const subcategoryNames = {
      physicalViolence: 'Physical Violence',
      weaponViolence: 'Weapon Violence',
      goreBlood: 'Gore & Blood',
      torture: 'Torture',
      jumpScares: 'Jump Scares',
      animalCruelty: 'Animal Cruelty',
      romance: 'Romance',
      sexualNonExplicit: 'Sexual (Non-Explicit)',
      sexualExplicit: 'Sexual (Explicit)',
      sexualViolence: 'Sexual Violence',
      profanity: 'Profanity',
      humor: 'Humor',
      bodyHorror: 'Body Horror',
      substanceUse: 'Substance Use',
      mentalHealthCrises: 'Mental Health',
      selfHarmSuicide: 'Self-Harm/Suicide',
      childEndangerment: 'Child Endangerment',
      discrimination: 'Discrimination',
      deathGrief: 'Death/Grief',
      crimeIllegal: 'Crime/Illegal',
      psychologicalHorror: 'Psychological Horror',
      intenseSituations: 'Intense Situations'
    };
    
    return subcategoryNames[subcategoryKey] || subcategoryKey;
  }

  function loadMoreAdvancedResults() {
    advancedSearchState.currentPage++;
    displayAdvancedSearchResults();
  }

  function clearAdvancedFilters() {
    // Clear search input
    const searchInput = document.getElementById('advancedMovieSearch');
    if (searchInput) {
      searchInput.value = '';
    }
    
    // Remove all filters
    const filtersContainer = document.getElementById('filtersContainer');
    if (filtersContainer) {
      filtersContainer.innerHTML = '';
    }
    
    // Reset other controls
    const sortOrder = document.getElementById('advancedSortOrder');
    const moviesPerPage = document.getElementById('advancedMoviesPerPage');
    
    if (sortOrder) sortOrder.selectedIndex = 0;
    if (moviesPerPage) moviesPerPage.selectedIndex = 0;

    // Reset state
    advancedSearchState = {
      query: '',
      filters: [],
      sortOrder: 'desc',
      moviesPerPage: 12,
      currentPage: 1,
      isActive: false,
      results: []
    };

    // Clear results
    const statusElement = document.getElementById('advancedSearchStatus');
    const resultsGrid = document.getElementById('advancedSearchMoviesGrid');
    const loadMoreBtn = document.getElementById('loadMoreAdvancedBtn');

    if (statusElement) {
      statusElement.innerHTML = '<p>Select filters above and click "Apply Filters" to search for movies</p>';
    }

    if (resultsGrid) {
      resultsGrid.innerHTML = '';
    }

    if (loadMoreBtn) {
      loadMoreBtn.style.display = 'none';
    }
  }

  // Utility functions
  function getImageUrl(path) {
    if (!path) return 'https://images.pexels.com/photos/7991579/pexels-photo-7991579.jpeg?auto=compress&cs=tinysrgb&w=500';
    if (path.startsWith('http')) return path;
    return `https://image.tmdb.org/t/p/w500${path}`;
  }

  function getYear(dateString) {
    if (!dateString) return 'N/A';
    return new Date(dateString).getFullYear();
  }

  function navigateToMovie(movieId) {
    if (window.navigateTo) {
      window.navigateTo(`/movie/${movieId}`);
    } else {
      window.location.href = `/movie/${movieId}`;
    }
  }

  // Make navigateToMovie globally available
  window.navigateToMovie = navigateToMovie;

  // Function to get loaded movie IDs (for testing purposes)
  function getLoadedMovieIds() {
    return allMovies.map(movie => movie.id);
  }

  // Calculate average filter score for advanced search
  async function calculateAverageFilterScore(movieId, filters) {
    if (!window.ratingsService || filters.length === 0) return 0;

    let totalScore = 0;
    let validFilters = 0;

    for (const filter of filters) {
      try {
        const avgRating = await window.ratingsService.getAverageRating(movieId, filter.category, filter.subcategory);
        if (avgRating !== null && !isNaN(parseFloat(avgRating))) {
          totalScore += parseFloat(avgRating);
          validFilters++;
        }
      } catch (error) {
        console.error(`Error getting rating for ${filter.category}/${filter.subcategory}:`, error);
      }
    }

    return validFilters > 0 ? totalScore / validFilters : 0;
  }

  // Public API
  return {
    loadMovies,
    searchMovies,
    initializeAdvancedSearch,
    getLoadedMovieIds,
    displayMovies,
    loadRatingSummaries
  };
}