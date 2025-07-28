/**
 * Centralized error handling utilities
 */

export class AppError extends Error {
  constructor(message, code = 'UNKNOWN_ERROR', details = {}) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.details = details;
    this.timestamp = new Date().toISOString();
  }
}

export const ErrorCodes = {
  NETWORK_ERROR: 'NETWORK_ERROR',
  AUTH_ERROR: 'AUTH_ERROR',
  WEBSOCKET_ERROR: 'WEBSOCKET_ERROR',
  ENCRYPTION_ERROR: 'ENCRYPTION_ERROR',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  PERMISSION_ERROR: 'PERMISSION_ERROR',
  SERVER_ERROR: 'SERVER_ERROR',
  UNKNOWN_ERROR: 'UNKNOWN_ERROR'
};

export const getErrorMessage = (error) => {
  if (error instanceof AppError) {
    return error.message;
  }

  if (error?.code) {
    switch (error.code) {
      case 'auth/network-request-failed':
        return 'Network error. Please check your connection and try again.';
      case 'auth/too-many-requests':
        return 'Too many failed attempts. Please try again later.';
      case 'auth/popup-blocked':
        return 'Pop-up was blocked. Please allow pop-ups and try again.';
      case 'auth/popup-closed-by-user':
        return 'Sign-in was cancelled. Please try again.';
      case 'auth/user-disabled':
        return 'This account has been disabled. Please contact support.';
      case 'auth/user-not-found':
        return 'No account found with this email address.';
      case 'auth/wrong-password':
        return 'Incorrect password. Please try again.';
      case 'auth/invalid-email':
        return 'Invalid email address format.';
      default:
        return error.message || 'An unexpected error occurred.';
    }
  }

  if (error?.message) {
    return error.message;
  }

  return 'An unexpected error occurred. Please try again.';
};

export const logError = (error, context = {}) => {
  const errorInfo = {
    message: error.message,
    stack: error.stack,
    code: error.code,
    timestamp: new Date().toISOString(),
    context,
    userAgent: typeof window !== 'undefined' ? window.navigator.userAgent : 'server',
    url: typeof window !== 'undefined' ? window.location.href : 'unknown'
  };

  // Log to console in development
  if (process.env.NODE_ENV === 'development') {
    console.error('Error logged:', errorInfo);
  }

  // In production, send to error reporting service
  if (process.env.NODE_ENV === 'production') {
    // Example: Send to Sentry, LogRocket, or custom logging service
    // errorReportingService.log(errorInfo);
  }

  return errorInfo;
};

export const handleAsyncError = (asyncFn) => {
  return async (...args) => {
    try {
      return await asyncFn(...args);
    } catch (error) {
      logError(error, { function: asyncFn.name, args });
      throw error;
    }
  };
};

export const withErrorHandling = (component) => {
  return (props) => {
    try {
      return component(props);
    } catch (error) {
      logError(error, { component: component.name, props });
      throw error;
    }
  };
};

export const isNetworkError = (error) => {
  return (
    error.code === 'NETWORK_ERROR' ||
    error.message?.includes('network') ||
    error.message?.includes('fetch') ||
    error.name === 'NetworkError'
  );
};

export const isAuthError = (error) => {
  return (
    error.code === 'AUTH_ERROR' ||
    error.code?.startsWith('auth/') ||
    error.message?.includes('authentication') ||
    error.message?.includes('unauthorized')
  );
};

export const shouldRetry = (error, retryCount = 0, maxRetries = 3) => {
  if (retryCount >= maxRetries) {
    return false;
  }

  // Retry network errors
  if (isNetworkError(error)) {
    return true;
  }

  // Retry server errors (5xx)
  if (error.status >= 500 && error.status < 600) {
    return true;
  }

  // Don't retry auth errors or client errors
  if (isAuthError(error) || (error.status >= 400 && error.status < 500)) {
    return false;
  }

  return false;
};

export const retryWithBackoff = async (fn, maxRetries = 3, baseDelay = 1000) => {
  let lastError;
  
  for (let i = 0; i <= maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      
      if (i === maxRetries || !shouldRetry(error, i, maxRetries)) {
        throw error;
      }
      
      // Exponential backoff with jitter
      const delay = baseDelay * Math.pow(2, i) + Math.random() * 1000;
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError;
};