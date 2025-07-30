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

// Encryption-specific error handling
export const EncryptionErrorCodes = {
  KEY_GENERATION_FAILED: 'ENCRYPTION_KEY_GENERATION_FAILED',
  ENCRYPTION_FAILED: 'ENCRYPTION_FAILED',
  DECRYPTION_FAILED: 'DECRYPTION_FAILED',
  KEY_EXCHANGE_FAILED: 'ENCRYPTION_KEY_EXCHANGE_FAILED',
  SIGNATURE_VERIFICATION_FAILED: 'ENCRYPTION_SIGNATURE_VERIFICATION_FAILED',
  STORAGE_FAILED: 'ENCRYPTION_STORAGE_FAILED',
  INITIALIZATION_FAILED: 'ENCRYPTION_INITIALIZATION_FAILED'
};

export const isEncryptionError = (error) => {
  return (
    error.code?.startsWith('ENCRYPTION_') ||
    error.type?.includes('encryption') ||
    error.type?.includes('crypto') ||
    error.message?.toLowerCase().includes('encryption') ||
    error.message?.toLowerCase().includes('decrypt') ||
    error.message?.toLowerCase().includes('crypto')
  );
};

export const getEncryptionErrorMessage = (error) => {
  if (error.userFriendlyMessage) {
    return error.userFriendlyMessage;
  }

  // Map technical errors to user-friendly messages
  const errorMessage = error.message?.toLowerCase() || '';
  
  if (errorMessage.includes('key generation')) {
    return 'Failed to generate encryption keys. Please try again.';
  }
  
  if (errorMessage.includes('encrypt') && !errorMessage.includes('decrypt')) {
    return 'Failed to encrypt message. Please check your connection and try again.';
  }
  
  if (errorMessage.includes('decrypt')) {
    return 'Unable to decrypt this message. It may be corrupted or sent with incompatible encryption.';
  }
  
  if (errorMessage.includes('signature')) {
    return 'Message authenticity could not be verified. This message may not be from the claimed sender.';
  }
  
  if (errorMessage.includes('key exchange') || errorMessage.includes('public key')) {
    return 'Failed to exchange encryption keys. Please refresh and try again.';
  }
  
  if (errorMessage.includes('storage') || errorMessage.includes('localstorage')) {
    return 'Failed to store encryption keys securely. Please check your browser settings.';
  }
  
  if (errorMessage.includes('initialization') || errorMessage.includes('setup')) {
    return 'Failed to initialize encryption. Please refresh the page and try again.';
  }
  
  return 'An encryption error occurred. Please try again.';
};

export const shouldRetryEncryptionError = (error, retryCount = 0, maxRetries = 3) => {
  if (retryCount >= maxRetries) {
    return false;
  }

  // Don't retry signature verification failures
  if (error.type === 'signature_verification_failed' || 
      error.message?.toLowerCase().includes('signature')) {
    return false;
  }

  // Retry network-related encryption errors
  if (isNetworkError(error) || error.message?.toLowerCase().includes('fetch')) {
    return true;
  }

  // Retry key exchange failures
  if (error.message?.toLowerCase().includes('key exchange') ||
      error.message?.toLowerCase().includes('public key')) {
    return true;
  }

  // Retry key generation failures (up to 3 times)
  if (error.message?.toLowerCase().includes('key generation')) {
    return retryCount < 3;
  }

  // Retry storage failures
  if (error.message?.toLowerCase().includes('storage')) {
    return retryCount < 2;
  }

  // Don't retry decryption failures (data might be corrupted)
  if (error.message?.toLowerCase().includes('decrypt')) {
    return false;
  }

  // Retry other encryption errors once
  if (isEncryptionError(error)) {
    return retryCount < 1;
  }

  return shouldRetry(error, retryCount, maxRetries);
};

export const retryEncryptionOperation = async (fn, maxRetries = 3, baseDelay = 1000) => {
  let lastError;
  
  for (let i = 0; i <= maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      
      if (i === maxRetries || !shouldRetryEncryptionError(error, i, maxRetries)) {
        // Enhance error with user-friendly message
        if (isEncryptionError(error) && !error.userFriendlyMessage) {
          error.userFriendlyMessage = getEncryptionErrorMessage(error);
        }
        throw error;
      }
      
      // Exponential backoff with jitter, but shorter delays for encryption operations
      const delay = Math.min(baseDelay * Math.pow(1.5, i) + Math.random() * 500, 5000);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError;
};