"use client"
import React from 'react';
import { Shield, AlertTriangle, RefreshCw, Settings } from 'lucide-react';
import { EncryptionErrorTypes } from '../services/encryptionService';
import EncryptionErrorDisplay from './EncryptionErrorDisplay';

/**
 * EncryptionErrorBoundary - Specialized error boundary for encryption-related errors
 * Provides graceful degradation and recovery options for encryption failures
 */
class EncryptionErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      isRecovering: false,
      showFallbackMode: false
    };
  }

  static getDerivedStateFromError(error) {
    // Check if this is an encryption-related error
    const isEncryptionError = error.type && Object.values(EncryptionErrorTypes).includes(error.type);
    
    return {
      hasError: true,
      isEncryptionError
    };
  }

  componentDidCatch(error, errorInfo) {
    this.setState({
      error: error,
      errorInfo: errorInfo
    });

    // Log encryption errors with additional context
    console.error('Encryption Error Boundary caught error:', {
      error,
      errorInfo,
      isEncryptionError: this.state.isEncryptionError,
      timestamp: new Date().toISOString()
    });

    // In production, report encryption errors to monitoring service
    if (process.env.NODE_ENV === 'production' && this.state.isEncryptionError) {
      // reportEncryptionError(error, errorInfo);
    }
  }

  handleRetry = async () => {
    this.setState({ isRecovering: true });
    
    try {
      // Clear the error state and attempt recovery
      await new Promise(resolve => setTimeout(resolve, 1000)); // Brief delay
      
      this.setState({
        hasError: false,
        error: null,
        errorInfo: null,
        isRecovering: false
      });
    } catch (recoveryError) {
      console.error('Recovery failed:', recoveryError);
      this.setState({ isRecovering: false });
    }
  };

  handleFallbackMode = () => {
    this.setState({ showFallbackMode: true });
    
    // Notify parent component about fallback mode if callback provided
    if (this.props.onFallbackMode) {
      this.props.onFallbackMode();
    }
  };

  handleClearEncryption = async () => {
    try {
      // Clear encryption state and continue without encryption
      if (this.props.onClearEncryption) {
        await this.props.onClearEncryption();
      }
      
      this.setState({
        hasError: false,
        error: null,
        errorInfo: null,
        showFallbackMode: true
      });
    } catch (error) {
      console.error('Failed to clear encryption:', error);
    }
  };

  getErrorSeverity = (error) => {
    if (!error || !error.type) return 'error';
    
    const criticalErrors = [
      EncryptionErrorTypes.INITIALIZATION_FAILED,
      EncryptionErrorTypes.KEY_GENERATION_FAILED
    ];
    
    return criticalErrors.includes(error.type) ? 'critical' : 'error';
  };

  renderEncryptionError = () => {
    const { error } = this.state;
    const severity = this.getErrorSeverity(error);
    const isCritical = severity === 'critical';

    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="max-w-lg w-full">
          <div className="bg-white rounded-lg shadow-lg p-8">
            <div className="text-center mb-6">
              <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 ${
                isCritical ? 'bg-red-100' : 'bg-yellow-100'
              }`}>
                <Shield className={`w-8 h-8 ${
                  isCritical ? 'text-red-600' : 'text-yellow-600'
                }`} />
              </div>
              
              <h1 className="text-xl font-semibold text-gray-900 mb-2">
                {isCritical ? 'Encryption Setup Failed' : 'Encryption Error'}
              </h1>
              
              <p className="text-gray-600 mb-6">
                {isCritical 
                  ? 'We couldn\'t set up encryption for your messages. You can continue without encryption or try again.'
                  : 'An encryption error occurred, but you can continue chatting.'
                }
              </p>
            </div>

            {/* Error Details */}
            <div className="mb-6">
              <EncryptionErrorDisplay
                error={error}
                onRetry={this.handleRetry}
                showRetry={!this.state.isRecovering}
                className="mb-4"
              />
            </div>

            {/* Action Buttons */}
            <div className="space-y-3">
              {!this.state.showFallbackMode && (
                <button
                  onClick={this.handleRetry}
                  disabled={this.state.isRecovering}
                  className="w-full flex items-center justify-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {this.state.isRecovering ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Retrying...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="w-4 h-4 mr-2" />
                      Try Again
                    </>
                  )}
                </button>
              )}
              
              <button
                onClick={this.handleFallbackMode}
                className="w-full flex items-center justify-center px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors"
              >
                <AlertTriangle className="w-4 h-4 mr-2" />
                Continue Without Encryption
              </button>
              
              {isCritical && (
                <button
                  onClick={this.handleClearEncryption}
                  className="w-full flex items-center justify-center px-4 py-2 bg-yellow-600 text-white rounded-md hover:bg-yellow-700 transition-colors"
                >
                  <Settings className="w-4 h-4 mr-2" />
                  Reset Encryption Settings
                </button>
              )}
            </div>

            {/* Development Error Details */}
            {process.env.NODE_ENV === 'development' && error && (
              <details className="mt-6 bg-gray-50 border border-gray-200 rounded-md p-4">
                <summary className="cursor-pointer text-sm font-medium text-gray-700 mb-2">
                  Development Error Details
                </summary>
                <pre className="text-xs text-gray-600 overflow-auto max-h-32 whitespace-pre-wrap">
                  {error.toString()}
                  {this.state.errorInfo?.componentStack}
                </pre>
              </details>
            )}
          </div>
        </div>
      </div>
    );
  };

  renderGenericError = () => {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="max-w-md w-full text-center">
          <div className="bg-white rounded-lg shadow-lg p-8">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="w-8 h-8 text-red-600" />
            </div>
            
            <h1 className="text-xl font-semibold text-gray-900 mb-2">
              Something went wrong
            </h1>
            
            <p className="text-gray-600 mb-6">
              An unexpected error occurred. Please try refreshing the page.
            </p>

            <div className="flex flex-col gap-3">
              <button
                onClick={this.handleRetry}
                disabled={this.state.isRecovering}
                className="flex items-center justify-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {this.state.isRecovering ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Retrying...
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Try Again
                  </>
                )}
              </button>
              
              <button
                onClick={() => window.location.reload()}
                className="flex items-center justify-center px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Refresh Page
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  render() {
    if (this.state.hasError) {
      // Show fallback mode if requested
      if (this.state.showFallbackMode) {
        return (
          <div className="bg-yellow-50 border-b border-yellow-200 p-3">
            <div className="flex items-center justify-center space-x-2 text-yellow-800">
              <AlertTriangle className="w-4 h-4" />
              <span className="text-sm font-medium">
                Running in fallback mode - encryption disabled
              </span>
            </div>
            {this.props.children}
          </div>
        );
      }

      // Render appropriate error UI based on error type
      return this.state.isEncryptionError 
        ? this.renderEncryptionError()
        : this.renderGenericError();
    }

    return this.props.children;
  }
}

export default EncryptionErrorBoundary;