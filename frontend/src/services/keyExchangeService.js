/**
 * KeyExchangeService - Handles RSA key exchange and management with enhanced validation and caching
 */

class KeyExchangeService {
  constructor() {
    this.userKeys = new Map(); // Cache for user public keys with metadata
    this.keyVersions = new Map(); // Track key versions for rotation
    this.myPrivateKey = null;
    this.myPublicKey = null;
    this.myKeyVersion = 1;
    this.cacheExpiry = 30 * 60 * 1000; // 30 minutes cache expiry
    this.maxRetries = 3;
    this.BACKEND_URL = "http://localhost:5000";
  }
  /**
   * Initialize user's key pair and upload public key to server with validation and storage
   */
  async initializeKeys(userId, token) {
    console.log('🔄 [KEY_INIT] Starting key initialization for user:', userId);

    try {
      // First try to load existing keys from storage
      console.log('🔄 [KEY_INIT] 🔍 Checking for existing keys in storage...');
      const keyStorageService = (await import("./keyStorageService.js")).default;
      const existingPrivateKey = await keyStorageService.getPrivateKey(userId);

      if (existingPrivateKey && await this.validateKeyPair(null, existingPrivateKey)) {
        console.log('🔄 [KEY_INIT] ✅ Found valid existing private key');
        // Use existing valid keys
        this.myPrivateKey = existingPrivateKey;

        // Try to get the corresponding public key from server
        console.log('🔄 [KEY_INIT] 🌐 Fetching corresponding public key from server...');
        try {
          const serverKeyData = await this._fetchUserKeyFromServer(userId, token);
          if (serverKeyData && await this._validateKeyPairMatch(serverKeyData.public_key, existingPrivateKey)) {
            this.myPublicKey = serverKeyData.public_key;
            this.myKeyVersion = serverKeyData.key_version || 1;
            console.log('🔄 [KEY_INIT] ✅ Existing keys loaded and validated successfully');
            console.log('🔄 [KEY_INIT] 🔑 Public key retrieved from server');
            return true;
          }
        } catch (error) {
          console.warn('🔄 [KEY_INIT] ⚠️ Failed to validate existing keys with server, generating new ones:', error);
        }
      } else {
        console.log('🔄 [KEY_INIT] ℹ️ No valid existing keys found');
      }

      // Generate new RSA key pair with retry logic
      console.log('🔄 [KEY_INIT] 🔑 Generating new RSA-2048 key pair...');
      let keyPair;
      let retryCount = 0;

      while (retryCount < this.maxRetries) {
        try {
          const CryptoService = (await import("./cryptoService.js")).default;
          keyPair = await CryptoService.generateRSAKeyPair();
          console.log('🔄 [KEY_INIT] ✅ RSA key pair generated, validating...');

          // Validate the generated key pair
          if (await this.validateKeyPair(keyPair.publicKey, keyPair.privateKey)) {
            console.log('🔄 [KEY_INIT] ✅ Key pair validation successful');
            break;
          } else {
            throw new Error("Generated key pair validation failed");
          }
        } catch (error) {
          retryCount++;
          if (retryCount >= this.maxRetries) {
            throw new Error(`Failed to generate valid key pair after ${this.maxRetries} attempts: ${error.message}`);
          }
          console.warn(`🔄 [KEY_INIT] ⚠️ Key generation attempt ${retryCount} failed, retrying...`);
          await this._delay(1000 * retryCount); // Exponential backoff
        }
      }

      this.myPrivateKey = keyPair.privateKey;
      this.myPublicKey = keyPair.publicKey;
      this.myKeyVersion = Date.now(); // Use timestamp as version

      // Store private key securely
      console.log('🔄 [KEY_INIT] 💾 Storing private key securely in browser...');
      await keyStorageService.storePrivateKey(userId, this.myPrivateKey);
      console.log('🔄 [KEY_INIT] ✅ Private key stored securely');

      // Upload public key to server with version
      console.log('🔄 [KEY_INIT] 📤 Uploading public key to server...');
      const response = await fetch(
        `${this.BACKEND_URL}/api/users/${userId}/public-key`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            public_key: this.myPublicKey,
            key_version: this.myKeyVersion,
          }),
        }
      );

      if (!response.ok) {
        console.error('🔄 [KEY_INIT] ❌ Failed to upload public key to server');
        throw new Error("Failed to upload public key");
      }

      console.log('🔄 [KEY_INIT] ✅ Public key uploaded to server successfully');
      console.log('🔄 [KEY_INIT] 🎉 Keys initialized, validated, and uploaded successfully!');
      return true;
    } catch (error) {
      console.error('🔄 [KEY_INIT] ❌ Failed to initialize keys:', error);
      throw error;
    }
  }

  /**
   * Get public key for a specific user - ALWAYS fetch fresh from server (no caching)
   */
  async getUserPublicKey(userId, token) {
    console.log('📥 [KEY_FETCH] Fetching FRESH public key for user:', userId);

    try {
      // ALWAYS fetch fresh from server to avoid stale key issues
      console.log('📥 [KEY_FETCH] 🌐 Fetching fresh public key from server (bypassing cache)...');

      // Fetch from server with retry logic
      let retryCount = 0;
      let keyData;

      while (retryCount < this.maxRetries) {
        try {
          keyData = await this._fetchUserKeyFromServer(userId, token);
          console.log('📥 [KEY_FETCH] ✅ Fresh public key received from server');
          break;
        } catch (error) {
          retryCount++;
          if (retryCount >= this.maxRetries) {
            throw error;
          }
          console.warn(`📥 [KEY_FETCH] ⚠️ Fetch attempt ${retryCount} failed for user ${userId}, retrying...`);
          await this._delay(1000 * retryCount);
        }
      }

      if (!keyData || !keyData.public_key) {
        console.error('📥 [KEY_FETCH] ❌ Invalid key data received from server');
        throw new Error("Invalid key data received from server");
      }

      // Validate the public key format
      console.log('📥 [KEY_FETCH] 🔍 Validating public key format...');
      if (!this._isValidPublicKey(keyData.public_key)) {
        console.error('📥 [KEY_FETCH] ❌ Invalid public key format received from server');
        throw new Error("Invalid public key format received from server");
      }
      console.log('📥 [KEY_FETCH] ✅ Public key format validation passed');
      console.log('📥 [KEY_FETCH] 🔑 Key version:', keyData.key_version || 1);

      // Still update cache for reference but don't rely on it
      this.userKeys.set(userId, {
        publicKey: keyData.public_key,
        keyVersion: keyData.key_version || 1,
        timestamp: Date.now(),
        userId: userId
      });

      this.keyVersions.set(userId, keyData.key_version || 1);
      console.log('📥 [KEY_FETCH] ✅ Fresh public key obtained successfully');

      return keyData.public_key;
    } catch (error) {
      console.error('📥 [KEY_FETCH] ❌ Failed to get user public key:', error);
      throw error;
    }
  }

  /**
   * Get all public keys for users in a room (simplified for general room)
   */
  async getRoomUserKeys(roomUsers, token) {
    const keys = {};

    for (const userId of roomUsers) {
      try {
        keys[userId] = await this.getUserPublicKey(userId, token);
      } catch (error) {
        console.warn(`Failed to get key for user ${userId}:`, error);
      }
    }

    return keys;
  }

  /**
   * Get my private key
   */
  getMyPrivateKey() {
    return this.myPrivateKey;
  }

  /**
   * Get my public key
   */
  getMyPublicKey() {
    return this.myPublicKey;
  }

  /**
   * Refresh user's public key from server and update cache
   */
  async refreshUserKey(userId, token) {
    try {
      // Remove from cache to force fresh fetch
      this.userKeys.delete(userId);
      this.keyVersions.delete(userId);

      // Fetch fresh key from server
      const publicKey = await this.getUserPublicKey(userId, token);

      console.log(`Refreshed public key for user ${userId}`);
      return publicKey;
    } catch (error) {
      console.error(`Failed to refresh key for user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Validate RSA key pair functionality
   */
  async validateKeyPair(publicKey, privateKey) {
    try {
      if (!privateKey) {
        return false;
      }

      // Basic format validation
      if (!this._isValidPrivateKey(privateKey)) {
        return false;
      }

      if (publicKey && !this._isValidPublicKey(publicKey)) {
        return false;
      }

      // Functional validation - test encryption/decryption
      const CryptoService = (await import("./cryptoService.js")).default;
      const testData = "key_validation_test_" + Date.now();

      try {
        // Test signing with private key
        const signature = await CryptoService.signWithRSA(testData, privateKey);
        if (!signature) {
          return false;
        }

        // If we have the public key, test the full cycle
        if (publicKey) {
          // Test signature verification
          const isValidSignature = await CryptoService.verifyRSASignature(testData, signature, publicKey);
          if (!isValidSignature) {
            return false;
          }

          // Test encryption/decryption cycle
          const encrypted = await CryptoService.encryptWithRSA(testData, publicKey);
          const decrypted = await CryptoService.decryptWithRSA(encrypted, privateKey);

          if (decrypted !== testData) {
            return false;
          }
        }

        return true;
      } catch (error) {
        console.warn("Key pair functional validation failed:", error);
        return false;
      }
    } catch (error) {
      console.error("Key pair validation error:", error);
      return false;
    }
  }

  /**
   * Check if user's key needs rotation based on version or corruption
   */
  async checkKeyRotationNeeded(userId, token) {
    try {
      // Get current server key version
      const serverKeyData = await this._fetchUserKeyFromServer(userId, token);
      const serverVersion = serverKeyData?.key_version || 1;

      // Get cached version
      const cachedVersion = this.keyVersions.get(userId) || 1;

      // Check if server has newer version
      if (serverVersion > cachedVersion) {
        console.log(`Key rotation needed for user ${userId}: server version ${serverVersion} > cached version ${cachedVersion}`);
        return true;
      }

      // Check if cached key is corrupted
      const cachedData = this.userKeys.get(userId);
      if (cachedData && !this._isValidPublicKey(cachedData.publicKey)) {
        console.log(`Key rotation needed for user ${userId}: cached key is corrupted`);
        return true;
      }

      return false;
    } catch (error) {
      console.warn(`Failed to check key rotation for user ${userId}:`, error);
      return true; // Assume rotation needed if we can't check
    }
  }

  /**
   * Rotate keys for current user (generate new key pair and upload)
   */
  async rotateMyKeys(userId, token) {
    try {
      console.log(`Starting key rotation for user ${userId}`);

      // Clear existing keys
      this.myPrivateKey = null;
      this.myPublicKey = null;

      // Clear from storage
      const keyStorageService = (await import("./keyStorageService.js")).default;
      await keyStorageService.clearPrivateKey(userId);

      // Generate new keys (this will automatically store and upload them)
      await this.initializeKeys(userId, token);

      console.log(`Key rotation completed for user ${userId}`);
      return true;
    } catch (error) {
      console.error(`Failed to rotate keys for user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Clear all cached keys and versions
   */
  clearCache() {
    this.userKeys.clear();
    this.keyVersions.clear();
  }

  /**
   * Clear all keys including stored private keys
   */
  async clearAllKeys() {
    try {
      // Clear memory cache
      this.clearCache();

      // Clear stored keys
      const keyStorageService = (await import("./keyStorageService.js")).default;
      await keyStorageService.clearAllKeys();

      // Clear instance variables
      this.myPrivateKey = null;
      this.myPublicKey = null;
      this.myKeyVersion = 1;

      console.log("All keys cleared successfully");
    } catch (error) {
      console.error("Failed to clear all keys:", error);
      throw error;
    }
  }

  // Private helper methods

  /**
   * Fetch user key data from server
   */
  async _fetchUserKeyFromServer(userId, token) {
    const response = await fetch(
      `${this.BACKEND_URL}/api/users/${userId}/public-key`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch user public key: ${response.status}`);
    }

    const data = await response.json();
    return data.data;
  }

  /**
   * Check if cached data is still valid based on timestamp
   */
  _isCacheValid(timestamp) {
    return Date.now() - timestamp < this.cacheExpiry;
  }

  /**
   * Validate public key format
   */
  _isValidPublicKey(publicKey) {
    if (!publicKey || typeof publicKey !== 'string') {
      return false;
    }
    const pemRegex = /^-----BEGIN PUBLIC KEY-----[\s\S]*-----END PUBLIC KEY-----$/;
    return pemRegex.test(publicKey.trim());
  }

  /**
   * Validate private key format
   */
  _isValidPrivateKey(privateKey) {
    if (!privateKey || typeof privateKey !== 'string') {
      return false;
    }
    const pemRegex = /^-----BEGIN RSA PRIVATE KEY-----[\s\S]*-----END RSA PRIVATE KEY-----$/;
    return pemRegex.test(privateKey.trim());
  }

  /**
   * Validate that public and private keys match
   */
  async _validateKeyPairMatch(publicKey, privateKey) {
    try {
      const CryptoService = (await import("./cryptoService.js")).default;
      const testData = "keypair_match_test";

      // Encrypt with public key and decrypt with private key
      const encrypted = await CryptoService.encryptWithRSA(testData, publicKey);
      const decrypted = await CryptoService.decryptWithRSA(encrypted, privateKey);

      return decrypted === testData;
    } catch (error) {
      return false;
    }
  }

  /**
   * Delay helper for retry logic
   */
  _delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

const keyExchangeService = new KeyExchangeService();
export default keyExchangeService;
