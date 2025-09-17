import { authService } from './lib/auth-supabase.js';
import { showNotification } from './utils/notifications.js';

export function initializeAuth() {
  let eventListenersInitialized = false;

  // DOM elements
  const authModal = document.getElementById('authModal');
  const authOverlay = document.getElementById('authOverlay');
  const loginForm = document.getElementById('loginForm');
  const registerForm = document.getElementById('registerForm');
  const loginTab = document.getElementById('loginTab');
  const registerTab = document.getElementById('registerTab');
  const authForms = document.getElementById('authForms');
  const accountNavLink = document.getElementById('accountNavLink');
  const accountContent = document.getElementById('accountContent');

  // Wait for auth initialization before updating UI
  if (authService.isInitialized()) {
    updateAuthUI();
    updateAccountPage();
  } else {
    // Show loading state while auth initializes
    const accountNavLink = document.getElementById('accountNavLink');
    if (accountNavLink) {
      // Try to get cached user data to prevent flash
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
        } else {
          accountNavLink.innerHTML = '<span class="loading-spinner-small"></span>';
        }
      } catch (error) {
        accountNavLink.innerHTML = '<span class="loading-spinner-small"></span>';
      }
    }
  }
  
  // Only setup event listeners once using delegation
  if (!eventListenersInitialized) {
    setupEventListeners();
    eventListenersInitialized = true;
  }

  // Listen for auth initialization
  document.addEventListener('authInitialized', (e) => {
    console.log('Auth initialized, updating UI');
    updateAuthUI();
    updateAccountPage();
  });

  // Listen for Supabase auth events
  document.addEventListener('userLoggedIn', (e) => {
    updateAuthUI();
    updateAccountPage();
    showAccountPage();
  });

  document.addEventListener('userLoggedOut', () => {
    updateAuthUI();
    updateAccountPage();
    showNotification('You have been logged out successfully.', 'success');
  });

  function setupEventListeners() {
    // Use event delegation on document body to handle all auth-related clicks
    document.body.addEventListener('click', (e) => {
      // Account nav link click
      if (e.target.closest('#accountNavLink')) {
        e.preventDefault();
        showAccountPage();
        return;
      }
      
      // Auth modal tabs
      if (e.target.closest('#loginTab')) {
        switchToLogin();
        return;
      }
      if (e.target.closest('#registerTab')) {
        switchToRegister();
        return;
      }
      
      // Modal close button
      if (e.target.closest('.modal-close') && e.target.closest('#authOverlay')) {
        closeAuthModal();
        return;
      }
      
      // Show login/register buttons in account prompt
      if (e.target.closest('#showLoginBtn')) {
        showAuthModal();
        switchToLogin();
        return;
      }
      if (e.target.closest('#showRegisterBtn')) {
        showAuthModal();
        switchToRegister();
        return;
      }
      
      // Account navigation items
      if (e.target.closest('.account-nav-item')) {
        const navItem = e.target.closest('.account-nav-item');
        const tabName = navItem.dataset.tab;
        
        if (tabName) {
          // Update active nav item
          document.querySelectorAll('.account-nav-item').forEach(nav => nav.classList.remove('active'));
          navItem.classList.add('active');
          
          // Update active tab
          document.querySelectorAll('.account-tab').forEach(tab => tab.classList.remove('active'));
          const targetTab = document.getElementById(`${tabName}Tab`);
          if (targetTab) {
            targetTab.classList.add('active');
          }
          
          // Load tab-specific content
          loadTabContent(tabName);
        }
        return;
      }
      
      // Edit profile button
      if (e.target.closest('#editProfileBtn')) {
        showNotification('Profile editing feature coming soon!', 'info');
        return;
      }
      
      // Logout button
      if (e.target.closest('#logoutBtn')) {
        logout();
        return;
      }
    });
    
    // Modal overlay click (outside modal)
    if (authOverlay) {
      authOverlay.addEventListener('click', (e) => {
        if (e.target === authOverlay) {
          closeAuthModal();
        }
      });
    }
    
    // Form submissions
    if (loginForm) {
      loginForm.addEventListener('submit', handleLogin);
    }
    if (registerForm) {
      registerForm.addEventListener('submit', handleRegister);
    }
    
    // Escape key to close modal
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        closeAuthModal();
      }
    });
  }

  function showAccountPage() {
    const accountSection = document.getElementById('account');
    if (accountSection) {
      accountSection.scrollIntoView({ behavior: 'smooth' });
    }
  }

  function showAuthModal() {
    if (authOverlay) {
      authOverlay.style.display = 'flex';
      document.body.style.overflow = 'hidden';
      switchToLogin();
    }
  }

  function closeAuthModal() {
    if (authOverlay) {
      authOverlay.style.display = 'none';
      document.body.style.overflow = 'auto';
    }
  }

  function switchToLogin() {
    if (loginTab && registerTab && authForms) {
      loginTab.classList.add('active');
      registerTab.classList.remove('active');
      authForms.style.transform = 'translateX(0)';
      authForms.classList.remove('show-register');
    }
  }

  function switchToRegister() {
    if (loginTab && registerTab && authForms) {
      registerTab.classList.add('active');
      loginTab.classList.remove('active');
      
      // Check if mobile view
      const isMobile = window.innerWidth <= 768;
      if (isMobile) {
        authForms.style.transform = 'translateX(-100%)';
        authForms.classList.add('show-register');
      } else {
        authForms.style.transform = 'translateX(-50%)';
      }
    }
  }

  async function handleLogin(e) {
    e.preventDefault();
    
    const formData = new FormData(loginForm);
    const email = formData.get('email');
    const password = formData.get('password');

    try {
      await authService.signIn(email, password);
      const currentUser = authService.getCurrentUser();
      if (currentUser) {
        showNotification(`Welcome back, ${currentUser.firstName}!`, 'success');
      }
      closeAuthModal();
    } catch (error) {
      console.error('Login error:', error);
      showNotification(error.message || 'Login failed. Please try again.', 'error');
    }
  }

  async function handleRegister(e) {
    e.preventDefault();
    
    const formData = new FormData(registerForm);
    const userData = {
      firstName: formData.get('firstName'),
      lastName: formData.get('lastName'),
      email: formData.get('email'),
      password: formData.get('password'),
      dateOfBirth: formData.get('dateOfBirth'),
      phone: formData.get('phone'),
      bio: formData.get('bio') || ''
    };

    // Validate password confirmation
    const confirmPassword = formData.get('confirmPassword');
    if (userData.password !== confirmPassword) {
      showNotification('Passwords do not match.', 'error');
      return;
    }

    try {
      const result = await authService.signUp(userData);
      
      if (result.needsConfirmation) {
        showNotification('Please check your email to confirm your account', 'info');
      } else {
        // Only show welcome message for immediate sign-ups (no email confirmation)
        const currentUser = authService.getCurrentUser();
        if (currentUser) {
          showNotification(`Welcome to DreadScale, ${currentUser.firstName}!`, 'success');
        }
      }
      
      closeAuthModal();
    } catch (error) {
      console.error('Registration error:', error);
      showNotification(error.message || 'Registration failed. Please try again.', 'error');
    }
  }

  async function updateAccountPage() {
    console.log('🔍 [DEBUG] updateAccountPage called');
    
    const currentUser = authService.getCurrentUser();
    
    // Don't update if auth is still initializing and no user data
    if (!authService.isInitialized() && !currentUser) {
      return;
    }
    
    console.log('🔍 [DEBUG] currentUser:', currentUser);
    
    if (!accountContent) return;

    if (!currentUser) {
      // Show login/register prompt
      accountContent.innerHTML = `
        <div class="section-header">
          <h2 class="section-title">👤 Account</h2>
          <p class="section-subtitle">Sign in to access your personal account and preferences</p>
        </div>
        
        <div class="account-prompt">
          <div class="account-prompt-card">
            <div class="account-prompt-icon">👤</div>
            <h3>Welcome to Your Account</h3>
            <p>Sign in to access your personal profile, movie preferences, watchlist, and rate movies.</p>
            <div class="account-prompt-actions">
              <button class="btn btn-primary" id="showLoginBtn">
                <span class="btn-icon">🔑</span>
                Sign In
              </button>
              <button class="btn btn-secondary" id="showRegisterBtn">
                <span class="btn-icon">👤</span>
                Create Account
              </button>
            </div>
          </div>
        </div>
      `;
    } else {
      // Get fresh data every time the account page is updated
      let watchlistCount = 0;
      let moviesRatedCount = 0;
      
      try {
        // Get watchlist count from Supabase
        if (window.watchlistService) {
          watchlistCount = await window.watchlistService.getUserWatchlistCount();
        }
        
        // Get movies rated count from Supabase
        if (window.ratingsService) {
          moviesRatedCount = await window.ratingsService.getMoviesRatedCount();
        }
      } catch (error) {
        console.warn('Unable to load account stats - network or configuration issue:', error.message);
        // Continue with default values (0) for both counts
      }

      // Show user profile and account management
      accountContent.innerHTML = `
        <div class="section-header">
          <h2 class="section-title">👤 My Account</h2>
          <p class="section-subtitle">Manage your profile and preferences</p>
        </div>

        <div class="account-layout">
          <div class="account-sidebar">
            <div class="account-nav">
              <button class="account-nav-item active" data-tab="profile">
                <span class="nav-icon">👤</span>
                Profile
              </button>
              <button class="account-nav-item" data-tab="watchlist">
                <span class="nav-icon">📋</span>
                Watchlist
              </button>
              <button class="account-nav-item" data-tab="ratings">
                <span class="nav-icon">⭐</span>
                My Ratings
              </button>
              <button class="account-nav-item" data-tab="preferences">
                <span class="nav-icon">⚙️</span>
                Preferences
              </button>
            </div>
          </div>

          <div class="account-main">
            <div id="profileTab" class="account-tab active">
              <div class="profile-container">
                <div class="profile-header">
                  <div class="profile-avatar">
                    <div class="avatar-circle large" style="background: ${currentUser.avatar.color}">
                      ${currentUser.avatar.initials}
                    </div>
                    <div class="profile-status online"></div>
                  </div>
                  <div class="profile-info">
                    <h2 class="profile-name">${currentUser.firstName} ${currentUser.lastName}</h2>
                    <p class="profile-email">${currentUser.email}</p>
                    <div class="profile-meta">
                      <span class="profile-joined">Member since ${formatDate(currentUser.createdAt)}</span>
                      ${currentUser.lastLogin ? `<span class="profile-last-login">Last login: ${formatDate(currentUser.lastLogin)}</span>` : ''}
                    </div>
                  </div>
                  <div class="profile-actions">
                    <button class="btn btn-secondary" id="editProfileBtn">
                      <span class="btn-icon">✏️</span>
                      Edit Profile
                    </button>
                    <button class="btn btn-outline" id="logoutBtn">
                      <span class="btn-icon">🚪</span>
                      Logout
                    </button>
                  </div>
                </div>

                <div class="profile-content">
                  <div class="profile-section">
                    <h3>Personal Information</h3>
                    <div class="info-grid">
                      <div class="info-item">
                        <label>Full Name</label>
                        <span>${currentUser.firstName} ${currentUser.lastName}</span>
                      </div>
                      <div class="info-item">
                        <label>Email</label>
                        <span>${currentUser.email}</span>
                      </div>
                      ${currentUser.dateOfBirth ? `
                        <div class="info-item">
                          <label>Date of Birth</label>
                          <span>${formatDate(currentUser.dateOfBirth)}</span>
                        </div>
                      ` : ''}
                      ${currentUser.phone ? `
                        <div class="info-item">
                          <label>Phone</label>
                          <span>${currentUser.phone}</span>
                        </div>
                      ` : ''}
                    </div>
                    ${currentUser.bio ? `
                      <div class="bio-section">
                        <label>Bio</label>
                        <p class="user-bio">${currentUser.bio}</p>
                      </div>
                    ` : ''}
                  </div>

                  <div class="profile-section">
                    <h3>Account Activity</h3>
                    <div class="activity-stats">
                      <div class="activity-item">
                        <div class="activity-icon">📅</div>
                        <div class="activity-info">
                          <h4>Account Created</h4>
                          <p>${formatDate(currentUser.createdAt)}</p>
                        </div>
                      </div>
                      ${currentUser.lastLogin ? `
                        <div class="activity-item">
                          <div class="activity-icon">🕒</div>
                          <div class="activity-info">
                            <h4>Last Login</h4>
                            <p>${formatDate(currentUser.lastLogin)}</p>
                          </div>
                        </div>
                      ` : ''}
                      <div class="activity-item">
                        <div class="activity-icon">🎬</div>
                        <div class="activity-info">
                          <h4>Movies in Watchlist</h4>
                          <p id="watchlistCountDisplay">${watchlistCount} movies</p>
                        </div>
                      </div>
                      <div class="activity-item">
                        <div class="activity-icon">⭐</div>
                        <div class="activity-info">
                          <h4>Movies Rated</h4>
                          <p id="moviesRatedDisplay">${moviesRatedCount} movies</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div id="watchlistTab" class="account-tab">
              <div class="tab-content">
                <h3>My Watchlist</h3>
                <p>Manage your personal movie collection and import from other platforms.</p>
                <div id="accountWatchlistContent">
                  <!-- Watchlist content will be loaded here -->
                </div>
              </div>
            </div>

            <div id="ratingsTab" class="account-tab">
              <div class="tab-content">
                <h3>My Ratings</h3>
                <p>Movies you've rated will be displayed here.</p>
                <div id="accountRatingsContent">
                  <!-- Ratings content will be loaded here -->
                </div>
              </div>
            </div>

            <div id="preferencesTab" class="account-tab">
              <div class="tab-content">
                <h3>Preferences</h3>
                <div class="preferences-grid">
                  <div class="preference-item">
                    <label>Watchlist</label>
                    <span class="stat-value" id="preferencesWatchlistCount">${watchlistCount} movies</span>
                  </div>
                  <div class="preference-item">
                    <label>Movies Rated</label>
                    <span class="stat-value" id="preferencesMoviesRated">${moviesRatedCount} movies</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      `;
    }
  }

  function loadTabContent(tabName) {
    switch (tabName) {
      case 'watchlist':
        loadWatchlistContent();
        break;
      case 'ratings':
        loadRatingsContent();
        break;
      case 'preferences':
        // Preferences are already loaded in the HTML
        break;
    }
  }

  function loadWatchlistContent() {
    const watchlistContent = document.getElementById('accountWatchlistContent');
    if (watchlistContent) {
      // Import watchlist module and create interface
      import('./watchlist.js').then(({ initializeWatchlist }) => {
        const watchlist = initializeWatchlist();
        const currentUser = authService.getCurrentUser();
        watchlistContent.innerHTML = watchlist.createWatchlistInterface(currentUser);
      });
    }
  }

  async function loadRatingsContent() {
    const ratingsContent = document.getElementById('accountRatingsContent');
    if (ratingsContent) {
      let moviesRatedCount = 0;
      
      try {
        if (window.ratingsService) {
          moviesRatedCount = await window.ratingsService.getMoviesRatedCount();
        }
      } catch (error) {
        console.error('Error getting movies rated count:', error);
      }
      
      ratingsContent.innerHTML = `
        <div class="ratings-summary">
          <p>You have rated <strong>${moviesRatedCount}</strong> ${moviesRatedCount === 1 ? 'movie' : 'movies'}.</p>
          <p>Your rating history and detailed breakdowns will be available here soon.</p>
        </div>
      `;
    }
  }

  async function logout() {
    try {
      await authService.signOut();
    } catch (error) {
      console.error('Logout error:', error);
      showNotification('Error logging out. Please try again.', 'error');
    }
  }

  function updateAuthUI() {
    const currentUser = authService.getCurrentUser();
    
    // Don't update UI if auth is still initializing and we have no user data
    if (!authService.isInitialized() && !currentUser) {
      return;
    }
    
    // Update navigation
    if (accountNavLink) {
      if (currentUser) {
        accountNavLink.innerHTML = `
          <span class="nav-user">
            <span class="nav-avatar" style="background: ${currentUser.avatar.color}">
              ${currentUser.avatar.initials}
            </span>
            ${currentUser.firstName}
          </span>
        `;
      } else {
        // Only reset to 'Account' if auth is fully initialized
        if (authService.isInitialized()) {
          accountNavLink.textContent = 'Account';
        }
      }
    }
  }

  // Function to refresh account data (can be called from other modules)
  async function refreshAccountData() {
    const currentUser = authService.getCurrentUser();
    if (currentUser && accountContent) {
      console.log('🔍 [DEBUG] Refreshing account data...');
      await updateAccountPage();
      
      // Also refresh the currently active tab if it's ratings
      const activeTab = document.querySelector('.account-nav-item.active');
      if (activeTab && activeTab.dataset.tab === 'ratings') {
        await loadRatingsContent();
      }
    }
  }

  function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  }

  // Public API
  return {
    getCurrentUser: () => authService.getCurrentUser(),
    isLoggedIn: () => authService.isLoggedIn(),
    logout,
    showAuthModal,
    updateAccountPage,
    refreshAccountData
  };
}