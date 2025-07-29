/**
 * KeyStorageService - Secure browser key storage with validation and corruption detection
 * Handles storing/retrieving private keys in localStorage/IndexedDB with security measures
 */

class KeyStorageService {
  constructor() {
    this.storagePrefix = 'e2e_encryption_';
    this.privateKeyKey = 'private_key';
    this.publicKeyKey = 'public_key';
    this.keyVersionKey = 'key_version';
    this.keyTimestampKey = 'key_timestamp';
  }

  /**
   * Store private key securely in browser storage
   * @param {string} userId - User ID
   * @param {string} privateKey - RSA private key in PEM format
   * @returns {Promise<void>}
   */
  async storePrivateKey(userId, privateKey) {
    try {
      if (!userId || !privateKey) {
        throw new Error('User ID and private key are required');
      }

      // Validate private key format
      if (!this._isValidPrivateKey(privateKey)) {
        throw new Error('Invalid private key format');
      }

      const keyData = {
        privateKey,
        timestamp: Date.now(),
        version: 1,
        userId
      };

      // Store in localStorage with user-specific key
      const storageKey = this._getStorageKey(userId, this.privateKeyKey);
      localStorage.setItem(storageKey, JSON.stringify(keyData));

      console.log(`Private key stored successfully for user ${userId}`);
    } catch (error) {
      console.error('Failed to store private key:', error);
      throw new Error(`Failed to store private key: ${error.message}`);
    }
  }

  /**
   * Retrieve private key from browser storage
   * @param {string} userId - User ID
   * @returns {Promise<string|null>} Private key or null if not found
   */
  async getPrivateKey(userId) {
    try {
      if (!userId) {
        throw new Error('User ID is required');
      }

      const storageKey = this._getStorageKey(userId, this.privateKeyKey);
      const storedData = localStorage.getItem(storageKey);

      if (!storedData) {
        return null;
      }

      const keyData = JSON.parse(storedData);

      // Validate stored data structure
      if (!keyData.privateKey || !keyData.timestamp || !keyData.userId) {
        console.warn('Corrupted key data detected, clearing storage');
        await this.clearPrivateKey(userId);
        return null;
      }

      // Validate that the stored key belongs to the correct user
      if (keyData.userId !== userId) {
        console.warn('Key user ID mismatch, clearing storage');
        await this.clearPrivateKey(userId);
        return null;
      }

      // Validate private key format
      if (!this._isValidPrivateKey(keyData.privateKey)) {
        console.warn('Corrupted private key detected, clearing storage');
        await this.clearPrivateKey(userId);
        return null;
      }

      return keyData.privateKey;
    } catch (error) {
      console.error('Failed to retrieve private key:', error);
      // If there's an error parsing or accessing the key, clear it
      await this.clearPrivateKey(userId);
      return null;
    }
  }

  /**
   * Clear private key from browser storage
   * @param {string} userId - User ID
   * @returns {Promise<void>}
   */
  async clearPrivateKey(userId) {
    try {
      if (!userId) {
        throw new Error('User ID is required');
      }

      const storageKey = this._getStorageKey(userId, this.privateKeyKey);
      localStorage.removeItem(storageKey);

      console.log(`Private key cleared for user ${userId}`);
    } catch (error) {
      console.error('Failed to clear private key:', error);
      throw new Error(`Failed to clear private key: ${error.message}`);
    }
  }

  /**
   * Validate stored key integrity and format
   * @param {string} userId - User ID
   * @returns {Promise<boolean>} True if key is valid, false otherwise
   */
  async validateStoredKey(userId) {
    try {
      const privateKey = await this.getPrivateKey(userId);
      
      if (!privateKey) {
        return false;
      }

      // Additional validation: try to use the key for a test operation
      return await this._testKeyFunctionality(privateKey);
    } catch (error) {
      console.error('Key validation failed:', error);
      return false;
    }
  }

  /**
   * Clear all encryption keys from browser storage
   * @returns {Promise<void>}
   */
  async clearAllKeys() {
    try {
      // Get all localStorage keys that match our prefix
      const keysToRemove = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(this.storagePrefix)) {
          keysToRemove.push(key);
        }
      }

      // Remove all matching keys
      keysToRemove.forEach(key => {
        localStorage.removeItem(key);
      });

      console.log(`Cleared ${keysToRemove.length} encryption keys from storage`);
    } catch (error) {
      console.error('Failed to clear all keys:', error);
      throw new Error(`Failed to clear all keys: ${error.message}`);
    }
  }

  /**
   * Get storage information and statistics
   * @returns {Object} Storage information
   */
  getStorageInfo() {
    try {
      const info = {
        storageType: 'localStorage',
        totalKeys: 0,
        encryptionKeys: 0,
        storageUsed: 0,
        isAvailable: this._isStorageAvailable()
      };

      // Count keys and calculate storage usage
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key) {
          info.totalKeys++;
          const value = localStorage.getItem(key);
          info.storageUsed += key.length + (value ? value.length : 0);

          if (key.startsWith(this.storagePrefix)) {
            info.encryptionKeys++;
          }
        }
      }

      return info;
    } catch (error) {
      console.error('Failed to get storage info:', error);
      return {
        storageType: 'localStorage',
        totalKeys: 0,
        encryptionKeys: 0,
        storageUsed: 0,
        isAvailable: false,
        error: error.message
      };
    }
  }

  /**
   * Store public key for caching purposes
   * @param {string} userId - User ID
   * @param {string} publicKey - RSA public key in PEM format
   * @returns {Promise<void>}
   */
  async storePublicKey(userId, publicKey) {
    try {
      if (!userId || !publicKey) {
        throw new Error('User ID and public key are required');
      }

      const keyData = {
        publicKey,
        timestamp: Date.now(),
        userId
      };

      const storageKey = this._getStorageKey(userId, this.publicKeyKey);
      localStorage.setItem(storageKey, JSON.stringify(keyData));
    } catch (error) {
      console.error('Failed to store public key:', error);
      // Don't throw error for public key storage failures
    }
  }

  /**
   * Retrieve cached public key
   * @param {string} userId - User ID
   * @returns {Promise<string|null>} Public key or null if not found
   */
  async getPublicKey(userId) {
    try {
      if (!userId) {
        return null;
      }

      const storageKey = this._getStorageKey(userId, this.publicKeyKey);
      const storedData = localStorage.getItem(storageKey);

      if (!storedData) {
        return null;
      }

      const keyData = JSON.parse(storedData);
      return keyData.publicKey || null;
    } catch (error) {
      console.error('Failed to retrieve public key:', error);
      return null;
    }
  }

  // Private helper methods

  /**
   * Generate storage key with prefix and user ID
   * @param {string} userId - User ID
   * @param {string} keyType - Type of key (private_key, public_key, etc.)
   * @returns {string} Storage key
   */
  _getStorageKey(userId, keyType) {
    return `${this.storagePrefix}${userId}_${keyType}`;
  }

  /**
   * Validate private key format (basic PEM format check)
   * @param {string} privateKey - Private key to validate
   * @returns {boolean} True if valid format
   */
  _isValidPrivateKey(privateKey) {
    if (!privateKey || typeof privateKey !== 'string') {
      return false;
    }

    // Check for basic RSA private key PEM format
    const pemRegex = /^-----BEGIN RSA PRIVATE KEY-----[\s\S]*-----END RSA PRIVATE KEY-----$/;
    return pemRegex.test(privateKey.trim());
  }

  /**
   * Test key functionality by performing a simple operation
   * @param {string} privateKey - Private key to test
   * @returns {Promise<boolean>} True if key works
   */
  async _testKeyFunctionality(privateKey) {
    try {
      // Import CryptoService dynamically to avoid circular dependencies
      const CryptoService = (await import('./cryptoService')).default;
      
      // Try to generate a signature with the private key
      const testData = 'test_key_validation';
      const signature = await CryptoService.signWithRSA(testData, privateKey);
      
      // If we got a signature, the key is functional
      return !!signature;
    } catch (error) {
      console.warn('Key functionality test failed:', error);
      return false;
    }
  }

  /**
   * Check if localStorage is available
   * @returns {boolean} True if storage is available
   */
  _isStorageAvailable() {
    try {
      const test = '__storage_test__';
      localStorage.setItem(test, test);
      localStorage.removeItem(test);
      return true;
    } catch (error) {
      return false;
    }
  }
}

// Export singleton instance
const keyStorageService = new KeyStorageService();
export default keyStorageService;