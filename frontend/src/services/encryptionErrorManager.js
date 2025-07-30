/**
 * EncryptionErrorManager - Centralized management of encryption errors
 * with retry mechanisms and user-friendly error handling
 */

import { EncryptionErrorTypes } from './encryptionService';
import { retryEncryptionOperation, getEncryptionErrorMessage } from '../utils/errorHandler';

class EncryptionErrorManager {
  constructor() {
    this.errorListeners = new Set();
    this.retryStrategies = new Map();
    this.errorHistory = [];
    this.maxHistorySize = 100;
    
    this.setupDefaultRetryStrategies();
  }

  /**
   * Setup default retry strategies for different error types
   */
  setupDefaultRetryStrategies() {
    // Key generation retry strategy
    this.retryStrategies.set(EncryptionErrorTypes.KEY_GENERATION_FAILED, {
      maxRetries: 3,
      baseDelay: 2000,
      shouldRetry: (error, attempt) => attempt < 3,
      onRetry: (error, attempt) => {
        console.log(`Retrying key generation (attempt ${attempt + 1}/3)`);
      }
    });

    // Encryption failure retry strategy
    this.retryStrategies.set(EncryptionErrorTypes.ENCRYPTION_FAILED, {
      maxRetries: 2,
      baseDelay: 1000,
      shouldRetry: (error, attempt) => {
        // Don't retry if it's a validation error
        if (error.message?.includes('invalid') || error.message?.includes('format')) {
          return false;
        }
        return attempt < 2;
      },
      onRetry: (error, attempt) => {
        console.log(`Retrying message encryption (attempt ${attempt + 1}/2)`);
      }
    });

    // Decryption failure retry strategy
    this.retryStrategies.set(EncryptionErrorTypes.DECRYPTION_FAILED, {
      maxRetries: 1,
      baseDelay: 500,
      shouldRetry: (error, attempt) => {
        // Only retry once for potential network issues
        return attempt < 1 && !error.message?.includes('corrupted');
      },
      onRetry: (error, attempt) => {
        console.log(`Retrying message decryption (attempt ${attempt + 1}/1)`);
      }
    });

    // Key exchange retry strategy
    this.retryStrategies.set(EncryptionErrorTypes.KEY_EXCHANGE_FAILED, {
      maxRetries: 3,
      baseDelay: 1500,
      shouldRetry: (error, attempt) => attempt < 3,
      onRetry: (error, attempt) => {
        console.log(`Retrying key exchange (attempt ${attempt + 1}/3)`);
      }
    });

    // Signature verification - no retry (data integrity issue)
    this.retryStrategies.set(EncryptionErrorTypes.SIGNATURE_VERIFICATION_FAILED, {
      maxRetries: 0,
      baseDelay: 0,
      shouldRetry: () => false,
      onRetry: () => {}
    });

    // Storage failure retry strategy
    this.retryStrategies.set(EncryptionErrorTypes.STORAGE_FAILED, {
      maxRetries: 2,
      baseDelay: 1000,
      shouldRetry: (error, attempt) => attempt < 2,
      onRetry: (error, attempt) => {
        console.log(`Retrying key storage (attempt ${attempt + 1}/2)`);
      }
    });

    // Initialization failure retry strategy
    this.retryStrategies.set(EncryptionErrorTypes.INITIALIZATION_FAILED, {
      maxRetries: 3,
      baseDelay: 2000,
      shouldRetry: (error, attempt) => attempt < 3,
      onRetry: (error, attempt) => {
        console.log(`Retrying encryption initialization (attempt ${attempt + 1}/3)`);
      }
    });
  }

  /**
   * Add an error listener
   */
  addErrorListener(listener) {
    this.errorListeners.add(listener);
    return () => this.errorListeners.delete(listener);
  }

  /**
   * Notify all error listeners
   */
  notifyErrorListeners(error, context = {}) {
    this.errorListeners.forEach(listener => {
      try {
        listener(error, context);
      } catch (listenerError) {
        console.error('Error in encryption error listener:', listenerError);
      }
    });
  }

  /**
   * Handle an encryption error with automatic retry logic
   */
  async handleError(error, retryFunction, context = {}) {
    // Enhance error with user-friendly message if not present
    if (!error.userFriendlyMessage) {
      error.userFriendlyMessage = getEncryptionErrorMessage(error);
    }

    // Add to error history
    this.addToHistory(error, context);

    // Get retry strategy for this error type
    const strategy = this.retryStrategies.get(error.type);
    
    if (!strategy || !retryFunction) {
      // No retry strategy or function, just notify listeners
      this.notifyErrorListeners(error, { ...context, canRetry: false });
      throw error;
    }

    // Attempt retry with strategy
    try {
      const result = await this.executeWithRetry(
        retryFunction,
        error,
        strategy,
        context
      );
      
      // Success - notify listeners of recovery
      this.notifyErrorListeners(null, { 
        ...context, 
        recovered: true, 
        originalError: error 
      });
      
      return result;
    } catch (finalError) {
      // All retries failed - notify listeners
      this.notifyErrorListeners(finalError, { 
        ...context, 
        canRetry: false,
        retriesExhausted: true 
      });
      throw finalError;
    }
  }

  /**
   * Execute a function with retry logic
   */
  async executeWithRetry(fn, originalError, strategy, context) {
    let lastError = originalError;
    
    for (let attempt = 0; attempt <= strategy.maxRetries; attempt++) {
      try {
        // First attempt uses original function, retries use retry logic
        if (attempt === 0) {
          return await fn();
        }
        
        // Check if we should retry
        if (!strategy.shouldRetry(lastError, attempt - 1)) {
          throw lastError;
        }
        
        // Notify about retry attempt
        strategy.onRetry(lastError, attempt - 1);
        this.notifyErrorListeners(lastError, { 
          ...context, 
          retrying: true, 
          attempt: attempt,
          maxAttempts: strategy.maxRetries + 1
        });
        
        // Wait before retry
        if (strategy.baseDelay > 0) {
          const delay = strategy.baseDelay * Math.pow(1.5, attempt - 1) + Math.random() * 500;
          await new Promise(resolve => setTimeout(resolve, Math.min(delay, 10000)));
        }
        
        // Attempt retry
        return await fn();
        
      } catch (error) {
        lastError = error;
        
        // Enhance error with user-friendly message
        if (!error.userFriendlyMessage) {
          error.userFriendlyMessage = getEncryptionErrorMessage(error);
        }
        
        // Add retry context
        error.retryAttempt = attempt;
        error.maxRetries = strategy.maxRetries;
        
        // Continue to next iteration or throw if max retries reached
        if (attempt >= strategy.maxRetries) {
          throw error;
        }
      }
    }
    
    throw lastError;
  }

  /**
   * Handle encryption operation with automatic error management
   */
  async handleEncryptionOperation(operation, operationType, context = {}) {
    try {
      return await operation();
    } catch (error) {
      // Determine error type if not set
      if (!error.type) {
        error.type = this.determineErrorType(error, operationType);
      }
      
      // Create retry function
      const retryFunction = () => operation();
      
      // Handle with retry logic
      return await this.handleError(error, retryFunction, {
        ...context,
        operationType
      });
    }
  }

  /**
   * Determine error type based on error message and operation type
   */
  determineErrorType(error, operationType) {
    const message = error.message?.toLowerCase() || '';
    
    if (operationType === 'keyGeneration' || message.includes('key generation')) {
      return EncryptionErrorTypes.KEY_GENERATION_FAILED;
    }
    
    if (operationType === 'encryption' || (message.includes('encrypt') && !message.includes('decrypt'))) {
      return EncryptionErrorTypes.ENCRYPTION_FAILED;
    }
    
    if (operationType === 'decryption' || message.includes('decrypt')) {
      return EncryptionErrorTypes.DECRYPTION_FAILED;
    }
    
    if (operationType === 'keyExchange' || message.includes('key exchange') || message.includes('public key')) {
      return EncryptionErrorTypes.KEY_EXCHANGE_FAILED;
    }
    
    if (operationType === 'signature' || message.includes('signature')) {
      return EncryptionErrorTypes.SIGNATURE_VERIFICATION_FAILED;
    }
    
    if (operationType === 'storage' || message.includes('storage')) {
      return EncryptionErrorTypes.STORAGE_FAILED;
    }
    
    if (operationType === 'initialization' || message.includes('initialization')) {
      return EncryptionErrorTypes.INITIALIZATION_FAILED;
    }
    
    // Default to encryption failed
    return EncryptionErrorTypes.ENCRYPTION_FAILED;
  }

  /**
   * Add error to history
   */
  addToHistory(error, context = {}) {
    const historyEntry = {
      error: {
        type: error.type,
        message: error.message,
        userFriendlyMessage: error.userFriendlyMessage,
        timestamp: error.timestamp || new Date()
      },
      context,
      id: `${Date.now()}-${Math.random()}`
    };
    
    this.errorHistory.unshift(historyEntry);
    
    // Limit history size
    if (this.errorHistory.length > this.maxHistorySize) {
      this.errorHistory = this.errorHistory.slice(0, this.maxHistorySize);
    }
  }

  /**
   * Get error history
   */
  getErrorHistory(limit = 10) {
    return this.errorHistory.slice(0, limit);
  }

  /**
   * Get error statistics
   */
  getErrorStats() {
    const stats = {
      total: this.errorHistory.length,
      byType: {},
      recent: this.errorHistory.slice(0, 10),
      mostCommon: null
    };
    
    // Count by type
    this.errorHistory.forEach(entry => {
      const type = entry.error.type;
      stats.byType[type] = (stats.byType[type] || 0) + 1;
    });
    
    // Find most common error type
    let maxCount = 0;
    Object.entries(stats.byType).forEach(([type, count]) => {
      if (count > maxCount) {
        maxCount = count;
        stats.mostCommon = { type, count };
      }
    });
    
    return stats;
  }

  /**
   * Clear error history
   */
  clearHistory() {
    this.errorHistory = [];
  }

  /**
   * Create a user-friendly error summary
   */
  createErrorSummary(errors) {
    if (!errors || errors.length === 0) {
      return null;
    }
    
    const errorTypes = [...new Set(errors.map(e => e.type))];
    
    if (errorTypes.length === 1) {
      const error = errors[0];
      return {
        title: this.getErrorTitle(error.type),
        message: error.userFriendlyMessage || error.message,
        canRetry: this.canRetryErrorType(error.type),
        severity: this.getErrorSeverity(error.type)
      };
    }
    
    return {
      title: 'Multiple Encryption Errors',
      message: `${errors.length} encryption errors occurred. Please check your connection and try again.`,
      canRetry: errors.some(e => this.canRetryErrorType(e.type)),
      severity: 'error',
      details: errors.map(e => ({
        type: e.type,
        message: e.userFriendlyMessage || e.message
      }))
    };
  }

  /**
   * Get user-friendly error title
   */
  getErrorTitle(errorType) {
    const titles = {
      [EncryptionErrorTypes.KEY_GENERATION_FAILED]: 'Key Generation Failed',
      [EncryptionErrorTypes.ENCRYPTION_FAILED]: 'Message Encryption Failed',
      [EncryptionErrorTypes.DECRYPTION_FAILED]: 'Message Decryption Failed',
      [EncryptionErrorTypes.KEY_EXCHANGE_FAILED]: 'Key Exchange Failed',
      [EncryptionErrorTypes.SIGNATURE_VERIFICATION_FAILED]: 'Signature Verification Failed',
      [EncryptionErrorTypes.STORAGE_FAILED]: 'Key Storage Failed',
      [EncryptionErrorTypes.INITIALIZATION_FAILED]: 'Encryption Setup Failed'
    };
    
    return titles[errorType] || 'Encryption Error';
  }

  /**
   * Check if error type can be retried
   */
  canRetryErrorType(errorType) {
    const strategy = this.retryStrategies.get(errorType);
    return strategy && strategy.maxRetries > 0;
  }

  /**
   * Get error severity level
   */
  getErrorSeverity(errorType) {
    const severities = {
      [EncryptionErrorTypes.KEY_GENERATION_FAILED]: 'error',
      [EncryptionErrorTypes.ENCRYPTION_FAILED]: 'error',
      [EncryptionErrorTypes.DECRYPTION_FAILED]: 'error',
      [EncryptionErrorTypes.KEY_EXCHANGE_FAILED]: 'warning',
      [EncryptionErrorTypes.SIGNATURE_VERIFICATION_FAILED]: 'warning',
      [EncryptionErrorTypes.STORAGE_FAILED]: 'warning',
      [EncryptionErrorTypes.INITIALIZATION_FAILED]: 'error'
    };
    
    return severities[errorType] || 'error';
  }
}

// Export singleton instance
const encryptionErrorManager = new EncryptionErrorManager();
export default encryptionErrorManager;