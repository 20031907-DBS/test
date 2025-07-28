/**
 * EncryptionManager - Handles end-to-end encryption for messages
 */

import CryptoService from './cryptoService';
import keyExchangeService from './keyExchangeService';

class EncryptionManager {
    constructor() {
        this.isInitialized = false;
        this.currentUserId = null;
        this.currentToken = null;
    }

    /**
     * Initialize encryption for the current user
     */
    async initialize(userId, token) {
        try {
            this.currentUserId = userId;
            this.currentToken = token;

            // Initialize keys
            await keyExchangeService.initializeKeys(userId, token);
            
            this.isInitialized = true;
            console.log('Encryption manager initialized');
        } catch (error) {
            console.error('Failed to initialize encryption:', error);
            throw error;
        }
    }

    /**
     * Encrypt a message for sending
     * For simplicity, we'll use a single AES key for the general room
     */
    async encryptMessage(message, roomId = 'general') {
        try {
            if (!this.isInitialized) {
                throw new Error('Encryption not initialized');
            }

            // For this simple implementation, we'll use a fixed recipient
            // In a real app, you'd get all room participants
            const recipientIds = await this.getRoomParticipants(roomId);
            
            if (recipientIds.length === 0) {
                // No other users, send as plain text
                return {
                    content: message,
                    is_encrypted: false
                };
            }

            // Generate AES key for this message
            const aesKey = await CryptoService.generateAESKey();
            
            // Encrypt message with AES
            const encryptedMessage = await CryptoService.encryptWithAES(message, aesKey);
            
            // For simplicity, encrypt AES key for the first recipient only
            // In a real implementation, you'd encrypt for all recipients
            const recipientId = recipientIds[0];
            const recipientPublicKey = await keyExchangeService.getUserPublicKey(recipientId, this.currentToken);
            const encryptedAESKey = await CryptoService.encryptWithRSA(aesKey, recipientPublicKey);

            return {
                content: encryptedMessage.encryptedData,
                encrypted_aes_key: encryptedAESKey,
                iv: encryptedMessage.iv,
                is_encrypted: true
            };

        } catch (error) {
            console.error('Failed to encrypt message:', error);
            // Fallback to plain text
            return {
                content: message,
                is_encrypted: false
            };
        }
    }

    /**
     * Decrypt a received message
     */
    async decryptMessage(messageData) {
        try {
            if (!messageData.is_encrypted) {
                return messageData.content;
            }

            if (!this.isInitialized) {
                return '[Encryption not initialized]';
            }

            // Decrypt AES key with our private key
            const myPrivateKey = keyExchangeService.getMyPrivateKey();
            if (!myPrivateKey) {
                return '[Private key not available]';
            }

            const aesKey = await CryptoService.decryptWithRSA(messageData.encrypted_aes_key, myPrivateKey);
            
            // Decrypt message with AES key
            const decryptedMessage = await CryptoService.decryptWithAES(
                messageData.content,
                messageData.iv,
                aesKey
            );

            return decryptedMessage;

        } catch (error) {
            console.error('Failed to decrypt message:', error);
            return '[Failed to decrypt message]';
        }
    }

    /**
     * Get room participants (simplified for demo)
     * In a real app, this would fetch from the server
     */
    async getRoomParticipants(roomId) {
        // For this demo, we'll simulate having one other user
        // In a real implementation, you'd fetch room participants from the server
        
        // Return empty array if no other users (for demo purposes)
        // You can modify this to return actual user IDs for testing
        return [];
    }

    /**
     * Check if encryption is available
     */
    isEncryptionAvailable() {
        return this.isInitialized;
    }

    /**
     * Get encryption status
     */
    getStatus() {
        return {
            initialized: this.isInitialized,
            hasPrivateKey: keyExchangeService.getMyPrivateKey() !== null,
            hasPublicKey: keyExchangeService.getMyPublicKey() !== null
        };
    }
}

const encryptionManager = new EncryptionManager();
export default encryptionManager;