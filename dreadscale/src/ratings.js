import { debounce } from './utils/debounce.js';
import { ratingsService } from './lib/ratings-supabase.js';
import { showNotification } from './utils/notifications.js';
import { addSentryBreadcrumb, captureError } from './utils/sentry.js';

// Rating categories and subcategories with weights
export const RATING_CATEGORIES = {
  violence: {
    name: 'Violence',
    subcategories: {
      physicalViolence: { name: 'Physical Violence', weight: 0.9 },
      weaponViolence: { name: 'Weapon Violence', weight: 1.0 },
      goreBlood: { name: 'Gore & Blood', weight: 1.0 },
      torture: { name: 'Torture', weight: 1.0 },
      jumpScares: { name: 'Jump Scares', weight: 0.6 },
      animalCruelty: { name: 'Animal Cruelty', weight: 1.0 }
    }
  },
  sexual: {
    name: 'Sexual Content',
    subcategories: {
      romance: { name: 'Romance', weight: -0.5 },
      sexualNonExplicit: { name: 'Sexual (Non-Explicit)', weight: 0.6 },
      sexualExplicit: { name: 'Sexual (Explicit)', weight: 1.0 },
      sexualViolence: { name: 'Sexual Violence', weight: 1.0 }
    }
  },
  language: {
    name: 'Language',
    subcategories: {
      profanity: { name: 'Profanity', weight: 0.5 },
      humor: { name: 'Humor', weight: -0.3 }
    }
  },
  disturbing: {
    name: 'Disturbing Content',
    subcategories: {
      bodyHorror: { name: 'Body Horror', weight: 1.0 },
      substanceUse: { name: 'Substance Use', weight: 0.7 },
      mentalHealthCrises: { name: 'Mental Health Crises', weight: 0.8 },
      selfHarmSuicide: { name: 'Self-Harm/Suicide', weight: 1.0 },
      childEndangerment: { name: 'Child Endangerment', weight: 1.0 },
      discrimination: { name: 'Discrimination', weight: 0.8 },
      deathGrief: { name: 'Death/Grief', weight: 0.6 },
      crimeIllegal: { name: 'Crime/Illegal Activities', weight: 0.5 },
      psychologicalHorror: { name: 'Psychological Horror', weight: 0.9 },
      intenseSituations: { name: 'Intense Situations', weight: 0.5 }
    }
  }
};

export function initializeRatings() {
  let currentMovieId = null;
  let currentUser = null;
  let ratingsCache = new Map();

  // Debounced functions for batch operations
  const debouncedRefreshCards = debounce(() => document.dispatchEvent(new CustomEvent('refreshMovieCards')), 1000);
  const debouncedLoadSummaries = debounce(() => {
    if (window.moviesModule && window.moviesModule.loadRatingSummaries) {
      window.moviesModule.loadRatingSummaries();
    }
  }, 1000);

  // Create rating interface
  const createRatingInterface = (movieId, user) => {
    currentMovieId = movieId;
    currentUser = user;

    if (!user) {
      return `
        <div class="rating-section">
          <div class="rating-header">
            <h3>🎯 Content Ratings</h3>
            <p class="rating-subtitle">Rate this movie's content across different categories</p>
          </div>
          <div class="rating-login-prompt">
            <p>Sign in to rate this movie and see detailed content ratings</p>
            <button class="btn btn-primary" onclick="showAuthModal()">
              <span class="btn-icon">🔑</span>
              Sign In to Rate
            </button>
          </div>
        </div>
      `;
    }

    return `
      <div class="rating-section">
        <div class="rating-header">
          <h3>🎯 Content Ratings</h3>
          <p class="rating-subtitle">Rate this movie's content across different categories</p>
          <div class="overall-rating-summary" id="overallRatingSummary">
            <span class="overall-average" id="overallAverage">Loading...</span>
            <span class="overall-count" id="overallCount"></span>
          </div>
        </div>
        
        <div class="rating-categories" id="ratingCategories">
          <div class="loading-movies">
            <div class="loading-spinner"></div>
            <p>Loading rating interface...</p>
          </div>
        </div>
        
        <div class="clear-all-container">
          <button class="btn btn-outline clear-all-btn" id="clearAllRatings">
            <span class="btn-icon">🗑️</span>
            Clear All My Ratings
          </button>
        </div>
      </div>
    `;
  };

  // Load rating interface data
  const loadRatingInterface = async () => {
    if (!currentMovieId || !currentUser) return;

    try {
      // Load overall rating summary
      await loadOverallRatingSummary();
      
      // Load rating categories
      await loadRatingCategories();
    } catch (error) {
      console.error('Error loading rating interface:', error);
      const categoriesContainer = document.getElementById('ratingCategories');
      if (categoriesContainer) {
        categoriesContainer.innerHTML = `
          <div class="rating-error">
            <p>Error loading ratings. Please try again later.</p>
          </div>
        `;
      }
    }
  };

  // Load overall rating summary
  const loadOverallRatingSummary = async () => {
    try {
      const overallAverage = await getOverallAverageRating(currentMovieId);
      const uniqueRaters = await getUniqueRaterCount(currentMovieId);
      
      const averageElement = document.getElementById('overallAverage');
      const countElement = document.getElementById('overallCount');
      
      if (averageElement && countElement) {
        if (overallAverage !== null) {
          averageElement.textContent = `DreadScore: ${overallAverage}/10`;
          countElement.textContent = `(${uniqueRaters} ${uniqueRaters === 1 ? 'user' : 'users'})`;
        } else {
          averageElement.textContent = 'No ratings yet';
          countElement.textContent = '';
        }
      }
    } catch (error) {
      console.error('Error loading overall rating summary:', error);
    }
  };

  // Load rating categories
  const loadRatingCategories = async () => {
    const categoriesContainer = document.getElementById('ratingCategories');
    if (!categoriesContainer) return;

    try {
      // Batch fetch all data for this movie upfront
      const [userRatings, ratingStats] = await Promise.all([
        window.ratingsService.batchFetchUserRatings(currentMovieId),
        window.ratingsService.batchFetchRatingStats(currentMovieId)
      ]);

      const categoriesHtml = await Promise.all(
        Object.entries(RATING_CATEGORIES).map(([categoryKey, category]) =>
          createCategoryHtml(categoryKey, category, userRatings, ratingStats)
        )
      );

      categoriesContainer.innerHTML = categoriesHtml.join('');
    } catch (error) {
      console.error('Error loading rating categories:', error);
      categoriesContainer.innerHTML = `
        <div class="rating-error">
          <p>Error loading rating categories. Please try again later.</p>
        </div>
      `;
    }
  };

  // Create category HTML
  const createCategoryHtml = async (categoryKey, category, userRatings, ratingStats) => {
    const subcategoriesHtml = await Promise.all(
      Object.entries(category.subcategories).map(([subcategoryKey, subcategory]) =>
        createSubcategoryHtml(categoryKey, subcategoryKey, subcategory, userRatings, ratingStats)
      )
    );

    return `
      <div class="rating-category">
        <h4 class="category-title">${category.name}</h4>
        <div class="rating-subcategories">
          ${subcategoriesHtml.join('')}
        </div>
      </div>
    `;
  };

  // Create subcategory HTML
  const createSubcategoryHtml = async (categoryKey, subcategoryKey, subcategory, userRatings, ratingStats) => {
    try {
      // Use pre-fetched data instead of making individual calls
      const ratingKey = `${categoryKey}_${subcategoryKey}`;
      const userRating = userRatings[ratingKey] || null;
      const stats = ratingStats[ratingKey] || { averageRating: null, ratingCount: 0 };
      const averageRating = stats.averageRating;
      const ratingCount = stats.ratingCount;

      const weightClass = subcategory.weight < 0 ? 'negative-weight' : '';
      const weightText = subcategory.weight < 0 ? 
        `Reduces DreadScore (${Math.abs(subcategory.weight)}x)` : 
        `Weight: ${subcategory.weight}x`;

      return `
        <div class="rating-item">
          <div class="rating-item-header">
            <div class="rating-item-title">
              <div class="rating-label">${subcategory.name}</div>
              <div class="user-rating-display">
                ${userRating !== null ? 
                  `<span class="user-rating-value">${userRating === 0 ? 'N/A' : userRating + '/10'}</span>` : 
                  '<span class="user-rating-placeholder">Not rated</span>'
                }
              </div>
            </div>
            <div class="rating-stats">
              ${averageRating !== null ? 
                `<span class="average-rating">Avg: ${averageRating}/10</span>` : 
                '<span class="average-rating no-ratings-yet">No community ratings</span>'
              }
              <span class="rating-count">(${ratingCount})</span>
              <span class="weight-indicator ${weightClass}" title="${weightText}">
                ${subcategory.weight < 0 ? '↓' : '↑'}${Math.abs(subcategory.weight)}x
              </span>
            </div>
          </div>
          <div class="rating-controls">
            <div class="rating-input">
              <div class="rating-controls-row" style="display: flex; align-items: center; gap: 0.5rem;">
                <button class="na-btn ${userRating === 0 ? 'active' : ''}" 
                        data-rating="0" 
                        data-category="${categoryKey}" 
                        data-subcategory="${subcategoryKey}">
                  N/A
                </button>
                <div class="rating-stars">
                  ${Array.from({length: 10}, (_, i) => {
                    const starValue = i + 1;
                    const isActive = userRating !== null && userRating > 0 && userRating >= starValue;
                    return `
                      <button class="star-btn ${isActive ? 'active' : 'hollow'}" 
                              data-rating="${starValue}" 
                              data-category="${categoryKey}" 
                              data-subcategory="${subcategoryKey}">
                        ⭐
                      </button>
                    `;
                  }).join('')}
                </div>
                <button class="clear-rating-btn ${userRating !== null ? 'visible' : ''}" 
                        data-category="${categoryKey}" 
                        data-subcategory="${subcategoryKey}">
                  <span class="btn-icon">✕</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      `;
    } catch (error) {
      console.error(`Error creating subcategory HTML for ${categoryKey}/${subcategoryKey}:`, error);
      return `
        <div class="rating-item">
          <div class="rating-item-header">
            <div class="rating-label">${subcategory.name}</div>
            <div class="rating-stats">
              <span class="average-rating">Error loading</span>
            </div>
          </div>
        </div>
      `;
    }
  };

  // Create rating summary for movie cards
  const createRatingSummary = async (movieId) => {
    try {
      // Use the optimized getDreadScore method for both values
      const dreadScoreData = await window.ratingsService.getDreadScore(movieId);
      
      if (dreadScoreData && dreadScoreData.dreadScore !== null) {
        return `
          <div class="content-rating-summary">
            <span class="content-rating-label">DreadScore:</span>
            <span class="content-rating-value">${dreadScoreData.dreadScore}/10</span>
            <span class="content-rating-count">(${Math.ceil(dreadScoreData.totalRatings / 10)})</span>
            <button class="rawscore-dropdown-btn" data-movie-id="${movieId}">
              <span class="dropdown-icon">ⓘ</span>
            </button>
          </div>
        `;
      } else {
        return '<span class="no-ratings">No content ratings</span>';
      }
    } catch (error) {
      console.error('Error creating rating summary:', error);
      return '<span class="no-ratings">No content ratings</span>';
    }
  };

  // Initialize event listeners
  const initializeEventListeners = () => {
    document.addEventListener('click', (e) => {
      // Rating button clicks
      if (e.target.closest('.star-btn') || e.target.closest('.na-btn')) {
        handleRatingClick(e);
      }
      
      // Clear rating button clicks
      if (e.target.closest('.clear-rating-btn')) {
        handleClearRating(e);
      }
      
      // Clear all ratings button
      if (e.target.closest('#clearAllRatings')) {
        handleClearAllRatings();
      }
      
      // Dropdown button clicks
      if (e.target.closest('.rawscore-dropdown-btn')) {
        handleDropdownClick(e);
      }
    });

    // Close dropdown when clicking outside
    document.addEventListener('click', (e) => {
      if (!e.target.closest('.rawscore-dropdown-container')) {
        // No longer needed - using modal system instead
      }
    });

    // Listen for movie cards refresh to update button states
    document.addEventListener('refreshMovieCards', () => {
      // Refresh movie cards when ratings change
      if (window.moviesModule && window.moviesModule.displayMovies) {
        setTimeout(() => {
          window.moviesModule.displayMovies();
        }, 100);
      }
    });
  };

  // Handle rating click
  const handleRatingClick = async (e) => {
    // Check for current user from auth service
    const authUser = window.auth?.getCurrentUser();
    if (!authUser) {
      showNotification('Please sign in to rate movies', 'error');
      return;
    }

    const button = e.target.closest('.star-btn, .na-btn');
    const rating = parseInt(button.dataset.rating);
    const category = button.dataset.category;
    const subcategory = button.dataset.subcategory;

    // Update UI immediately for instant feedback
    updateRatingUI(category, subcategory, rating);
    
    try {
      // Get movie data for Supabase
      const movieData = extractMovieDataFromPage(currentMovieId);
      
      // Save rating in background
      await ratingsService.saveUserRating(currentMovieId, category, subcategory, rating, movieData);
      
      // Show success notification after save
      showNotification(rating === 0 ? 'Marked as N/A' : `Rated ${rating}/10`, 'success');
      
      // Update UI with fresh data
      await updateRatingUIAfterChange(category, subcategory);

      // Clear cache and refresh other components with debouncing
      clearRatingsCache(currentMovieId);
      debouncedRefreshCards();
      debouncedLoadSummaries();
    } catch (error) {
      console.error('Error saving rating:', error);
      // Revert UI on error
      const previousRating = await getUserRating(currentMovieId, category, subcategory);
      updateRatingUI(category, subcategory, previousRating);
      showNotification('Error saving rating. Please try again.', 'error');
    }
  };

  // Handle clear rating
  const handleClearRating = async (e) => {
    // Check for current user from auth service
    const authUser = window.auth?.getCurrentUser();
    if (!authUser) return;

    const button = e.target.closest('.clear-rating-btn');
    const category = button.dataset.category;
    const subcategory = button.dataset.subcategory;

    // Update UI immediately
    updateRatingUI(category, subcategory, null);
    
    try {
      // Clear rating in background
      await ratingsService.clearUserRating(currentMovieId, category, subcategory);
      
      showNotification('Rating cleared!', 'success');
      
      // Update UI with fresh data
      await updateRatingUIAfterChange(category, subcategory);

      clearRatingsCache(currentMovieId);
      debouncedRefreshCards();
      debouncedLoadSummaries();
    } catch (error) {
      console.error('Error clearing rating:', error);
      // Revert UI on error
      const previousRating = await getUserRating(currentMovieId, category, subcategory);
      updateRatingUI(category, subcategory, previousRating);
      showNotification('Error clearing rating. Please try again.', 'error');
    }
  };

  // Update rating UI after a change with fresh data
  const updateRatingUIAfterChange = async (category, subcategory) => {
    try {
      // Fetch fresh data for this specific rating
      const [userRatings, ratingStats] = await Promise.all([
        window.ratingsService.batchFetchUserRatings(currentMovieId),
        window.ratingsService.batchFetchRatingStats(currentMovieId)
      ]);

      // Update the specific subcategory UI
      const ratingKey = `${category}_${subcategory}`;
      const userRating = userRatings[ratingKey] || null;
      const stats = ratingStats[ratingKey] || { averageRating: null, ratingCount: 0 };

      // Update user rating display
      updateRatingUI(category, subcategory, userRating);

      // Update community rating display
      updateCommunityRatingDisplay(category, subcategory, stats.averageRating, stats.ratingCount);

      // Update overall summary
      loadOverallRatingSummary();
    } catch (error) {
      console.error('Error updating rating UI:', error);
    }
  };

  // Update community rating display for a specific subcategory
  const updateCommunityRatingDisplay = (category, subcategory, averageRating, ratingCount) => {
    try {
      const ratingItem = document.querySelector(`[data-category="${category}"][data-subcategory="${subcategory}"]`)?.closest('.rating-item');
      if (!ratingItem) return;

      const averageRatingElement = ratingItem.querySelector('.average-rating');
      const ratingCountElement = ratingItem.querySelector('.rating-count');

      if (averageRatingElement && ratingCountElement) {
        if (averageRating !== null) {
          averageRatingElement.textContent = `Avg: ${averageRating}/10`;
          averageRatingElement.classList.remove('no-ratings-yet');
        } else {
          averageRatingElement.textContent = 'No community ratings';
          averageRatingElement.classList.add('no-ratings-yet');
        }
        ratingCountElement.textContent = `(${ratingCount})`;
      }
    } catch (error) {
      console.error('Error updating community rating display:', error);
    }
  };

  // Handle clear all ratings
  const handleClearAllRatings = async () => {
    // Check for current user from auth service
    const authUser = window.auth?.getCurrentUser();
    if (!authUser) return;

    // Show confirmation modal instead of browser confirm
    showClearAllConfirmationModal();
  };

  // Show confirmation modal for clearing all ratings
  const showClearAllConfirmationModal = () => {
    // Create modal HTML
    const modalHtml = `
      <div id="clearAllModal" class="modal-overlay">
        <div class="modal">
          <div class="modal-header">
            <h3>Clear All Ratings</h3>
            <button class="modal-close" onclick="closeClearAllModal()">×</button>
          </div>
          <div class="modal-body">
            <div class="confirmation-content">
              <div class="confirmation-icon">⚠️</div>
              <h4>Are you sure?</h4>
              <p>This will permanently remove all your content ratings for this movie. This action cannot be undone.</p>
              <div class="confirmation-actions">
                <button class="btn btn-outline" onclick="closeClearAllModal()">
                  <span class="btn-icon">✕</span>
                  Cancel
                </button>
                <button class="btn btn-primary" id="confirmClearAllBtn">
                  <span class="btn-icon">🗑️</span>
                  Clear All Ratings
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    // Add modal to page
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    
    // Show modal
    const modal = document.getElementById('clearAllModal');
    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
    
    // Add event listener for confirm button
    document.getElementById('confirmClearAllBtn').addEventListener('click', confirmClearAllRatings);
  };

  // Close confirmation modal
  const closeClearAllModal = () => {
    const modal = document.getElementById('clearAllModal');
    if (modal) {
      modal.style.display = 'none';
      document.body.style.overflow = 'auto';
      modal.remove();
    }
  };

  // Make closeClearAllModal globally available
  window.closeClearAllModal = closeClearAllModal;

  // Confirm clear all ratings
  const confirmClearAllRatings = async () => {
    const confirmBtn = document.getElementById('confirmClearAllBtn');
    
    // Disable button and show loading
    confirmBtn.disabled = true;
    const originalText = confirmBtn.innerHTML;
    confirmBtn.innerHTML = '<div class="loading-spinner-small"></div>Clearing...';
    try {
      const clearedCount = await ratingsService.clearAllUserRatings(currentMovieId);
      
      // Close modal
      closeClearAllModal();
      
      // Reload the entire rating interface
      await loadRatingInterface();
      
      // Update all community ratings since we cleared everything
      await loadRatingCategories();
      
      // Clear cache
      clearRatingsCache(currentMovieId);
      
      // Refresh movie cards to show updated DreadScore
      document.dispatchEvent(new CustomEvent('refreshMovieCards'));
      
      // Also refresh rating summaries specifically
      if (window.moviesModule && window.moviesModule.loadRatingSummaries) {
        setTimeout(() => {
          window.moviesModule.loadRatingSummaries();
        }, 200);
      }
      
      showNotification(`Cleared ${clearedCount} ratings!`, 'success');
      
      // Refresh account data if available
      if (window.auth && window.auth.refreshAccountData) {
        await window.auth.refreshAccountData();
      }
    } catch (error) {
      console.error('Error clearing all ratings:', error);
      showNotification('Error clearing ratings. Please try again.', 'error');
      
      // Re-enable button
      confirmBtn.disabled = false;
      confirmBtn.innerHTML = originalText;
    }
  };

  // Update community rating for a specific subcategory
  const updateCommunityRating = async (category, subcategory) => {
    try {
      // Find the rating item for this category/subcategory
      const ratingItem = document.querySelector(`[data-category="${category}"][data-subcategory="${subcategory}"]`)?.closest('.rating-item');
      if (!ratingItem) return;

      const [averageRating, ratingCount] = await Promise.all([
        getAverageRating(currentMovieId, category, subcategory),
        getRatingCount(currentMovieId, category, subcategory)
      ]);

      // Update the community rating display
      const averageRatingElement = ratingItem.querySelector('.average-rating');
      const ratingCountElement = ratingItem.querySelector('.rating-count');

      if (averageRatingElement && ratingCountElement) {
        if (averageRating !== null) {
          averageRatingElement.textContent = `Avg: ${averageRating}/10`;
          averageRatingElement.classList.remove('no-ratings-yet');
        } else {
          averageRatingElement.textContent = 'No community ratings';
          averageRatingElement.classList.add('no-ratings-yet');
        }
        ratingCountElement.textContent = `(${ratingCount})`;
      }
    } catch (error) {
      console.error('Error updating community rating:', error);
    }
  };

  // Update rating UI
  const updateRatingUI = (category, subcategory, rating) => {
    const ratingItem = document.querySelector(`[data-category="${category}"][data-subcategory="${subcategory}"]`).closest('.rating-item');
    if (!ratingItem) return;
    
    // Update star buttons
    const starButtons = ratingItem.querySelectorAll('.star-btn');
    const naButton = ratingItem.querySelector('.na-btn');
    const clearButton = ratingItem.querySelector('.clear-rating-btn');
    const userRatingDisplay = ratingItem.querySelector('.user-rating-display');
    
    // Reset all buttons
    starButtons.forEach(btn => {
      btn.classList.remove('active');
      btn.classList.remove('hollow');
    });
    naButton.classList.remove('active');
    
    // Update user rating display
    if (userRatingDisplay) {
      if (rating === 0) {
        userRatingDisplay.innerHTML = '<span class="user-rating-value">N/A</span>';
        naButton.classList.add('active');
        // Make all stars hollow when rating is N/A
        starButtons.forEach(btn => {
          btn.classList.add('hollow');
        });
        clearButton.classList.add('visible');
      } else if (rating !== null && rating > 0) {
        userRatingDisplay.innerHTML = `<span class="user-rating-value">${rating}/10</span>`;
        starButtons.forEach((btn, index) => {
          const starValue = index + 1;
          if (starValue <= rating) {
            btn.classList.add('active');
          } else {
            btn.classList.add('hollow');
          }
        });
        clearButton.classList.add('visible');
      } else {
        userRatingDisplay.innerHTML = '<span class="user-rating-placeholder">Not rated</span>';
        // No rating - make all stars hollow
        starButtons.forEach(btn => {
          btn.classList.add('hollow');
        });
        clearButton.classList.remove('visible');
      }
    }
  };

  // Handle dropdown click
  const handleDropdownClick = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    // Prevent double-opening by checking if modal already exists
    if (document.getElementById('detailedRatingsOverlay')) {
      return;
    }
    
    const button = e.target.closest('.rawscore-dropdown-btn');
    const movieId = parseInt(button.dataset.movieId);
    
    // Show detailed ratings modal instead of dropdown
    await showDetailedRatingsModal(movieId);
  };

  // Show detailed ratings modal
  const showDetailedRatingsModal = async (movieId) => {
    // Check if modal already exists and remove it first
    const existingModal = document.getElementById('detailedRatingsOverlay');
    if (existingModal) {
      existingModal.remove();
    }
    
    try {
      const modalHtml = await createDetailedRatingsModalContent(movieId);
      
      // Create modal overlay
      const overlay = document.createElement('div');
      overlay.className = 'modal-overlay';
      overlay.id = 'detailedRatingsOverlay';
      overlay.style.display = 'flex';
      overlay.innerHTML = modalHtml;
      
      document.body.appendChild(overlay);
      document.body.style.overflow = 'hidden';
      
      // Add event listeners for modal
      setupDetailedRatingsModalListeners(overlay);
      
    } catch (error) {
      console.error('Error showing detailed ratings modal:', error);
    }
  };

  // Setup modal event listeners
  const setupDetailedRatingsModalListeners = (overlay) => {
    // Close on overlay click
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        closeDetailedRatingsModal();
      }
    });
    
    // Close on close button click
    const closeBtn = overlay.querySelector('.modal-close');
    if (closeBtn) {
      closeBtn.addEventListener('click', closeDetailedRatingsModal);
    }
    
    // Close on escape key
    const escapeHandler = (e) => {
      if (e.key === 'Escape') {
        closeDetailedRatingsModal();
        document.removeEventListener('keydown', escapeHandler);
      }
    };
    document.addEventListener('keydown', escapeHandler);
  };

  // Close detailed ratings modal
  const closeDetailedRatingsModal = () => {
    const overlay = document.getElementById('detailedRatingsOverlay');
    if (overlay) {
      document.body.removeChild(overlay);
      document.body.style.overflow = 'auto';
    }
  };

  // Create detailed ratings modal content
  const createDetailedRatingsModalContent = async (movieId) => {
    try {
      const categoriesHtml = await Promise.all(
        Object.entries(RATING_CATEGORIES).map(async ([categoryKey, category]) => {
          const subcategoriesHtml = await Promise.all(
            Object.entries(category.subcategories).map(async ([subcategoryKey, subcategory]) => {
              const [averageRating, ratingCount] = await Promise.all([
                getAverageRating(movieId, categoryKey, subcategoryKey),
                getRatingCount(movieId, categoryKey, subcategoryKey)
              ]);

              return `
                <div class="detailed-subcategory">
                  <div class="detailed-subcategory-info">
                    <div class="detailed-subcategory-name">${subcategory.name}</div>
                    <div class="detailed-subcategory-weight ${subcategory.weight < 0 ? 'negative' : ''}">
                      Weight: ${subcategory.weight}x
                    </div>
                  </div>
                  <div class="detailed-subcategory-rating">
                    ${averageRating !== null ? 
                      `<div class="detailed-rating-value">${averageRating}/10</div>` : 
                      '<div class="detailed-no-rating">No ratings</div>'
                    }
                    <div class="detailed-rating-count">${ratingCount} ratings</div>
                  </div>
                </div>
              `;
            })
          );

          return `
            <div class="detailed-category">
              <div class="detailed-category-title">${category.name}</div>
              <div class="detailed-subcategories">
                ${subcategoriesHtml.join('')}
              </div>
            </div>
          `;
        })
      );

      return `
        <div class="detailed-ratings-modal">
          <div class="detailed-ratings-header">
            <h3>Detailed Content Ratings</h3>
            <p class="detailed-ratings-subtitle">Community ratings breakdown by category</p>
            <button class="modal-close">×</button>
          </div>
          <div class="detailed-ratings-content">
            <div class="detailed-ratings-categories">
              ${categoriesHtml.length > 0 ? categoriesHtml.join('') : '<p class="no-detailed-ratings-message">No ratings available for this movie</p>'}
            </div>
          </div>
        </div>
      `;
    } catch (error) {
      console.error('Error creating detailed ratings modal content:', error);
      return `
        <div class="detailed-ratings-modal">
          <div class="detailed-ratings-header">
            <h3>Detailed Content Ratings</h3>
            <p class="detailed-ratings-subtitle">Community ratings breakdown by category</p>
            <button class="modal-close">×</button>
          </div>
          <div class="detailed-ratings-content">
            <p class="no-detailed-ratings-message">Error loading ratings. Please try again.</p>
          </div>
        </div>
      `;
    }
  };

  // Extract movie data from page
  const extractMovieDataFromPage = (movieId) => {
    const title = document.querySelector('.movie-title')?.textContent || 
                  document.querySelector('h1')?.textContent ||
                  'Unknown Title';
    const poster = document.querySelector('.movie-poster-large img')?.src || 
                   document.querySelector('.movie-poster img')?.src || '';
    const overview = document.querySelector('.movie-overview')?.textContent || '';
    
    return {
      id: parseInt(movieId),
      title: title,
      poster_path: poster.includes('image.tmdb.org') ? poster.split('/').pop() : null,
      overview: overview
    };
  };

  // API wrapper functions with error handling
  const getUserRating = async (movieId, category, subcategory) => {
    try {
      return await ratingsService.getUserRating(movieId, category, subcategory);
    } catch (error) {
      console.error('Error getting user rating:', error);
      return null;
    }
  };

  const getAverageRating = async (movieId, category, subcategory) => {
    try {
      const cacheKey = `avg_${movieId}_${category}_${subcategory}`;
      if (ratingsCache.has(cacheKey)) {
        return ratingsCache.get(cacheKey);
      }
      
      const result = await ratingsService.getAverageRating(movieId, category, subcategory);
      ratingsCache.set(cacheKey, result);
      return result;
    } catch (error) {
      console.error('Error getting average rating:', error);
      return null;
    }
  };

  const getRatingCount = async (movieId, category, subcategory) => {
    try {
      const cacheKey = `count_${movieId}_${category}_${subcategory}`;
      if (ratingsCache.has(cacheKey)) {
        return ratingsCache.get(cacheKey);
      }
      
      const result = await ratingsService.getRatingCount(movieId, category, subcategory);
      ratingsCache.set(cacheKey, result);
      return result;
    } catch (error) {
      console.error('Error getting rating count:', error);
      return 0;
    }
  };

  const getOverallAverageRating = async (movieId) => {
    try {
      const cacheKey = `overall_${movieId}`;
      if (ratingsCache.has(cacheKey)) {
        return ratingsCache.get(cacheKey);
      }
      
      const result = await ratingsService.getOverallAverageRating(movieId);
      ratingsCache.set(cacheKey, result);
      return result;
    } catch (error) {
      console.error('Error getting overall average rating:', error);
      return null;
    }
  };

  const getUniqueRaterCount = async (movieId) => {
    try {
      const cacheKey = `raters_${movieId}`;
      if (ratingsCache.has(cacheKey)) {
        return ratingsCache.get(cacheKey);
      }
      
      const result = await ratingsService.getUniqueRaterCount(movieId);
      ratingsCache.set(cacheKey, result);
      return result;
    } catch (error) {
      console.error('Error getting unique rater count:', error);
      return 0;
    }
  };

  const getMoviesRatedCount = async () => {
    try {
      return await ratingsService.getMoviesRatedCount();
    } catch (error) {
      console.error('Error getting movies rated count:', error);
      return 0;
    }
  };

  // Clear ratings cache
  const clearRatingsCache = (movieId) => {
    const keysToDelete = [];
    for (const key of ratingsCache.keys()) {
      if (key.includes(`_${movieId}_`) || key.includes(`${movieId}`)) {
        keysToDelete.push(key);
      }
    }
    keysToDelete.forEach(key => ratingsCache.delete(key));
  };

  // Initialize event listeners
  initializeEventListeners();

  // Make closeDetailedRatingsModal globally available
  window.closeDetailedRatingsModal = closeDetailedRatingsModal;

  // Public API
  return {
    createRatingInterface: (movieId, user) => {
      const html = createRatingInterface(movieId, user);
      if (user) {
        // Load interface data after a short delay
        setTimeout(loadRatingInterface, 100);
      }
      return html;
    },
    createRatingSummary,
    initializeEventListeners,
    getUserRating,
    getAverageRating,
    getRatingCount,
    getOverallAverageRating,
    getUniqueRaterCount,
    getMoviesRatedCount,
    RATING_CATEGORIES
  };
}