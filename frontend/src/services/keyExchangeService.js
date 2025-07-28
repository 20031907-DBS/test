/**
 * KeyExchangeService - Handles RSA key exchange and management
 */

class KeyExchangeService {
    constructor() {
        this.userKeys = new Map(); // Cache for user public keys
        this.myPrivateKey = null;
        this.myPublicKey = null;
    }

    /**
     * Initialize user's key pair and upload public key to server
     */
    async initializeKeys(userId, token) {
        try {
            // Generate RSA key pair
            const CryptoService = (await import('./cryptoService')).default;
            const keyPair = await CryptoService.generateRSAKeyPair();
            
            this.myPrivateKey = keyPair.privateKey;
            this.myPublicKey = keyPair.publicKey;

            // Upload public key to server
            const response = await fetch(`/api/users/${userId}/public-key`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    public_key: this.myPublicKey
                })
            });

            if (!response.ok) {
                throw new Error('Failed to upload public key');
            }

            console.log('Keys initialized and uploaded successfully');
            return true;
        } catch (error) {
            console.error('Failed to initialize keys:', error);
            throw error;
        }
    }

    /**
     * Get public key for a specific user
     */
    async getUserPublicKey(userId, token) {
        try {
            // Check cache first
            if (this.userKeys.has(userId)) {
                return this.userKeys.get(userId);
            }

            // Fetch from server
            const response = await fetch(`/api/users/${userId}/public-key`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (!response.ok) {
                throw new Error('Failed to fetch user public key');
            }

            const data = await response.json();
            const publicKey = data.data.public_key;

            // Cache the key
            this.userKeys.set(userId, publicKey);
            
            return publicKey;
        } catch (error) {
            console.error('Failed to get user public key:', error);
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
     * Clear all cached keys
     */
    clearCache() {
        this.userKeys.clear();
    }
}

const keyExchangeService = new KeyExchangeService();
export default keyExchangeService;