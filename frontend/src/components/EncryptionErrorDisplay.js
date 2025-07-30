"use client"
import React, { useState } from 'react';
import { AlertTriangle, RefreshCw, X, Lock, LockOpen, Shield, AlertCircle, Info } from 'lucide-react';
import { clsx } from 'clsx';
import { EncryptionErrorTypes } from '../services/encryptionService';

/**
 * EncryptionErrorDisplay - Component for displaying encryption-related errors
 * with user-friendly messages and retry mechanisms
 */
export default function EncryptionErrorDisplay({ 
  error, 
  onRetry, 
  onDismiss, 
  showRetry = true,
  compact = false,
  className = ""
}) {
  const [isRetrying, setIsRetrying] = useState(false);

  if (!error) return null;

  const handleRetry = async () => {
    if (!onRetry || isRetrying) return;
    
    setIsRetrying(true);
    try {
      await onRetry();
    } catch (retryError) {
      console.error('Retry failed:', retryError);
    } finally {
      setIsRetrying(false);
    }
  };

  const getErrorIcon = (errorType) => {
    switch (errorType) {
      case EncryptionErrorTypes.KEY_GENERATION_FAILED:
      case EncryptionErrorTypes.INITIALIZATION_FAILED:
        return <Shield className="w-4 h-4" />;
      case EncryptionErrorTypes.ENCRYPTION_FAILED:
        return <Lock className="w-4 h-4" />;
      case EncryptionErrorTypes.DECRYPTION_FAILED:
        return <LockOpen className="w-4 h-4" />;
      case EncryptionErrorTypes.KEY_EXCHANGE_FAILED:
        return <RefreshCw className="w-4 h-4" />;
      case EncryptionErrorTypes.SIGNATURE_VERIFICATION_FAILED:
        return <AlertTriangle className="w-4 h-4" />;
      default:
        return <AlertCircle className="w-4 h-4" />;
    }
  };

  const getErrorSeverity = (errorType) => {
    switch (errorType) {
      case EncryptionErrorTypes.SIGNATURE_VERIFICATION_FAILED:
        return 'warning';
      case EncryptionErrorTypes.DECRYPTION_FAILED:
      case EncryptionErrorTypes.ENCRYPTION_FAILED:
      case EncryptionErrorTypes.KEY_GENERATION_FAILED:
      case EncryptionErrorTypes.INITIALIZATION_FAILED:
        return 'error';
      case EncryptionErrorTypes.KEY_EXCHANGE_FAILED:
      case EncryptionErrorTypes.STORAGE_FAILED:
        return 'warning';
      default:
        return 'error';
    }
  };

  const getErrorColors = (severity) => {
    switch (severity) {
      case 'warning':
        return {
          bg: 'bg-yellow-50',
          border: 'border-yellow-200',
          text: 'text-yellow-800',
          icon: 'text-yellow-600',
          button: 'bg-yellow-100 hover:bg-yellow-200 text-yellow-800'
        };
      case 'error':
        return {
          bg: 'bg-red-50',
          border: 'border-red-200',
          text: 'text-red-800',
          icon: 'text-red-600',
          button: 'bg-red-100 hover:bg-red-200 text-red-800'
        };
      default:
        return {
          bg: 'bg-gray-50',
          border: 'border-gray-200',
          text: 'text-gray-800',
          icon: 'text-gray-600',
          button: 'bg-gray-100 hover:bg-gray-200 text-gray-800'
        };
    }
  };

  const getRetryText = (errorType) => {
    switch (errorType) {
      case EncryptionErrorTypes.KEY_GENERATION_FAILED:
      case EncryptionErrorTypes.INITIALIZATION_FAILED:
        return 'Retry Setup';
      case EncryptionErrorTypes.ENCRYPTION_FAILED:
        return 'Retry Encryption';
      case EncryptionErrorTypes.DECRYPTION_FAILED:
        return 'Retry Decryption';
      case EncryptionErrorTypes.KEY_EXCHANGE_FAILED:
        return 'Retry Key Exchange';
      case EncryptionErrorTypes.SIGNATURE_VERIFICATION_FAILED:
        return 'Verify Again';
      default:
        return 'Retry';
    }
  };

  const getAdditionalInfo = (errorType) => {
    switch (errorType) {
      case EncryptionErrorTypes.SIGNATURE_VERIFICATION_FAILED:
        return "The message was decrypted successfully, but we couldn't verify the sender's identity. This could mean the message was tampered with or sent from a different device.";
      case EncryptionErrorTypes.DECRYPTION_FAILED:
        return "This message couldn't be decrypted. It may have been sent with incompatible encryption or the data may be corrupted.";
      case EncryptionErrorTypes.KEY_EXCHANGE_FAILED:
        return "We couldn't get the encryption keys needed to secure your messages. Check your internet connection and try again.";
      case EncryptionErrorTypes.KEY_GENERATION_FAILED:
        return "Failed to generate encryption keys for your account. This is needed to secure your messages.";
      case EncryptionErrorTypes.ENCRYPTION_FAILED:
        return "Your message couldn't be encrypted before sending. For security, the message was not sent.";
      case EncryptionErrorTypes.INITIALIZATION_FAILED:
        return "Encryption setup failed. You can still send messages, but they won't be encrypted.";
      default:
        return null;
    }
  };

  const severity = getErrorSeverity(error.type);
  const colors = getErrorColors(severity);
  const icon = getErrorIcon(error.type);
  const additionalInfo = getAdditionalInfo(error.type);

  if (compact) {
    return (
      <div className={clsx(
        "flex items-center space-x-2 px-3 py-2 rounded-md text-sm",
        colors.bg,
        colors.border,
        colors.text,
        "border",
        className
      )}>
        <div className={colors.icon}>
          {icon}
        </div>
        <span className="flex-1 min-w-0 truncate">
          {error.userFriendlyMessage || error.message}
        </span>
        {showRetry && onRetry && (
          <button
            onClick={handleRetry}
            disabled={isRetrying}
            className={clsx(
              "px-2 py-1 rounded text-xs font-medium transition-colors",
              colors.button,
              isRetrying && "opacity-50 cursor-not-allowed"
            )}
          >
            {isRetrying ? (
              <div className="flex items-center space-x-1">
                <div className="animate-spin rounded-full h-3 w-3 border-b border-current"></div>
                <span>Retrying...</span>
              </div>
            ) : (
              getRetryText(error.type)
            )}
          </button>
        )}
        {onDismiss && (
          <button
            onClick={onDismiss}
            className={clsx("hover:opacity-70 transition-opacity", colors.icon)}
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
    );
  }

  return (
    <div className={clsx(
      "rounded-lg border p-4",
      colors.bg,
      colors.border,
      className
    )}>
      <div className="flex items-start space-x-3">
        <div className={clsx("flex-shrink-0 mt-0.5", colors.icon)}>
          {icon}
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <h4 className={clsx("text-sm font-medium", colors.text)}>
                {error.userFriendlyMessage || error.message}
              </h4>
              
              {additionalInfo && (
                <div className={clsx("mt-2 text-sm opacity-90", colors.text)}>
                  <div className="flex items-start space-x-2">
                    <Info className="w-4 h-4 flex-shrink-0 mt-0.5 opacity-70" />
                    <p>{additionalInfo}</p>
                  </div>
                </div>
              )}
              
              {process.env.NODE_ENV === 'development' && error.message !== error.userFriendlyMessage && (
                <details className={clsx("mt-2 text-xs opacity-75", colors.text)}>
                  <summary className="cursor-pointer hover:opacity-100">
                    Technical Details
                  </summary>
                  <pre className="mt-1 p-2 bg-black bg-opacity-10 rounded text-xs overflow-auto">
                    {error.message}
                    {error.timestamp && `\nTime: ${new Date(error.timestamp).toLocaleString()}`}
                  </pre>
                </details>
              )}
            </div>
            
            {onDismiss && (
              <button
                onClick={onDismiss}
                className={clsx(
                  "flex-shrink-0 ml-3 hover:opacity-70 transition-opacity",
                  colors.icon
                )}
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          
          {showRetry && onRetry && (
            <div className="mt-3 flex items-center space-x-2">
              <button
                onClick={handleRetry}
                disabled={isRetrying}
                className={clsx(
                  "inline-flex items-center px-3 py-1.5 rounded-md text-sm font-medium transition-colors",
                  colors.button,
                  isRetrying && "opacity-50 cursor-not-allowed"
                )}
              >
                {isRetrying ? (
                  <>
                    <div className="animate-spin rounded-full h-3 w-3 border-b border-current mr-2"></div>
                    Retrying...
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-3 h-3 mr-2" />
                    {getRetryText(error.type)}
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * EncryptionErrorBanner - Compact banner for displaying encryption errors
 */
export function EncryptionErrorBanner({ error, onRetry, onDismiss, className = "" }) {
  return (
    <EncryptionErrorDisplay
      error={error}
      onRetry={onRetry}
      onDismiss={onDismiss}
      compact={true}
      className={className}
    />
  );
}

/**
 * EncryptionErrorModal - Modal dialog for critical encryption errors
 */
export function EncryptionErrorModal({ 
  error, 
  isOpen, 
  onRetry, 
  onDismiss, 
  onClose,
  title = "Encryption Error"
}) {
  if (!isOpen || !error) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
        <div className="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75" onClick={onClose}></div>
        
        <div className="inline-block w-full max-w-md p-6 my-8 overflow-hidden text-left align-middle transition-all transform bg-white shadow-xl rounded-lg">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-medium text-gray-900">
              {title}
            </h3>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          
          <EncryptionErrorDisplay
            error={error}
            onRetry={onRetry}
            onDismiss={onDismiss}
            showRetry={true}
            className="mb-4"
          />
          
          <div className="flex justify-end space-x-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}