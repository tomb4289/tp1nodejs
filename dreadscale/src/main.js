import './styles/main.css';
import { initializeSentry } from './utils/sentry.js';
import { initializeRandomFavicon } from './utils/favicon.js';
import { initializeAuth } from './auth.js';
import { initializeWatchlist } from './watchlist.js';
import { initializeRatings } from './ratings.js';
import { initializeChat } from './chat.js';
import { initializeRouter } from './router.js';
import { initializeMovies } from './movies.js';
import { initializeNavigation } from './navigation.js';
import { initializeAnimations } from './animations.js';
import { initializeTheme } from './theme.js';
import { showNotification } from './utils/notifications.js';

// Import Supabase services to make them globally available
import { authService } from './lib/auth-supabase.js';
import { ratingsService } from './lib/ratings-supabase.js';
import { watchlistService } from './lib/watchlist-supabase.js';

// Initialize Sentry first for error monitoring
initializeSentry();

// Initialize random favicon
initializeRandomFavicon();

document.querySelector('#app').innerHTML = `
  <nav class="navbar">
    <div class="nav-container">
      <div class="nav-logo">
        <a href="#movies" class="nav-logo-link" data-route="/movies">
          <h2>DreadScale</h2>
        </a>
      </div>
      <ul class="nav-menu">
        <li class="nav-item">
          <a href="#movies" class="nav-link">Movies</a>
        </li>
        <li class="nav-item">
          <a href="#advancedSearch" class="nav-link">Search <span class="search-plus">+</span></a>
        </li>
        <li class="nav-item">
          <a href="#about" class="nav-link">About</a>
        </li>
        <li class="nav-item">
          <a href="#account" class="nav-link" id="accountNavLink">Account</a>
        </li>
      </ul>
      <div class="nav-actions">
        <button class="theme-toggle" id="themeToggle" title="Toggle theme">
          <span class="theme-icon">💡</span>
        </button>
      </div>
      <div class="hamburger">
        <span class="bar"></span>
        <span class="bar"></span>
        <span class="bar"></span>
      </div>
    </div>
  </nav>

  <main>
    <section id="movies" class="movies main-content-section">
      <div class="container">
        <div class="section-header">
                  <h2 class="section-title">Movie Database </h2>
                  <p class="section-subtitle">A movie rating platform focused on content analysis and detailed user ratings across multiple categories</p>
                  

        </div>
        
        <div class="movies-controls">
          <div class="movies-filters">
            <div class="filter-group">
              <label for="categoryFilter">Category</label>
              <!-- Category filter will be replaced with custom dropdown -->
              <select id="categoryFilter">
                <option value="popular">Popular Movies</option>
                <option value="top_rated">Top Rated</option>
                <option value="upcoming">Upcoming</option>
                <option value="now_playing">Now Playing</option>
              </select>
            </div>
            <div class="filter-group search-group">
              <label for="movieSearch">Search Movies</label>
              <div class="search-input-container">
                <input type="text" id="movieSearch" placeholder="🔍 Search movies...">
                <button class="search-arrow-btn" id="movieSearchBtn" type="button">
                  <span class="search-arrow-icon">→</span>
                </button>
              </div>
            </div>
            <div class="filter-group">
              <label>Advanced Search</label>
              <a href="#advancedSearch" class="advanced-search-link" data-route="/search-plus">
                Advanced Search
              </a>
            </div>
            <div class="filter-group">
              <label for="dreadScoreFilter">Sort by DreadScore</label>
              <button id="dreadScoreFilter" class="dreadscore-filter-btn">
                <span class="filter-text">DreadScore</span>
                <span class="sort-arrow">↓</span>
              </button>
            </div>
            <div class="filter-group">
              <label for="moviesPerPageFilter">Movies per page</label>
              <select id="moviesPerPageFilter">
                <option value="6" selected>6</option>
                <option value="12">12</option>
                <option value="18">18</option>
                <option value="24">24</option>
                <option value="36">36</option>
              </select>
            </div>
          </div>
        </div>

        <div id="moviesGrid" class="movies-grid">
          <div class="loading-movies">
            <div class="loading-spinner"></div>
            <p>Loading amazing movies...</p>
          </div>
        </div>

        <div class="movies-actions">
          <button id="loadMoreBtn" class="btn btn-primary">
            <span class="btn-icon">📽️</span>
            Load More Movies
          </button>
          
        </div>
      </div>
    </section>

    <section id="advancedSearch" class="advanced-search main-content-section">
      <div class="container">
        <div class="section-header">
          <h2 class="section-title">🔍 Search <span class="search-plus-title">+</span></h2>
          <p class="section-subtitle">Find movies by specific content ratings and advanced filters</p>
        </div>
        
        <div class="advanced-search-controls">
          <div class="advanced-filters-grid">
            <div class="advanced-search-row">
              <div class="filter-group">
                <label for="advancedMovieSearch">Search Movies</label>
                <div class="search-input-container">
                  <input type="text" id="advancedMovieSearch" placeholder="🔍 Search movies...">
                  <button class="search-arrow-btn" id="advancedSearchBtn" type="button">
                    <span class="search-arrow-icon">→</span>
                  </button>
                </div>
              </div>
            
              <div class="filter-group">
                <label for="advancedSortOrder">Sort Order</label>
                <select id="advancedSortOrder">
                  <option value="desc">Highest to Lowest</option>
                  <option value="asc">Lowest to Highest</option>
                </select>
              </div>
              
              <div class="filter-group">
                <label for="advancedMoviesPerPage">Movies per page</label>
                <select id="advancedMoviesPerPage">
                  <option value="12" selected>12</option>
                  <option value="18">18</option>
                  <option value="24">24</option>
                  <option value="36">36</option>
                  <option value="48">48</option>
                </select>
              </div>
            
              <div class="filter-group filter-actions">
                <!-- Filter buttons moved below -->
              </div>
            </div>
          </div>
          
          <div class="content-filters-section">
            <h3>Content Filters</h3>
            <p class="filters-description">Add multiple content filters to find movies that match specific rating criteria. Each filter must be satisfied for a movie to appear in results.</p>
            <div id="filtersContainer" class="filters-container">
              <!-- Dynamic filters will be added here -->
            </div>
            
            <div class="content-filter-actions">
              <button id="addFilterBtn" class="btn btn-secondary">
                <span class="btn-icon">➕</span>
                Add Content Filter
              </button>
              <button id="applyAdvancedFilters" class="btn btn-primary">
                <span class="btn-icon">🔍</span>
                Apply Filters
              </button>
              <button id="clearAdvancedFilters" class="btn btn-secondary">
                <span class="btn-icon">🗑️</span>
                Clear
              </button>
            </div>
          </div>
          
          <div class="advanced-search-info">
            <div class="search-info-card">
              <h4>💡 How Advanced Search Works</h4>
              <ul>
                <li><strong>Multiple Filters:</strong> Add multiple content filters to create complex search criteria</li>
                <li><strong>Score Ranges:</strong> Set minimum and maximum scores for each content type</li>
                <li><strong>AND Logic:</strong> Movies must satisfy ALL filters to appear in results</li>
                <li><strong>Example:</strong> Find movies with Humor ≥ 7 AND Physical Violence ≤ 3 for funny but not too violent content</li>
                <li><strong>Sorting:</strong> Results are sorted by average score across all your filters</li>
              </ul>
            </div>
          </div>
        </div>

        <div class="advanced-search-results">
          <div id="advancedSearchStatus" class="search-status">
            <p>Select filters above and click "Apply Filters" to search for movies</p>
          </div>
          
          <div id="advancedSearchMoviesGrid" class="movies-grid">
            <!-- Results will be displayed here -->
          </div>
          
          <div class="advanced-search-actions">
            <button id="loadMoreAdvancedBtn" class="btn btn-primary" style="display: none;">
              <span class="btn-icon">📽️</span>
              Load More Results
            </button>
          </div>
        </div>
      </div>
    </section>

    <section id="account" class="account-page main-content-section">
      <div class="container">
        <div id="accountContent">
          <!-- Account content will be dynamically inserted here -->
        </div>
      </div>
    </section>

    <section id="about" class="about-page main-content-section">
      <div class="container">
        <div class="section-header">
          <h2 class="section-title">📖 About DreadScale</h2>
          <p class="section-subtitle">Discover movies through detailed content analysis and community-driven ratings</p>
        </div>
        
        <div class="about-content">
          <div class="about-intro">
            <p>DreadScale helps you discover movies through detailed content ratings. Instead of just one score, we break down movies by violence, language, sexual content, and disturbing themes so you know exactly what to expect.</p>
            <p>Rate movies yourself, find others with similar tastes, and use our advanced search to filter by specific content. Whether you want something family-friendly or don't mind intense content, DreadScale helps you find the right movie.</p>
          </div>
          
          <div class="contact-section">
            <h3>Contact</h3>
            <div class="contact-info">
              <div class="contact-item">
                <h4>Email</h4>
                <p><strong>tommyb4289@gmail.com</strong></p>
                <p>Questions, feedback, or bug reports</p>
              </div>
            
              <div class="contact-item">
                <h4>Community</h4>
                <p>Join movie discussions right here on DreadScale</p>
                <p>Rate movies and share your thoughts</p>
              </div>
            
              <div class="contact-item">
                <h4>Open Source</h4>
                <p>Built with modern web technologies</p>
                <p>Powered by community contributions</p>
              </div>
            </div>
          </div>
        </div>
        
        <div class="contact-form">
          <h3>Send us a message</h3>
          <form id="contactForm">
            <div class="form-group">
              <label for="contactName">Name</label>
              <input type="text" id="contactName" name="name" required>
            </div>
            
            <div class="form-group">
              <label for="contactEmail">Email</label>
              <input type="email" id="contactEmail" name="email" required>
            </div>
            
            <div class="form-group">
              <label for="contactSubject">Subject</label>
              <select id="contactSubject" name="subject" required>
                <option value="">Select a topic</option>
                <option value="general">General Inquiry</option>
                <option value="bug">Bug Report</option>
                <option value="feature">Feature Request</option>
                <option value="feedback">Feedback</option>
                <option value="other">Other</option>
              </select>
            </div>
            
            <div class="form-group">
              <label for="contactMessage">Message</label>
              <textarea id="contactMessage" name="message" rows="6" required placeholder="Tell us how we can help you..."></textarea>
            </div>
            
            <button type="submit" class="btn btn-primary">
              <span class="btn-icon">📤</span>
              Send Message
            </button>
          </form>
        </div>
      </div>
    </section>
  </main>

  <!-- Authentication Modal -->
  <div id="authOverlay" class="modal-overlay">
    <div id="authModal" class="auth-modal">
      <div class="auth-header">
        <div class="auth-tabs">
          <button id="loginTab" class="auth-tab active">Login</button>
          <button id="registerTab" class="auth-tab">Register</button>
        </div>
        <button class="modal-close" onclick="document.getElementById('authOverlay').style.display='none'; document.body.style.overflow='auto'">×</button>
      </div>
      
      <div class="auth-content">
        <div id="authForms" class="auth-forms">
          <!-- Login Form -->
          <form id="loginForm" class="auth-form">
            <h3>Welcome Back</h3>
            <p class="auth-subtitle">Sign in to your account</p>
            
            <div class="form-group">
              <label for="loginEmail">Email Address</label>
              <input type="email" id="loginEmail" name="email" required value="testuser1@example.com" required>
            </div>
            
            <div class="form-group">
              <label for="loginPassword">Password</label>
              <input type="password" id="loginPassword" name="password" required value="123456">
            </div>
            
            <button type="submit" class="btn btn-primary auth-btn">
              <span class="btn-icon">🔑</span>
              Sign In
            </button>
          </form>

          <!-- Register Form -->
          <form id="registerForm" class="auth-form">
            <h3>Create Account</h3>
            <p class="auth-subtitle">Join our community today</p>
            
            <div class="form-row">
              <div class="form-group">
                <label for="regFirstName">First Name</label>
                <input type="text" id="regFirstName" name="firstName" required>
              </div>
              <div class="form-group">
                <label for="regLastName">Last Name</label>
                <input type="text" id="regLastName" name="lastName" required>
              </div>
            </div>
            
            <div class="form-group">
              <label for="regEmail">Email Address</label>
              <input type="email" id="regEmail" name="email" required>
            </div>
            
            <div class="form-row">
              <div class="form-group">
                <label for="regPassword">Password</label>
                <input type="password" id="regPassword" name="password" required minlength="6">
              </div>
              <div class="form-group">
                <label for="regConfirmPassword">Confirm Password</label>
                <input type="password" id="regConfirmPassword" name="confirmPassword" required minlength="6">
              </div>
            </div>
            
            <div class="form-row">
              <div class="form-group">
                <label for="regDateOfBirth">Date of Birth</label>
                <input type="date" id="regDateOfBirth" name="dateOfBirth">
              </div>
              <div class="form-group">
                <label for="regPhone">Phone (Optional)</label>
                <input type="tel" id="regPhone" name="phone">
              </div>
            </div>
            
            <div class="form-group">
              <label for="regBio">Bio (Optional)</label>
              <textarea id="regBio" name="bio" rows="3" placeholder="Tell us a bit about yourself..."></textarea>
            </div>
            
            <button type="submit" class="btn btn-primary auth-btn">
              <span class="btn-icon">👤</span>
              Create Account
            </button>
          </form>
        </div>
      </div>
    </div>
  </div>

  <footer class="footer">
    <div class="container">
      <div class="footer-nav">
        <div class="footer-nav-section footer-nav-left">
          <a href="#movies" class="footer-nav-link" data-route="/movies">
            <span class="footer-nav-icon">🎬</span>
            <span class="footer-nav-text">Movies</span>
          </a>
        </div>
        
        <div class="footer-nav-section footer-nav-center">
          <a href="#advancedSearch" class="footer-nav-link" data-route="/search-plus">
            <span class="footer-nav-icon">🔍</span>
            <span class="footer-nav-text">Search <span class="search-plus-footer">+</span></span>
          </a>
        </div>
        
        <div class="footer-nav-section footer-nav-right">
          <a href="#about" class="footer-nav-link" data-route="/about">
            <span class="footer-nav-icon">📞</span>
            <span class="footer-nav-text">About</span>
          </a>
        </div>
        
        <div class="footer-nav-section footer-nav-account">
          <a href="#account" class="footer-nav-link" data-route="/account" id="footerAccountLink">
            <span class="footer-nav-icon">👤</span>
            <span class="footer-nav-text">Account</span>
          </a>
        </div>
      </div>
      
      <div class="footer-bottom">
        <div class="footer-brand">
          <h4>DreadScale</h4>
          <p>Your gateway to discovering amazing movies</p>
        </div>
        <div class="footer-copyright">
          <p>&copy; 2025 DreadScale. All rights reserved.</p>
          
        </div>
      </div>
    </div>
  </footer>
`;

// Initialize functionality
(async function initializeApp() {
  // Show loading state while auth initializes
  const showAuthLoading = () => {
    const accountNavLink = document.getElementById('accountNavLink');
    if (accountNavLink) {
      // Try to show cached user data immediately to prevent flash
      try {
        const storedUser = localStorage.getItem('currentUser');
        if (storedUser) {
          const user = JSON.parse(storedUser);
          accountNavLink.innerHTML = `
            <span class="nav-user">
              <span class="nav-avatar" style="background: ${user.avatar.color}">
                ${user.avatar.initials}
              </span>
              ${user.firstName}
            </span>
          `;
          return; // Exit early if we have cached data
        }
      } catch (error) {
        // Fall through to loading state
      }
      
      // Show loading spinner only if no cached data
      if (!authService.isInitialized()) {
        accountNavLink.innerHTML = '<span class="loading-spinner-small"></span>';
      }
    }
  };
  
  showAuthLoading();
  
  const auth = initializeAuth()
  const watchlist = initializeWatchlist()
  const ratings = initializeRatings()
  const chat = initializeChat()

  // Initialize movies module and capture its API
  const moviesModule = initializeMovies()

  // Initialize other modules
  initializeNavigation(auth)
  initializeAnimations()
  initializeTheme()

  // Initialize router with module dependencies
  const router = await initializeRouter({
    auth,
    watchlist,
    ratings,
    chat,
    moviesModule
  })

  // Initialize router
  router.init()
  
  // Make router globally available for cache clearing
  window.router = router

  // Initialize contact form
  // No form needed anymore

  // Make modules globally available
  window.showAuthModal = auth.showAuthModal
  window.updateAccountPage = auth.updateAccountPage
  window.auth = auth // Make the entire auth module available
  window.authService = authService // Make auth service available for optimized user access
  window.watchlist = watchlist
  window.ratings = ratings
  window.chat = chat
  window.moviesModule = moviesModule // Make movies module available globally
  
  // Make Supabase services globally available
  window.ratingsService = ratingsService
  window.watchlistService = watchlistService
  
  // Listen for auth initialization to update UI
  document.addEventListener('authInitialized', () => {
    // Update any UI that depends on auth state
    if (window.moviesModule && window.moviesModule.loadRatingSummaries) {
      setTimeout(() => {
        window.moviesModule.loadRatingSummaries();
      }, 100);
    }
  });
  
  // Make OMDb cache available globally for debugging
  import('./utils/omdb-cache.js').then(({ omdbCache, getOMDbCacheStats, clearOMDbCache }) => {
    window.omdbCache = omdbCache;
    window.getOMDbCacheStats = getOMDbCacheStats;
    window.clearOMDbCache = clearOMDbCache;
    
    // Add a helper function to clear cache for specific movies
    window.clearOMDbCacheForMovie = (movieTitle, year) => {
      const key = omdbCache.generateKey(movieTitle, year);
      const cache = omdbCache.getCache();
      delete cache[key];
      localStorage.setItem('omdb_ratings_cache', JSON.stringify(cache));
      console.log(`Cleared OMDb cache for: ${movieTitle} (${year})`);
    };
  });
  
  // Load rating summaries for any existing movie cards after services are available
  if (moviesModule && moviesModule.loadRatingSummaries) {
    setTimeout(() => {
      moviesModule.loadRatingSummaries();
    }, 1000);
  }
})()

// Initialize contact form functionality
function initializeContactForm() {
  const contactForm = document.getElementById('contactForm');
  
  if (contactForm) {
    contactForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const formData = new FormData(contactForm);
      const data = {
        name: formData.get('name'),
        email: formData.get('email'),
        subject: formData.get('subject'),
        message: formData.get('message')
      };
      
      // Validate form data
      if (!data.name || !data.email || !data.subject || !data.message) {
        showNotification('Please fill in all required fields.', 'error');
        return;
      }
      
      // Disable form during submission
      const submitButton = contactForm.querySelector('button[type="submit"]');
      const originalButtonText = submitButton.innerHTML;
      submitButton.disabled = true;
      submitButton.innerHTML = '<div class="loading-spinner-small"></div>Sending...';
      
      try {
        // Send email via Supabase Edge Function
        const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-contact-email`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(data)
        });
        
        const result = await response.json();
        
        if (response.ok && result.success) {
          showNotification('Thank you for your message! We\'ll get back to you soon.', 'success');
          contactForm.reset();
        } else {
          throw new Error(result.error || 'Failed to send message');
        }
        
      } catch (error) {
        console.error('Error sending contact form:', error);
        showNotification('Sorry, there was an error sending your message. Please try again later.', 'error');
      } finally {
        // Re-enable form
        submitButton.disabled = false;
        submitButton.innerHTML = originalButtonText;
      }
    });
  }
}

// Initialize contact form
initializeContactForm()