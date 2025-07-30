import { useState, useCallback, useRef } from 'react';
import { EncryptionErrorTypes } from '../services/encryptionService';

/**
 * Hook for managing encryption errors with retry mechanisms and user-friendly handling
 */
export function useEncryptionErrors() {
  const [errors, setErrors] = useState([]);
  const [retryAttempts, setRetryAttempts] = useState({});
  const retryTimeouts = useRef({});

  // Maximum retry attempts for different error types
  const MAX_RETRY_ATTEMPTS = {
    [EncryptionErrorTypes.KEY_GENERATION_FAILED]: 3,
    [EncryptionErrorTypes.ENCRYPTION_FAILED]: 2,
    [EncryptionErrorTypes.DECRYPTION_FAILED]: 2,
    [EncryptionErrorTypes.KEY_EXCHANGE_FAILED]: 3,
    [EncryptionErrorTypes.SIGNATURE_VERIFICATION_FAILED]: 1,
    [EncryptionErrorTypes.STORAGE_FAILED]: 2,
    [EncryptionErrorTypes.INITIALIZATION_FAILED]: 3
  };

  // Retry delays (in milliseconds) with exponential backoff
  const getRetryDelay = (errorType, attemptCount) => {
    const baseDelays = {
      [EncryptionErrorTypes.KEY_GENERATION_FAILED]: 2000,
      [EncryptionErrorTypes.ENCRYPTION_FAILED]: 1000,
      [EncryptionErrorTypes.DECRYPTION_FAILED]: 500,
      [EncryptionErrorTypes.KEY_EXCHANGE_FAILED]: 1500,
      [EncryptionErrorTypes.SIGNATURE_VERIFICATION_FAILED]: 500,
      [EncryptionErrorTypes.STORAGE_FAILED]: 1000,
      [EncryptionErrorTypes.INITIALIZATION_FAILED]: 2000
    };

    const baseDelay = baseDelays[errorType] || 1000;
    return baseDelay * Math.pow(2, attemptCount - 1) + Math.random() * 500;
  };

  /**
   * Add a new encryption error
   */
  const addError = useCallback((error) => {
    const errorId = `${error.type}-${Date.now()}-${Math.random()}`;
    const errorWithId = {
      ...error,
      id: errorId,
      timestamp: error.timestamp || new Date()
    };

    setErrors(prev => [...prev, errorWithId]);
    
    // Initialize retry count
    setRetryAttempts(prev => ({
      ...prev,
      [errorId]: 0
    }));

    return errorId;
  }, []);

  /**
   * Remove an error by ID
   */
  const removeError = useCallback((errorId) => {
    setErrors(prev => prev.filter(error => error.id !== errorId));
    setRetryAttempts(prev => {
      const newAttempts = { ...prev };
      delete newAttempts[errorId];
      return newAttempts;
    });

    // Clear any pending retry timeout
    if (retryTimeouts.current[errorId]) {
      clearTimeout(retryTimeouts.current[errorId]);
      delete retryTimeouts.current[errorId];
    }
  }, []);

  /**
   * Clear all errors
   */
  const clearErrors = useCallback(() => {
    // Clear all retry timeouts
    Object.values(retryTimeouts.current).forEach(timeout => {
      clearTimeout(timeout);
    });
    retryTimeouts.current = {};

    setErrors([]);
    setRetryAttempts({});
  }, []);

  /**
   * Clear errors of a specific type
   */
  const clearErrorsOfType = useCallback((errorType) => {
    setErrors(prev => {
      const errorsToRemove = prev.filter(error => error.type === errorType);
      errorsToRemove.forEach(error => {
        if (retryTimeouts.current[error.id]) {
          clearTimeout(retryTimeouts.current[error.id]);
          delete retryTimeouts.current[error.id];
        }
      });
      return prev.filter(error => error.type !== errorType);
    });

    setRetryAttempts(prev => {
      const newAttempts = { ...prev };
      Object.keys(newAttempts).forEach(errorId => {
        const error = errors.find(e => e.id === errorId);
        if (error && error.type === errorType) {
          delete newAttempts[errorId];
        }
      });
      return newAttempts;
    });
  }, [errors]);

  /**
   * Check if an error can be retried
   */
  const canRetry = useCallback((errorId) => {
    const error = errors.find(e => e.id === errorId);
    if (!error) return false;

    const attempts = retryAttempts[errorId] || 0;
    const maxAttempts = MAX_RETRY_ATTEMPTS[error.type] || 1;
    
    return attempts < maxAttempts;
  }, [errors, retryAttempts]);

  /**
   * Retry an operation with exponential backoff
   */
  const retryOperation = useCallback(async (errorId, retryFunction) => {
    const error = errors.find(e => e.id === errorId);
    if (!error || !canRetry(errorId)) {
      return false;
    }

    const currentAttempts = retryAttempts[errorId] || 0;
    const newAttempts = currentAttempts + 1;

    // Update retry count
    setRetryAttempts(prev => ({
      ...prev,
      [errorId]: newAttempts
    }));

    try {
      // Add delay before retry (except for first retry)
      if (newAttempts > 1) {
        const delay = getRetryDelay(error.type, newAttempts);
        await new Promise(resolve => {
          retryTimeouts.current[errorId] = setTimeout(resolve, delay);
        });
      }

      // Attempt the retry
      const result = await retryFunction();
      
      // If successful, remove the error
      if (result) {
        removeError(errorId);
        return true;
      }
      
      return false;
    } catch (retryError) {
      console.error(`Retry attempt ${newAttempts} failed for error ${errorId}:`, retryError);
      
      // If we've exhausted retries, update the error with the latest failure
      if (newAttempts >= (MAX_RETRY_ATTEMPTS[error.type] || 1)) {
        setErrors(prev => prev.map(e => 
          e.id === errorId 
            ? { 
                ...e, 
                message: retryError.message || e.message,
                userFriendlyMessage: retryError.userFriendlyMessage || e.userFriendlyMessage,
                lastRetryError: retryError,
                retriesExhausted: true
              }
            : e
        ));
      }
      
      return false;
    }
  }, [errors, retryAttempts, canRetry, removeError]);

  /**
   * Get errors by type
   */
  const getErrorsByType = useCallback((errorType) => {
    return errors.filter(error => error.type === errorType);
  }, [errors]);

  /**
   * Get the most recent error of a specific type
   */
  const getLatestErrorOfType = useCallback((errorType) => {
    const typeErrors = getErrorsByType(errorType);
    return typeErrors.length > 0 ? typeErrors[typeErrors.length - 1] : null;
  }, [getErrorsByType]);

  /**
   * Check if there are any critical errors that should block operations
   */
  const hasCriticalErrors = useCallback(() => {
    const criticalTypes = [
      EncryptionErrorTypes.INITIALIZATION_FAILED,
      EncryptionErrorTypes.KEY_GENERATION_FAILED
    ];
    
    return errors.some(error => 
      criticalTypes.includes(error.type) && 
      (retryAttempts[error.id] || 0) >= (MAX_RETRY_ATTEMPTS[error.type] || 1)
    );
  }, [errors, retryAttempts]);

  /**
   * Get summary of current error state
   */
  const getErrorSummary = useCallback(() => {
    const summary = {
      total: errors.length,
      byType: {},
      critical: hasCriticalErrors(),
      canRetryAny: false
    };

    errors.forEach(error => {
      if (!summary.byType[error.type]) {
        summary.byType[error.type] = 0;
      }
      summary.byType[error.type]++;
      
      if (canRetry(error.id)) {
        summary.canRetryAny = true;
      }
    });

    return summary;
  }, [errors, hasCriticalErrors, canRetry]);

  /**
   * Auto-retry errors that are suitable for automatic retry
   */
  const autoRetryErrors = useCallback(async (retryFunctions) => {
    const autoRetryTypes = [
      EncryptionErrorTypes.KEY_EXCHANGE_FAILED,
      EncryptionErrorTypes.STORAGE_FAILED
    ];

    const autoRetryPromises = errors
      .filter(error => 
        autoRetryTypes.includes(error.type) && 
        canRetry(error.id) &&
        retryFunctions[error.type]
      )
      .map(error => 
        retryOperation(error.id, retryFunctions[error.type])
      );

    if (autoRetryPromises.length > 0) {
      const results = await Promise.allSettled(autoRetryPromises);
      const successCount = results.filter(result => 
        result.status === 'fulfilled' && result.value === true
      ).length;
      
      return successCount;
    }

    return 0;
  }, [errors, canRetry, retryOperation]);

  return {
    errors,
    retryAttempts,
    addError,
    removeError,
    clearErrors,
    clearErrorsOfType,
    canRetry,
    retryOperation,
    getErrorsByType,
    getLatestErrorOfType,
    hasCriticalErrors,
    getErrorSummary,
    autoRetryErrors
  };
}

export default useEncryptionErrors;