import * as Sentry from '@sentry/browser';

// Initialize Sentry
export function initializeSentry() {
  // Only initialize in production or when explicitly enabled
  const isDevelopment = import.meta.env.DEV;
  const sentryDsn = import.meta.env.VITE_SENTRY_DSN;
  
  if (!sentryDsn) {
    console.log('Sentry DSN not configured. Error monitoring disabled.');
    return;
  }

  Sentry.init({
    dsn: sentryDsn,
    environment: isDevelopment ? 'development' : 'production',
    
    // Performance monitoring
    integrations: [
      Sentry.browserTracingIntegration({
        // BrowserTracing automatically handles routing instrumentation for SPAs
      }),
    ],
    
    // Performance monitoring sample rate
    tracesSampleRate: isDevelopment ? 1.0 : 0.1,
    
    // Session replay for debugging (optional)
    replaysSessionSampleRate: isDevelopment ? 1.0 : 0.1,
    replaysOnErrorSampleRate: 1.0,
    
    // Filter out common non-critical errors
    beforeSend(event, hint) {
      // Filter out network errors that are expected
      if (event.exception) {
        const error = hint.originalException;
        if (error && error.message) {
          // Skip TMDB API rate limiting errors (they're handled gracefully)
          if (error.message.includes('429') || error.message.includes('rate limit')) {
            return null;
          }
          
          // Skip common browser extension errors
          if (error.message.includes('Non-Error promise rejection captured')) {
            return null;
          }
        }
      }
      
      return event;
    },
    
    // Release tracking
    release: import.meta.env.VITE_APP_VERSION || '1.0.0',
  });

  // Set up global error handlers
  setupGlobalErrorHandlers();
  
  console.log('Sentry initialized for error monitoring');
}

// Set up additional error handlers
function setupGlobalErrorHandlers() {
  // Handle unhandled promise rejections
  window.addEventListener('unhandledrejection', (event) => {
    Sentry.captureException(event.reason, {
      tags: {
        type: 'unhandled_promise_rejection'
      },
      extra: {
        promise: event.promise
      }
    });
  });

  // Handle resource loading errors
  window.addEventListener('error', (event) => {
    if (event.target !== window) {
      // This is a resource loading error (image, script, etc.)
      Sentry.captureMessage(`Resource loading error: ${event.target.src || event.target.href}`, 'warning', {
        tags: {
          type: 'resource_error',
          element: event.target.tagName
        },
        extra: {
          source: event.target.src || event.target.href,
          element: event.target.outerHTML
        }
      });
    }
  }, true);
}

// Set user context when user logs in
export function setSentryUser(user) {
  Sentry.setUser({
    id: user.id,
    email: user.email,
    username: `${user.firstName} ${user.lastName}`,
  });
}

// Clear user context when user logs out
export function clearSentryUser() {
  Sentry.setUser(null);
}

// Add breadcrumb for user actions
export function addSentryBreadcrumb(message, category = 'user', level = 'info', data = {}) {
  Sentry.addBreadcrumb({
    message,
    category,
    level,
    data,
    timestamp: Date.now() / 1000,
  });
}

// Capture custom errors with context
export function captureError(error, context = {}) {
  Sentry.captureException(error, {
    tags: context.tags || {},
    extra: context.extra || {},
    level: context.level || 'error',
  });
}

// Capture custom messages/events
function captureMessage(message, level = 'info', context = {}) {
  Sentry.captureMessage(message, level, {
    tags: context.tags || {},
    extra: context.extra || {},
  });
}

// Set custom tags for the current session
function setSentryTag(key, value) {
  Sentry.setTag(key, value);
}

// Set custom context
function setSentryContext(key, context) {
  Sentry.setContext(key, context);
}

// Performance monitoring helpers
function startTransaction(name, op = 'navigation') {
  return Sentry.startTransaction({ name, op });
}

// Wrap async functions with error handling
function withSentryErrorHandling(fn, context = {}) {
  return async (...args) => {
    try {
      return await fn(...args);
    } catch (error) {
      captureError(error, {
        tags: { function: fn.name, ...context.tags },
        extra: { args, ...context.extra }
      });
      throw error; // Re-throw to maintain original behavior
    }
  };
}

// API call wrapper with error tracking
export function withSentryApiTracking(apiCall, endpoint) {
  return withSentryErrorHandling(apiCall, {
    tags: { api_endpoint: endpoint, type: 'api_call' },
    extra: { endpoint }
  });
}