import { watchlistService } from './lib/watchlist-supabase.js';
import { showNotification } from './utils/notifications.js';
import { addSentryBreadcrumb, captureError, withSentryApiTracking } from './utils/sentry.js';

export function initializeWatchlist() {
  // Parse IMDb watchlist from CSV/text
  const parseImdbWatchlist = (text) => {
    const lines = text.split('\n');
    const movies = [];
    
    // Skip header line if it exists
    const startIndex = lines[0].toLowerCase().includes('title') ? 1 : 0;
    
    for (let i = startIndex; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      
      // Handle CSV format
      if (line.includes(',')) {
        const parts = line.split(',').map(part => part.trim().replace(/"/g, ''));
        if (parts.length >= 2) {
          movies.push({
            title: parts[0] || parts[1], // Title might be in different columns
            year: extractYear(parts.join(' ')),
            imdbId: extractImdbId(parts.join(' '))
          });
        }
      } else {
        // Handle plain text format
        movies.push({
          title: line,
          year: extractYear(line),
          imdbId: extractImdbId(line)
        });
      }
    }
    
    return movies.filter(movie => movie.title && movie.title.length > 1);
  };

  // Read CSV file
  const readCSVFile = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const text = e.target.result;
          const parsedMovies = parseImdbWatchlist(text);
          resolve(parsedMovies);
        } catch (error) {
          reject(error);
        }
      };
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsText(file);
    });
  };

  // Extract year from text
  const extractYear = (text) => {
    const yearMatch = text.match(/\((\d{4})\)/);
    return yearMatch ? yearMatch[1] : null;
  };

  // Extract IMDb ID from text
  const extractImdbId = (text) => {
    const imdbMatch = text.match(/tt\d+/);
    return imdbMatch ? imdbMatch[0] : null;
  };

  // Search for movie using TMDB API
  const searchMovieByTitle = async (title, year = null) => {
    try {
      const TMDB_API_KEY = import.meta.env.VITE_TMDB_API_KEY;
      const TMDB_BASE_URL = 'https://api.themoviedb.org/3';
      
      const response = await withSentryApiTracking(
        () => fetch(`${TMDB_BASE_URL}/search/movie?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(title)}&year=${year || ''}`),
        'tmdb_watchlist_search'
      )();
      const data = await response.json();
      
      if (data.results && data.results.length > 0) {
        return data.results[0]; // Return the first match
      }
      return null;
    } catch (error) {
      captureError(error, {
        tags: { type: 'watchlist_search_error' },
        extra: { title, year }
      });
      return null;
    }
  };

  // Import watchlist from parsed data
  const importWatchlist = async (parsedMovies, onProgress = null) => {
    addSentryBreadcrumb('Watchlist import started', 'user_action', 'info', {
      movieCount: parsedMovies.length
    });
    
    const importedMovies = [];
    const failedMovies = [];
    let successfullyAdded = 0;
    
    for (let i = 0; i < parsedMovies.length; i++) {
      const parsedMovie = parsedMovies[i];
      
      if (onProgress) {
        onProgress(i + 1, parsedMovies.length, parsedMovie.title);
      }
      
      try {
        const foundMovie = await searchMovieByTitle(parsedMovie.title, parsedMovie.year);
        
        if (foundMovie) {
          const wasAdded = await watchlistService.addToWatchlist(foundMovie);
          if (wasAdded) {
            importedMovies.push(foundMovie);
            successfullyAdded++;
          }
        } else {
          failedMovies.push(parsedMovie);
        }
        
        // Add small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (error) {
        captureError(error, {
          tags: { type: 'watchlist_import_error' },
          extra: { movieTitle: parsedMovie.title }
        });
        failedMovies.push(parsedMovie);
      }
    }
    
    addSentryBreadcrumb('Watchlist import completed', 'user_action', 'info', {
      successfullyAdded,
      totalProcessed: parsedMovies.length,
      failedCount: failedMovies.length
    });
    
    return { 
      importedMovies, 
      failedMovies, 
      successfullyAdded,
      totalProcessed: parsedMovies.length,
      duplicatesSkipped: importedMovies.length - successfullyAdded
    };
  };

  // Create watchlist button for movie cards/modals
  const createWatchlistButton = (movieId, currentUser) => {
    if (!currentUser) {
      return `
        <button class="btn btn-outline watchlist-btn" onclick="showAuthModal()">
          <span class="btn-icon">📋</span>
          Add to Watchlist
        </button>
      `;
    }
    
    // Button will be updated asynchronously
    return `
      <button class="btn btn-outline watchlist-btn" 
              data-movie-id="${movieId}" 
              data-in-watchlist="false">
        <span class="btn-icon">📋</span>
        Add to Watchlist
      </button>
    `;
  };

  // Update watchlist button state
  const updateWatchlistButton = async (movieId, isMovieInWatchlist = null) => {
    try {
      const button = document.querySelector(`[data-movie-id="${movieId}"].watchlist-btn`);
      if (!button) return;

      // Use provided status or fetch from database
      const inWatchlist = isMovieInWatchlist !== null ? 
        isMovieInWatchlist : 
        await watchlistService.isInWatchlist(movieId);
      
      button.dataset.inWatchlist = inWatchlist.toString();
      button.className = `btn ${inWatchlist ? 'btn-secondary' : 'btn-outline'} watchlist-btn`;
      button.innerHTML = `
        <span class="btn-icon">${inWatchlist ? '✓' : '📋'}</span>
        ${inWatchlist ? 'In Watchlist' : 'Add to Watchlist'}
      `;
    } catch (error) {
      console.error('Error updating watchlist button:', error);
    }
  };

  // Create watchlist management interface
  const createWatchlistInterface = (currentUser) => {
    if (!currentUser) {
      return `
        <div class="watchlist-section">
          <div class="watchlist-header">
            <h3>My Watchlist</h3>
            <p class="watchlist-subtitle">Sign in to manage your personal movie watchlist</p>
          </div>
          <div class="watchlist-login-prompt">
            <button class="btn btn-primary" onclick="showAuthModal()">
              <span class="btn-icon">🔑</span>
              Sign In to Access Watchlist
            </button>
          </div>
        </div>
      `;
    }

    // Interface will be populated asynchronously
    return `
      <div class="watchlist-section">
        <div class="watchlist-header">
          <h3>My Watchlist</h3>
          <p class="watchlist-subtitle">Manage your personal movie collection</p>
          <div class="watchlist-stats">
            <span class="watchlist-count" id="watchlistCount">Loading...</span>
          </div>
        </div>
        
        <div class="watchlist-actions">
          <button class="btn btn-primary" id="importWatchlistBtn">
            <span class="btn-icon">📥</span>
            Import Watchlist
          </button>
          <button class="btn btn-outline" id="exportWatchlistBtn">
            <span class="btn-icon">📤</span>
            Export Watchlist
          </button>
        </div>
        
        <div class="watchlist-grid" id="watchlistGrid">
          <div class="loading-movies">
            <div class="loading-spinner"></div>
            <p>Loading your watchlist...</p>
          </div>
        </div>
      </div>
    `;
  };

  // Load watchlist data asynchronously
  const loadWatchlistData = async () => {
    try {
      const [watchlist, count] = await Promise.all([
        watchlistService.getUserWatchlist(),
        watchlistService.getUserWatchlistCount()
      ]);

      // Update count
      const countElement = document.getElementById('watchlistCount');
      if (countElement) {
        countElement.textContent = `${count} movies`;
      }

      // Update grid
      const gridElement = document.getElementById('watchlistGrid');
      if (gridElement) {
        gridElement.innerHTML = watchlist.length > 0 ? renderWatchlistMovies(watchlist) : renderEmptyWatchlist();
      }
    } catch (error) {
      console.error('Error loading watchlist data:', error);
      const gridElement = document.getElementById('watchlistGrid');
      if (gridElement) {
        gridElement.innerHTML = `
          <div class="empty-watchlist">
            <div class="empty-watchlist-icon">⚠️</div>
            <h4>Error loading watchlist</h4>
            <p>Please try again later.</p>
          </div>
        `;
      }
    }
  };

  // Render watchlist movies
  const renderWatchlistMovies = (movies) => {
    console.log('Rendering watchlist movies:', movies); // Debug log
    
    return movies.map(movie => `
      <div class="watchlist-item" data-movie-id="${movie.id}">
        <div class="watchlist-poster">
          <img src="${getImageUrl(movie.poster_path)}" alt="${movie.title}" loading="lazy" onerror="this.src='https://images.pexels.com/photos/7991579/pexels-photo-7991579.jpeg?auto=compress&cs=tinysrgb&w=500'">
          <div class="watchlist-overlay">
            <button class="btn btn-primary watchlist-details-btn" data-movie-id="${movie.id}">
              <span class="btn-icon">👁️</span>
              View Details
            </button>
          </div>
        </div>
        <div class="watchlist-info">
          <h4 class="watchlist-title">${movie.title}</h4>
          <div class="watchlist-meta">
            <span class="watchlist-year">${getYear(movie.release_date)}</span>
            <span class="watchlist-rating">⭐ ${movie.vote_average ? movie.vote_average.toFixed(1) : 'N/A'}</span>
          </div>
          <p class="watchlist-added">Added ${formatDate(movie.addedAt)}</p>
          <button class="btn btn-outline btn-small remove-from-watchlist" data-movie-id="${movie.id}">
            <span class="btn-icon">🗑️</span>
            Remove
          </button>
        </div>
      </div>
    `).join('');
  };

  // Render empty watchlist state
  const renderEmptyWatchlist = () => {
    return `
      <div class="empty-watchlist">
        <div class="empty-watchlist-icon">📋</div>
        <h4>Your watchlist is empty</h4>
        <p>Start adding movies to keep track of what you want to watch!</p>
      </div>
    `;
  };

  // Create import modal
  const createImportModal = () => {
    return `
      <div id="importModal" class="modal-overlay">
        <div class="import-modal">
          <div class="modal-header">
            <h2>Import Watchlist</h2>
            <button class="modal-close" onclick="closeImportModal()">×</button>
          </div>
          <div class="modal-body">
            <div class="import-instructions">
              <h3>How to import your watchlist:</h3>
              <div class="import-steps">
                <div class="import-step">
                  <strong>From IMDb:</strong>
                  <ol>
                    <li>Go to your IMDb watchlist</li>
                    <li>Click "Export" to download CSV file</li>
                    <li>Upload the CSV file below or copy/paste the content</li>
                  </ol>
                </div>
                <div class="import-step">
                  <strong>Supported formats:</strong>
                  <ul>
                    <li>CSV files from IMDb, Letterboxd, etc.</li>
                    <li>Plain text (one movie per line)</li>
                    <li>Movie titles with years: "Movie Title (2023)"</li>
                  </ul>
                </div>
              </div>
            </div>
            
            <div class="import-form">
              <div class="import-tabs">
                <button class="import-tab active" id="uploadTab">Upload File</button>
                <button class="import-tab" id="pasteTab">Paste Text</button>
              </div>
              
              <div class="import-content">
                <div class="import-method" id="uploadMethod">
                  <div class="file-upload-area" id="fileUploadArea">
                    <div class="file-upload-icon">📁</div>
                    <h4>Drop your CSV file here</h4>
                    <p>or click to browse</p>
                    <input type="file" id="csvFileInput" accept=".csv,.txt" style="display: none;">
                  </div>
                  <div class="file-info" id="fileInfo" style="display: none;">
                    <div class="file-details">
                      <span class="file-name" id="fileName"></span>
                      <span class="file-size" id="fileSize"></span>
                    </div>
                    <button class="btn btn-outline btn-small" id="removeFileBtn">Remove</button>
                  </div>
                </div>
                
                <div class="import-method" id="pasteMethod" style="display: none;">
                  <div class="form-group">
                    <label for="importText">Paste your watchlist data:</label>
                    <textarea id="importText" rows="10" placeholder="Paste your movie list here...
Example:
The Shawshank Redemption (1994)
The Godfather (1972)
Pulp Fiction (1994)"></textarea>
                  </div>
                </div>
              </div>
              
              <div class="import-actions">
                <button class="btn btn-primary" id="startImportBtn">
                  <span class="btn-icon">📥</span>
                  Start Import
                </button>
                <button class="btn btn-secondary" onclick="closeImportModal()">Cancel</button>
              </div>
            </div>
            
            <div class="import-progress" id="importProgress" style="display: none;">
              <h3>Importing movies...</h3>
              <div class="progress-bar">
                <div class="progress-fill" id="progressFill"></div>
              </div>
              <p class="progress-text" id="progressText">Searching for movies...</p>
            </div>
            
            <div class="import-results" id="importResults" style="display: none;">
              <h3>Import Complete!</h3>
              <div class="import-summary">
                <div class="import-stat">
                  <span class="import-stat-number" id="importedCount">0</span>
                  <span class="import-stat-label">Movies Added</span>
                </div>
                <div class="import-stat">
                  <span class="import-stat-number" id="failedCount">0</span>
                  <span class="import-stat-label">Not Found</span>
                </div>
                <div class="import-stat">
                  <span class="import-stat-number" id="duplicatesCount">0</span>
                  <span class="import-stat-label">Already in List</span>
                </div>
              </div>
              <div class="import-actions">
                <button class="btn btn-primary" onclick="closeImportModal(); location.reload();">
                  <span class="btn-icon">✓</span>
                  Done
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  };

  // Initialize event listeners
  const initializeEventListeners = () => {
    // Watchlist button clicks
    document.addEventListener('click', (e) => {
      if (e.target.closest('.watchlist-btn')) {
        handleWatchlistButtonClick(e);
      }
      
      if (e.target.closest('.remove-from-watchlist')) {
        handleRemoveFromWatchlist(e);
      }
      
      if (e.target.closest('#importWatchlistBtn')) {
        showImportModal();
      }
      
      if (e.target.closest('#exportWatchlistBtn')) {
        handleExportWatchlist();
      }
      
      if (e.target.closest('#startImportBtn')) {
        handleStartImport();
      }
      
      if (e.target.closest('.watchlist-details-btn')) {
        handleWatchlistDetailsClick(e);
      }
      
      // Import modal tabs
      if (e.target.closest('#uploadTab')) {
        switchToUploadTab();
      }
      
      if (e.target.closest('#pasteTab')) {
        switchToPasteTab();
      }
      
      // File upload area click
      if (e.target.closest('#fileUploadArea')) {
        document.getElementById('csvFileInput').click();
      }
      
      // Remove file button
      if (e.target.closest('#removeFileBtn')) {
        removeSelectedFile();
      }
    });
    
    // File input change
    document.addEventListener('change', (e) => {
      if (e.target.id === 'csvFileInput') {
        handleFileSelect(e);
      }
    });

    // Drag and drop for file upload
    document.addEventListener('dragover', (e) => {
      if (e.target.closest('#fileUploadArea')) {
        e.preventDefault();
        e.target.closest('#fileUploadArea').classList.add('drag-over');
      }
    });

    document.addEventListener('dragleave', (e) => {
      if (e.target.closest('#fileUploadArea')) {
        e.target.closest('#fileUploadArea').classList.remove('drag-over');
      }
    });

    document.addEventListener('drop', (e) => {
      if (e.target.closest('#fileUploadArea')) {
        e.preventDefault();
        e.target.closest('#fileUploadArea').classList.remove('drag-over');
        
        const files = e.dataTransfer.files;
        if (files.length > 0) {
          handleFileSelect({ target: { files } });
        }
      }
    });
  };

  // Switch to upload tab
  const switchToUploadTab = () => {
    document.getElementById('uploadTab').classList.add('active');
    document.getElementById('pasteTab').classList.remove('active');
    document.getElementById('uploadMethod').style.display = 'block';
    document.getElementById('pasteMethod').style.display = 'none';
  };

  // Switch to paste tab
  const switchToPasteTab = () => {
    document.getElementById('pasteTab').classList.add('active');
    document.getElementById('uploadTab').classList.remove('active');
    document.getElementById('pasteMethod').style.display = 'block';
    document.getElementById('uploadMethod').style.display = 'none';
  };

  // Handle file selection
  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Validate file type
    const validTypes = ['text/csv', 'text/plain', 'application/csv'];
    const validExtensions = ['.csv', '.txt'];
    const isValidType = validTypes.includes(file.type) || 
                       validExtensions.some(ext => file.name.toLowerCase().endsWith(ext));

    if (!isValidType) {
      showNotification('Please select a CSV or text file', 'error');
      return;
    }

    // Show file info
    document.getElementById('fileUploadArea').style.display = 'none';
    document.getElementById('fileInfo').style.display = 'flex';
    document.getElementById('fileName').textContent = file.name;
    document.getElementById('fileSize').textContent = formatFileSize(file.size);

    // Store file for later processing
    window.selectedFile = file;
  };

  // Remove selected file
  const removeSelectedFile = () => {
    document.getElementById('fileUploadArea').style.display = 'block';
    document.getElementById('fileInfo').style.display = 'none';
    document.getElementById('csvFileInput').value = '';
    window.selectedFile = null;
  };

  // Format file size
  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // Handle watchlist button click
  const handleWatchlistButtonClick = async (e) => {
    const button = e.target.closest('.watchlist-btn');
    const movieId = parseInt(button.dataset.movieId);
    const inWatchlist = button.dataset.inWatchlist === 'true';
    
    const currentUser = window.auth?.getCurrentUser();
    if (!currentUser) {
      showNotification('Please sign in to manage your watchlist', 'error');
      return;
    }
    
    // Disable button during operation
    button.disabled = true;
    const originalText = button.innerHTML;
    button.innerHTML = '<div class="loading-spinner-small"></div>Loading...';
    
    try {
      if (inWatchlist) {
        // Remove from watchlist
        await watchlistService.removeFromWatchlist(movieId);
        button.innerHTML = `
          <span class="btn-icon">📋</span>
          Add to Watchlist
        `;
        button.classList.remove('btn-secondary');
        button.classList.add('btn-outline');
        button.dataset.inWatchlist = 'false';
        showNotification('Removed from watchlist', 'success');
      } else {
        // Add to watchlist - need to get movie data
        const movieData = extractMovieDataFromCard(button, movieId);
        if (movieData) {
          await watchlistService.addToWatchlist(movieData);
          button.innerHTML = `
            <span class="btn-icon">✓</span>
            In Watchlist
          `;
          button.classList.remove('btn-outline');
          button.classList.add('btn-secondary');
          button.dataset.inWatchlist = 'true';
          showNotification('Added to watchlist', 'success');
        }
      }
    } catch (error) {
      console.error('Error updating watchlist:', error);
      showNotification('Error updating watchlist. Please try again.', 'error');
      button.innerHTML = originalText;
    } finally {
      button.disabled = false;
    }
  };

  // Extract movie data from card/modal/page
  const extractMovieDataFromCard = (element, movieId) => {
    const movieCard = element.closest('.movie-card') || element.closest('.movie-modal') || element.closest('.movie-page');
    if (!movieCard) return null;

    const title = movieCard.querySelector('.movie-title')?.textContent || 
                  movieCard.querySelector('h1')?.textContent ||
                  movieCard.querySelector('h2')?.textContent || 'Unknown Title';
    const poster = movieCard.querySelector('.movie-poster img')?.src || 
                   movieCard.querySelector('.movie-poster-large img')?.src || '';
    const year = movieCard.querySelector('.movie-year')?.textContent || '';
    const rating = movieCard.querySelector('.movie-rating')?.textContent?.match(/[\d.]+/)?.[0] || 0;
    const overview = movieCard.querySelector('.movie-overview p')?.textContent || 
                     movieCard.querySelector('.movie-overview')?.textContent || '';
    
    return {
      id: movieId,
      title: title,
      poster_path: poster.includes('image.tmdb.org') ? poster.split('/').pop() : null,
      release_date: year ? `${year}-01-01` : '',
      vote_average: parseFloat(rating),
      overview: overview
    };
  };

  // Handle remove from watchlist
  const handleRemoveFromWatchlist = async (e) => {
    const button = e.target.closest('.remove-from-watchlist');
    const movieId = parseInt(button.dataset.movieId);
    
    // Disable button during operation
    button.disabled = true;
    const originalText = button.innerHTML;
    button.innerHTML = '<div class="loading-spinner-small"></div>Removing...';
    
    try {
      await watchlistService.removeFromWatchlist(movieId);
      
      // Remove the item from the grid
      const watchlistItem = button.closest('.watchlist-item');
      watchlistItem.remove();
      
      // Reload watchlist data to update count and check if empty
      await loadWatchlistData();
      
      showNotification('Removed from watchlist', 'success');
    } catch (error) {
      console.error('Error removing from watchlist:', error);
      showNotification('Error removing from watchlist. Please try again.', 'error');
      button.innerHTML = originalText;
      button.disabled = false;
    }
  };

  // Show import modal
  const showImportModal = () => {
    // Add modal to page if it doesn't exist
    if (!document.getElementById('importModal')) {
      document.body.insertAdjacentHTML('beforeend', createImportModal());
    }
    
    const modal = document.getElementById('importModal');
    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
    
    // Reset to upload tab
    switchToUploadTab();
    removeSelectedFile();
  };

  // Close import modal
  const closeImportModal = () => {
    const modal = document.getElementById('importModal');
    if (modal) {
      modal.style.display = 'none';
      document.body.style.overflow = 'auto';
      // Clean up
      removeSelectedFile();
      window.selectedFile = null;
    }
  };

  // Make closeImportModal globally available
  window.closeImportModal = closeImportModal;

  // Handle start import
  const handleStartImport = async () => {
    const currentUser = window.auth?.getCurrentUser();
    if (!currentUser) return;

    let parsedMovies = [];

    // Check if we're using file upload or text paste
    const uploadTabActive = document.getElementById('uploadTab').classList.contains('active');
    
    if (uploadTabActive) {
      // File upload method
      if (!window.selectedFile) {
        showNotification('Please select a file to import', 'error');
        return;
      }

      try {
        parsedMovies = await readCSVFile(window.selectedFile);
      } catch (error) {
        showNotification('Error reading file: ' + error.message, 'error');
        return;
      }
    } else {
      // Text paste method
      const importText = document.getElementById('importText').value.trim();
      if (!importText) {
        showNotification('Please paste your watchlist data', 'error');
        return;
      }
      parsedMovies = parseImdbWatchlist(importText);
    }

    if (parsedMovies.length === 0) {
      showNotification('No movies found in the provided data', 'error');
      return;
    }
    
    // Show progress
    document.querySelector('.import-form').style.display = 'none';
    document.getElementById('importProgress').style.display = 'block';
    
    // Import movies with progress updates
    const result = await importWatchlist(parsedMovies, (current, total, title) => {
      const progress = (current / total) * 100;
      document.getElementById('progressFill').style.width = `${progress}%`;
      document.getElementById('progressText').textContent = `Searching for "${title}" (${current}/${total})`;
    });
    
    // Show results with correct counts
    document.getElementById('importProgress').style.display = 'none';
    document.getElementById('importResults').style.display = 'block';
    
    // Use the correct count of successfully added movies
    document.getElementById('importedCount').textContent = result.successfullyAdded;
    document.getElementById('failedCount').textContent = result.failedMovies.length;
    
    // Add duplicates count if there's a duplicates element
    const duplicatesElement = document.getElementById('duplicatesCount');
    if (duplicatesElement) {
      duplicatesElement.textContent = result.duplicatesSkipped || 0;
    }
    
    // Show notification with summary
    const message = `Import complete! Added ${result.successfullyAdded} new movies${result.duplicatesSkipped > 0 ? `, skipped ${result.duplicatesSkipped} duplicates` : ''}`;
    showNotification(message, 'success');
  };

  // Handle export watchlist
  const handleExportWatchlist = async () => {
    try {
      const watchlist = await watchlistService.getUserWatchlist();
      
      if (watchlist.length === 0) {
        showNotification('Your watchlist is empty', 'info');
        return;
      }
      
      // Create CSV content
      const csvContent = [
        'Title,Year,Rating,Added Date',
        ...watchlist.map(movie => {
          const year = getYear(movie.release_date);
          const rating = movie.vote_average || 'N/A';
          const addedDate = new Date(movie.addedAt).toLocaleDateString();
          return `"${movie.title}","${year}","${rating}","${addedDate}"`;
        })
      ].join('\n');
      
      // Download file
      const blob = new Blob([csvContent], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `watchlist_${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      
      showNotification('Watchlist exported successfully', 'success');
    } catch (error) {
      console.error('Error exporting watchlist:', error);
      showNotification('Error exporting watchlist. Please try again.', 'error');
    }
  };

  // Handle watchlist details click
  const handleWatchlistDetailsClick = (e) => {
    const button = e.target.closest('.watchlist-details-btn');
    let movieId;
    
    if (button && button.dataset.movieId) {
      movieId = button.dataset.movieId;
    } else {
      const watchlistItem = e.target.closest('.watchlist-item');
      movieId = watchlistItem ? watchlistItem.dataset.movieId : null;
    }
    
    if (!movieId) {
      console.error('No movie ID found for watchlist item');
      return;
    }
    
    console.log('Navigating to movie ID:', movieId); // Debug log
    
    // Use router navigation if available
    if (window.navigateTo) {
      window.navigateTo(`/movie/${movieId}`);
    } else {
      // Fallback if router is not available
      window.location.href = `/movie/${movieId}`;
    }
  };

  // Utility functions
  const getImageUrl = (path) => {
    if (!path || path === 'null' || path === 'undefined') {
      return 'https://images.pexels.com/photos/7991579/pexels-photo-7991579.jpeg?auto=compress&cs=tinysrgb&w=500';
    }
    if (path.startsWith('http')) return path;
    // Ensure path starts with /
    const cleanPath = path.startsWith('/') ? path : `/${path}`;
    return `https://image.tmdb.org/t/p/w500${cleanPath}`;
  };

  const getYear = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).getFullYear();
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  // Initialize
  initializeEventListeners();

  // Load watchlist button states for visible movie cards
  const loadWatchlistButtonStates = async () => {
    // Get current user - exit early if not logged in
    const currentUser = window.auth?.getCurrentUser();
    if (!currentUser) {
      return;
    }

    try {
      // Fetch entire watchlist in one query (uses caching)
      const userWatchlist = await watchlistService.getUserWatchlist();
      
      // Create a Set of movie IDs for efficient lookup
      const watchlistMovieIds = new Set(userWatchlist.map(movie => movie.id));
      
      // Update all visible watchlist buttons
      const buttons = document.querySelectorAll('.watchlist-btn[data-movie-id]');
      buttons.forEach(button => {
        const movieId = parseInt(button.dataset.movieId);
        const isInWatchlist = watchlistMovieIds.has(movieId);
        updateWatchlistButton(movieId, isInWatchlist);
      });
    } catch (error) {
      console.error('Error loading watchlist button states:', error);
      // Fallback to individual queries if batch fails
      const buttons = document.querySelectorAll('.watchlist-btn[data-movie-id]');
      buttons.forEach(button => {
        const movieId = parseInt(button.dataset.movieId);
        updateWatchlistButton(movieId);
      });
    }
  };

  // Original function kept for backward compatibility
  const loadWatchlistButtonStatesOld = () => {
    const buttons = document.querySelectorAll('.watchlist-btn[data-movie-id]');
    buttons.forEach(button => {
      const movieId = parseInt(button.dataset.movieId);
      updateWatchlistButton(movieId);
    });
  };

  // Listen for movie cards refresh to update button states
  document.addEventListener('refreshMovieCards', () => {
    setTimeout(() => {
      loadWatchlistButtonStates().catch(error => {
        console.error('Error in loadWatchlistButtonStates:', error);
      });
    }, 100);
  });

  // Load button states when DOM is ready
  setTimeout(() => {
    loadWatchlistButtonStates().catch(error => {
      console.error('Error in initial loadWatchlistButtonStates:', error);
    });
  }, 500);

  // Enhanced createWatchlistInterface that loads data
  const originalCreateWatchlistInterface = createWatchlistInterface;
  const enhancedCreateWatchlistInterface = (currentUser) => {
    const html = originalCreateWatchlistInterface(currentUser);
    if (currentUser) {
      // Load data after a short delay to allow DOM to render
      setTimeout(loadWatchlistData, 100);
    }
    return html;
  };

  // Public API
  return {
    getUserWatchlist: () => watchlistService.getUserWatchlist(),
    getUserWatchlistSync: async () => {
      try {
        // Use cached version if available for faster access
        if (window.watchlistCache && window.watchlistCache.data && 
            Date.now() - window.watchlistCache.timestamp < 30000) { // 30 seconds cache
          return window.watchlistCache.data;
        }
        
        const watchlist = await watchlistService.getUserWatchlist();
        
        // Cache the result
        window.watchlistCache = {
          data: watchlist,
          timestamp: Date.now()
        };
        
        return watchlist;
      } catch (error) {
        console.error('Error getting user watchlist:', error);
        return [];
      }
    },
    addToWatchlist: (movieData) => watchlistService.addToWatchlist(movieData),
    removeFromWatchlist: async (movieId) => {
      const result = await watchlistService.removeFromWatchlist(movieId);
      // Clear cache when watchlist changes
      if (window.watchlistCache) {
        delete window.watchlistCache;
      }
      // Clear navigation cache too
      if (window.router && window.router.clearNavigationCache) {
        window.router.clearNavigationCache();
      }
      return result;
    },
    isInWatchlist: (movieId) => watchlistService.isInWatchlist(movieId),
    createWatchlistButton,
    createWatchlistInterface: enhancedCreateWatchlistInterface,
    importWatchlist,
    parseImdbWatchlist,
    getUserWatchlistCount: () => watchlistService.getUserWatchlistCount()
  };
}