import { authService } from './lib/auth-supabase.js';

export function initializeNavigation(auth) {
  const hamburger = document.querySelector('.hamburger');
  const navMenu = document.querySelector('.nav-menu');
  const navLinks = document.querySelectorAll('.nav-link');
  const navbar = document.querySelector('.navbar');

  // Show movies section by default
  showSection('#movies');

  // Toggle mobile menu
  if (hamburger && navMenu) {
    hamburger.addEventListener('click', () => {
      hamburger.classList.toggle('active');
      navMenu.classList.toggle('active');
    });
  }

  // Close mobile menu when clicking on a link
  navLinks.forEach(link => {
    link.addEventListener('click', () => {
      if (hamburger && navMenu) {
        hamburger.classList.remove('active');
        navMenu.classList.remove('active');
      }
    });
  });

  // Handle navigation link clicks
  navLinks.forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const targetId = link.getAttribute('href');
      
      // Use router navigation if available
      if (window.navigateTo) {
        const routeMap = {
          '#movies': '/movies',
          '#advancedSearch': '/search-plus',
          '#account': '/account',
          '#about': '/about'
        };
        const route = routeMap[targetId] || '/';
        window.navigateTo(route);
      } else {
        // Fallback to direct section showing
        showSection(targetId);
      }
    });
  });

  // Handle logo click
  document.addEventListener('click', (e) => {
    if (e.target.closest('.nav-logo-link')) {
      e.preventDefault();
      
      // Prevent navigation during auth initialization
      if (!authService.isInitialized()) {
        console.log('Auth still initializing, delaying navigation');
        setTimeout(() => {
          handleLogoClick();
        }, 500);
        return;
      }
      
      handleLogoClick();
    }
  
    // Handle advanced search link click
    if (e.target.closest('.advanced-search-link')) {
      e.preventDefault();
      const link = e.target.closest('.advanced-search-link');
      const targetId = link.getAttribute('href');
      const route = link.getAttribute('data-route');
      
      // Use router navigation if available
      if (window.navigateTo && route) {
        window.navigateTo(route);
      } else {
        // Fallbox to direct section showing
        showSection(targetId);
      }
    }
  });

  function handleLogoClick() {
      // Check if we're already on the home page
      const currentPath = window.location.pathname;
      const isOnHomePage = currentPath === '/' || currentPath === '/movies';
      
      if (isOnHomePage) {
        // If already on home page, refresh the page
        window.location.reload();
      } else {
        // If not on home page, navigate to home
        if (window.navigateTo) {
          window.navigateTo('/movies');
        } else {
          // Fallback to direct section showing
          showSection('#movies');
        }
      }
      
      // Close mobile menu if open
      if (hamburger && navMenu) {
        hamburger.classList.remove('active');
        navMenu.classList.remove('active');
      }
  }

  // Handle footer navigation links
  document.addEventListener('click', (e) => {
    if (e.target.closest('.footer-nav-link')) {
      e.preventDefault();
      const link = e.target.closest('.footer-nav-link');
      const targetId = link.getAttribute('href');
      const route = link.getAttribute('data-route');
      
      // Use router navigation if available
      if (window.navigateTo && route) {
        window.navigateTo(route);
      } else {
        // Fallback to direct section showing
        showSection(targetId);
      }
    }
  });

  // Show specific section and hide others
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
      if (sectionId === '#account' && auth && auth.updateAccountPage) {
        auth.updateAccountPage();
      }

      // Initialize advanced search if showing advanced search section
      if (sectionId === '#advancedSearch') {
        if (window.moviesModule && window.moviesModule.initializeAdvancedSearch) {
          window.moviesModule.initializeAdvancedSearch();
        }
      }
    }

    // Update active navigation link
    updateActiveNavLink(sectionId);
  }

  // Update active navigation link
  function updateActiveNavLink(activeSection) {
    // Update main nav links
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

  // Update navbar background on scroll with proper theme support
  function updateNavbarOnScroll() {
    if (!navbar) return;
    
    const currentTheme = document.documentElement.getAttribute('data-theme') || 'dark';
    
    if (window.scrollY > 50) {
      navbar.classList.add('navbar-scrolled');
      
      // Ensure proper background based on theme
      if (currentTheme === 'dark') {
        navbar.style.background = 'rgba(31, 41, 55, 0.98)';
        navbar.style.borderBottomColor = '#4b5563';
      } else {
        navbar.style.background = 'rgba(71, 85, 105, 0.98)';
        navbar.style.borderBottomColor = '#64748b';
      }
    } else {
      navbar.classList.remove('navbar-scrolled');
      
      // Reset to CSS variables
      navbar.style.background = 'var(--navbar-bg)';
      navbar.style.borderBottomColor = 'var(--navbar-border)';
    }
  }

  window.addEventListener('scroll', updateNavbarOnScroll);

  // Listen for theme changes to update navbar immediately
  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      if (mutation.type === 'attributes' && mutation.attributeName === 'data-theme') {
        // Force navbar update when theme changes
        setTimeout(updateNavbarOnScroll, 50);
      }
    });
  });

  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['data-theme']
  });

  // Initial call to set proper navbar state
  updateNavbarOnScroll();

  // Make showSection available globally for other modules
  window.showSection = showSection;

  // Public API
  return {
    showSection
  };
}