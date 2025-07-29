/**
 * EncryptionService - High-level message encryption orchestration service
 * Orchestrates complete encrypt/decrypt message flow with error handling and graceful degradation
 */

import CryptoService from './cryptoService';
import keyExchangeService from './keyExchangeService';
import keyStorageService from './keyStorageService';

// Encryption error types
export const EncryptionErrorTypes = {
  KEY_GENERATION_FAILED: 'key_generation_failed',
  ENCRYPTION_FAILED: 'encryption_failed',
  DECRYPTION_FAILED: 'decryption_failed',
  KEY_EXCHANGE_FAILED: 'key_exchange_failed',
  SIGNATURE_VERIFICATION_FAILED: 'signature_verification_failed',
  STORAGE_FAILED: 'storage_failed',
  INITIALIZATION_FAILED: 'initialization_failed'
};

// Encryption status interface
export const EncryptionStatus = {
  AVAILABLE: 'available',
  UNAVAILABLE: 'unavailable',
  INITIALIZING: 'initializing',
  ERROR: 'error'
};

class EncryptionService {
  constructor() {
    this.isInitialized = false;
    this.currentUserId = null;
    this.currentToken = null;
    this.lastError = null;
    this.keyGenerationTime = null;
    this.initializationPromise = null;
  }

  /**
   * Initialize encryption service for the current user
   * @param {string} userId - Current user ID
   * @param {string} token - Authentication token
   * @returns {Promise<boolean>} True if initialization successful
   */
  async initialize(userId, token) {
    try {
      // Prevent multiple simultaneous initializations
      if (this.initializationPromise) {
        return await this.initializationPromise;
      }

      this.initializationPromise = this._performInitialization(userId, token);
      const result = await this.initializationPromise;
      this.initializationPromise = null;
      
      return result;
    } catch (error) {
      this.initializationPromise = null;
      throw error;
    }
  }

  /**
   * Encrypt a message for sending to a specific recipient
   * @param {string} message - Plain text message to encrypt
   * @param {string} recipientUserId - Recipient's user ID
   * @returns {Promise<EncryptedMessageData>} Encrypted message data
   */
  async encryptMessage(message, recipientUserId) {
    try {
      if (!this.isEncryptionAvailable()) {
        throw new Error('Encryption not available');
      }

      if (!message || typeof message !== 'string') {
        throw new Error('Invalid message format');
      }

      if (!recipientUserId) {
        throw new Error('Recipient user ID is required');
      }

      // Get recipient's public key
      const recipientPublicKey = await this._getRecipientPublicKey(recipientUserId);
      
      // Generate AES key for this message
      const aesKey = await CryptoService.generateAESKey();
      
      // Encrypt message with AES-GCM
      const encryptedMessage = await CryptoService.encryptWithAES(message, aesKey);
      
      // Encrypt AES key with recipient's RSA public key
      const encryptedAESKey = await CryptoService.encryptWithRSA(aesKey, recipientPublicKey);
      
      // Sign the original message with our private key
      const myPrivateKey = await this._getMyPrivateKey();
      const signature = await CryptoService.signWithRSA(message, myPrivateKey);

      const encryptedData = {
        content: encryptedMessage.encryptedData,
        encrypted_aes_key: encryptedAESKey,
        iv: encryptedMessage.iv,
        signature: signature,
        is_encrypted: true,
        sender_id: this.currentUserId
      };

      this.lastError = null;
      return encryptedData;

    } catch (error) {
      console.error('Message encryption failed:', error);
      this.lastError = this._createErrorInfo(EncryptionErrorTypes.ENCRYPTION_FAILED, error);
      throw this.lastError;
    }
  }

  /**
   * Decrypt a received message
   * @param {EncryptedMessageData} encryptedData - Encrypted message data
   * @param {string} senderUserId - Sender's user ID for signature verification
   * @returns {Promise<string>} Decrypted plain text message
   */
  async decryptMessage(encryptedData, senderUserId) {
    try {
      if (!encryptedData) {
        throw new Error('No encrypted data provided');
      }

      // If message is not encrypted, return as-is
      if (!encryptedData.is_encrypted) {
        return encryptedData.content;
      }

      if (!this.isEncryptionAvailable()) {
        throw new Error('Encryption not available for decryption');
      }

      // Decrypt AES key with our private key
      const myPrivateKey = await this._getMyPrivateKey();
      const aesKey = await CryptoService.decryptWithRSA(
        encryptedData.encrypted_aes_key, 
        myPrivateKey
      );
      
      // Decrypt message content with AES key
      const decryptedMessage = await CryptoService.decryptWithAES(
        encryptedData.content,
        encryptedData.iv,
        aesKey
      );

      // Verify signature if available
      if (encryptedData.signature && senderUserId) {
        await this._verifyMessageSignature(decryptedMessage, encryptedData.signature, senderUserId);
      }

      this.lastError = null;
      return decryptedMessage;

    } catch (error) {
      console.error('Message decryption failed:', error);
      this.lastError = this._createErrorInfo(EncryptionErrorTypes.DECRYPTION_FAILED, error);
      throw this.lastError;
    }
  }

  /**
   * Check if encryption is available
   * @returns {boolean} True if encryption is available
   */
  isEncryptionAvailable() {
    return this.isInitialized && 
           this.currentUserId && 
           this.currentToken &&
           keyExchangeService.getMyPrivateKey() !== null;
  }

  /**
   * Get current encryption status
   * @returns {Object} Encryption status information
   */
  getEncryptionStatus() {
    const hasPrivateKey = keyExchangeService.getMyPrivateKey() !== null;
    const hasPublicKey = keyExchangeService.getMyPublicKey() !== null;

    let status = EncryptionStatus.UNAVAILABLE;
    if (this.initializationPromise) {
      status = EncryptionStatus.INITIALIZING;
    } else if (this.isEncryptionAvailable()) {
      status = EncryptionStatus.AVAILABLE;
    } else if (this.lastError) {
      status = EncryptionStatus.ERROR;
    }

    return {
      status,
      isAvailable: this.isEncryptionAvailable(),
      keysInitialized: hasPrivateKey && hasPublicKey,
      lastError: this.lastError,
      keyGenerationTime: this.keyGenerationTime,
      userId: this.currentUserId
    };
  }

  /**
   * Handle encryption errors with user-friendly messages
   * @param {Error} error - The error that occurred
   * @returns {Object} Error information object
   */
  handleEncryptionError(error) {
    return this._createErrorInfo(EncryptionErrorTypes.ENCRYPTION_FAILED, error);
  }

  /**
   * Clear encryption state and keys (for logout)
   * @returns {Promise<void>}
   */
  async clearEncryption() {
    try {
      if (this.currentUserId) {
        await keyStorageService.clearPrivateKey(this.currentUserId);
      }
      
      keyExchangeService.clearCache();
      
      this.isInitialized = false;
      this.currentUserId = null;
      this.currentToken = null;
      this.lastError = null;
      this.keyGenerationTime = null;
      
      console.log('Encryption state cleared');
    } catch (error) {
      console.error('Failed to clear encryption state:', error);
    }
  }

  /**
   * Refresh encryption keys (regenerate and re-upload)
   * @returns {Promise<boolean>} True if refresh successful
   */
  async refreshKeys() {
    try {
      if (!this.currentUserId || !this.currentToken) {
        throw new Error('User not initialized');
      }

      // Clear existing keys
      await keyStorageService.clearPrivateKey(this.currentUserId);
      keyExchangeService.clearCache();

      // Re-initialize with new keys
      return await this.initialize(this.currentUserId, this.currentToken);
    } catch (error) {
      console.error('Failed to refresh keys:', error);
      this.lastError = this._createErrorInfo(EncryptionErrorTypes.KEY_GENERATION_FAILED, error);
      return false;
    }
  }

  // Private helper methods

  /**
   * Perform the actual initialization process
   * @param {string} userId - User ID
   * @param {string} token - Authentication token
   * @returns {Promise<boolean>} True if successful
   */
  async _performInitialization(userId, token) {
    try {
      this.currentUserId = userId;
      this.currentToken = token;

      // Try to load existing private key from storage
      let privateKey = await keyStorageService.getPrivateKey(userId);
      let publicKey = null;

      if (privateKey) {
        // Validate existing key
        const isValid = await keyStorageService.validateStoredKey(userId);
        if (!isValid) {
          console.warn('Stored key is invalid, generating new keys');
          privateKey = null;
        }
      }

      if (!privateKey) {
        // Generate new key pair
        const keyPair = await CryptoService.generateRSAKeyPair();
        privateKey = keyPair.privateKey;
        publicKey = keyPair.publicKey;
        
        // Store private key securely
        await keyStorageService.storePrivateKey(userId, privateKey);
        
        this.keyGenerationTime = new Date();
      }

      // Initialize key exchange service
      await keyExchangeService.initializeKeys(userId, token);

      this.isInitialized = true;
      this.lastError = null;
      
      console.log('EncryptionService initialized successfully');
      return true;

    } catch (error) {
      console.error('EncryptionService initialization failed:', error);
      this.lastError = this._createErrorInfo(EncryptionErrorTypes.INITIALIZATION_FAILED, error);
      this.isInitialized = false;
      throw error;
    }
  }

  /**
   * Get recipient's public key with caching and error handling
   * @param {string} recipientUserId - Recipient's user ID
   * @returns {Promise<string>} Public key
   */
  async _getRecipientPublicKey(recipientUserId) {
    try {
      // Try to get from cache first
      let publicKey = await keyStorageService.getPublicKey(recipientUserId);
      
      if (!publicKey) {
        // Fetch from server
        publicKey = await keyExchangeService.getUserPublicKey(recipientUserId, this.currentToken);
        
        // Cache for future use
        await keyStorageService.storePublicKey(recipientUserId, publicKey);
      }

      return publicKey;
    } catch (error) {
      throw new Error(`Failed to get recipient public key: ${error.message}`);
    }
  }

  /**
   * Get current user's private key
   * @returns {Promise<string>} Private key
   */
  async _getMyPrivateKey() {
    const privateKey = keyExchangeService.getMyPrivateKey();
    if (!privateKey) {
      throw new Error('Private key not available');
    }
    return privateKey;
  }

  /**
   * Verify message signature
   * @param {string} message - Original message
   * @param {string} signature - Message signature
   * @param {string} senderUserId - Sender's user ID
   * @returns {Promise<boolean>} True if signature is valid
   */
  async _verifyMessageSignature(message, signature, senderUserId) {
    try {
      const senderPublicKey = await this._getRecipientPublicKey(senderUserId);
      const isValid = await CryptoService.verifyRSASignature(message, signature, senderPublicKey);
      
      if (!isValid) {
        console.warn(`Signature verification failed for message from ${senderUserId}`);
        this.lastError = this._createErrorInfo(EncryptionErrorTypes.SIGNATURE_VERIFICATION_FAILED, 
          new Error('Message signature verification failed'));
      }
      
      return isValid;
    } catch (error) {
      console.error('Signature verification error:', error);
      this.lastError = this._createErrorInfo(EncryptionErrorTypes.SIGNATURE_VERIFICATION_FAILED, error);
      return false;
    }
  }

  /**
   * Create standardized error information object
   * @param {string} type - Error type from EncryptionErrorTypes
   * @param {Error} error - Original error
   * @returns {Object} Error information object
   */
  _createErrorInfo(type, error) {
    return {
      type,
      message: error.message,
      timestamp: new Date(),
      userFriendlyMessage: this._getUserFriendlyErrorMessage(type, error)
    };
  }

  /**
   * Get user-friendly error message
   * @param {string} type - Error type
   * @param {Error} error - Original error
   * @returns {string} User-friendly error message
   */
  _getUserFriendlyErrorMessage(type, error) {
    switch (type) {
      case EncryptionErrorTypes.KEY_GENERATION_FAILED:
        return 'Failed to generate encryption keys. Please try again.';
      case EncryptionErrorTypes.ENCRYPTION_FAILED:
        return 'Failed to encrypt message. Please check your connection and try again.';
      case EncryptionErrorTypes.DECRYPTION_FAILED:
        return 'Unable to decrypt this message. It may be corrupted or sent with incompatible encryption.';
      case EncryptionErrorTypes.KEY_EXCHANGE_FAILED:
        return 'Failed to exchange encryption keys. Please refresh and try again.';
      case EncryptionErrorTypes.SIGNATURE_VERIFICATION_FAILED:
        return 'Message authenticity could not be verified. This message may not be from the claimed sender.';
      case EncryptionErrorTypes.STORAGE_FAILED:
        return 'Failed to store encryption keys securely. Please check your browser settings.';
      case EncryptionErrorTypes.INITIALIZATION_FAILED:
        return 'Failed to initialize encryption. Please refresh the page and try again.';
      default:
        return 'An encryption error occurred. Please try again.';
    }
  }
}

// Export singleton instance
const encryptionService = new EncryptionService();
export default encryptionService;