/**
 * CryptoService - Web Crypto API and JSEncrypt wrapper for RSA and AES operations
 * Implements end-to-end encryption functionality for the chat application
 * Uses RSA-2048 for key exchange and AES-256-GCM for message encryption
 */

import CryptoJS from 'crypto-js';
import JSEncrypt from 'jsencrypt';

class CryptoService {
    //Generate RSA key pair for initial key exchange
  
    static async generateRSAKeyPair() {
        try {
            const crypt = new JSEncrypt({ default_key_size: 2048 });
            crypt.getKey();

            return {
                publicKey: crypt.getPublicKey(),
                privateKey: crypt.getPrivateKey()
            };
        } catch (error) {
            throw new Error(`Failed to generate RSA key pair: ${error.message}`);
        }
    }

    /**
     * Export RSA public key
     */
    static async exportPublicKey(publicKey) {
        try {
            return publicKey; // Just return the PEM string directly - simpler!
        } catch (error) {
            throw new Error(`Failed to export public key: ${error.message}`);
        }
    }

    /**
     * Import RSA public key
     */
    static async importPublicKey(publicKeyPem) {
        try {
            return publicKeyPem; // Just return the PEM string directly - simpler!
        } catch (error) {
            throw new Error(`Failed to import public key: ${error.message}`);
        }
    }

    /**
     * Encrypt data using RSA public key
     */
    static async encryptWithRSA(data, publicKey) {
        try {
            const crypt = new JSEncrypt();
            crypt.setPublicKey(publicKey);

            const encrypted = crypt.encrypt(data);
            if (!encrypted) {
                throw new Error('RSA encryption failed');
            }

            return encrypted;
        } catch (error) {
            throw new Error(`Failed to encrypt with RSA: ${error.message}`);
        }
    }

    /**
     * Decrypt data using RSA private key
     */
    static async decryptWithRSA(encryptedData, privateKey) {
        try {
            const crypt = new JSEncrypt();
            crypt.setPrivateKey(privateKey);

            const decrypted = crypt.decrypt(encryptedData);
            if (!decrypted) {
                throw new Error('RSA decryption failed');
            }

            return decrypted;
        } catch (error) {
            throw new Error(`Failed to decrypt with RSA: ${error.message}`);
        }
    }

    /**
     * Sign data using RSA private key
     */
    static async signWithRSA(data, privateKey) {
        try {
            const crypt = new JSEncrypt();
            crypt.setPrivateKey(privateKey);

            const signature = crypt.sign(data, CryptoJS.SHA256, "sha256");
            if (!signature) {
                throw new Error('RSA signing failed');
            }

            return signature;
        } catch (error) {
            throw new Error(`Failed to sign with RSA: ${error.message}`);
        }
    }

    /**
     * Verify RSA signature using public key
     */
    static async verifyRSASignature(data, signature, publicKey) {
        try {
            const crypt = new JSEncrypt();
            crypt.setPublicKey(publicKey);

            const isValid = crypt.verify(data, signature, CryptoJS.SHA256);
            return isValid;
        } catch (error) {
            throw new Error(`Failed to verify RSA signature: ${error.message}`);
        }
    }

    /**
     * Generate AES key for message encryption using Web Crypto API
     */
    static async generateAESKey() {
        try {
            // Generate 256-bit AES key using Web Crypto API
            const key = await crypto.subtle.generateKey(
                {
                    name: 'AES-GCM',
                    length: 256
                },
                true, // extractable
                ['encrypt', 'decrypt']
            );

            // Export key as raw bytes and convert to hex
            const keyBuffer = await crypto.subtle.exportKey('raw', key);
            const keyArray = new Uint8Array(keyBuffer);
            return Array.from(keyArray).map(b => b.toString(16).padStart(2, '0')).join('');
        } catch (error) {
            throw new Error(`Failed to generate AES key: ${error.message}`);
        }
    }

    /**
     * Encrypt message using AES-256-GCM with Web Crypto API
     */
    static async encryptWithAES(message, aesKeyHex) {
        try {
            // Generate random IV for each message (96-bit IV for GCM)
            const iv = crypto.getRandomValues(new Uint8Array(12)); // 96-bit IV for GCM

            // Convert hex key to Uint8Array
            const keyBytes = new Uint8Array(aesKeyHex.match(/.{2}/g).map(byte => parseInt(byte, 16)));

            // Import the key
            const key = await crypto.subtle.importKey(
                'raw',
                keyBytes,
                { name: 'AES-GCM' },
                false,
                ['encrypt']
            );

            // Encrypt the message
            const messageBytes = new TextEncoder().encode(message);
            const encryptedBuffer = await crypto.subtle.encrypt(
                {
                    name: 'AES-GCM',
                    iv: iv
                },
                key,
                messageBytes
            );

            // Convert to base64 for storage/transmission
            const encryptedArray = new Uint8Array(encryptedBuffer);
            const encryptedBase64 = btoa(String.fromCharCode(...encryptedArray));
            const ivBase64 = btoa(String.fromCharCode(...iv));

            return {
                encryptedData: encryptedBase64,
                iv: ivBase64
            };
        } catch (error) {
            throw new Error(`Failed to encrypt with AES: ${error.message}`);
        }
    }

    /**
     * Decrypt message using AES-256-GCM with Web Crypto API
     */
    static async decryptWithAES(encryptedData, ivB64, aesKeyHex) {
        try {
            // Convert base64 to Uint8Array
            const encryptedBytes = new Uint8Array(
                atob(encryptedData).split('').map(char => char.charCodeAt(0))
            );
            const iv = new Uint8Array(
                atob(ivB64).split('').map(char => char.charCodeAt(0))
            );

            // Convert hex key to Uint8Array
            const keyBytes = new Uint8Array(aesKeyHex.match(/.{2}/g).map(byte => parseInt(byte, 16)));

            // Import the key
            const key = await crypto.subtle.importKey(
                'raw',
                keyBytes,
                { name: 'AES-GCM' },
                false,
                ['decrypt']
            );

            // Decrypt the message
            const decryptedBuffer = await crypto.subtle.decrypt(
                {
                    name: 'AES-GCM',
                    iv: iv
                },
                key,
                encryptedBytes
            );

            // Convert back to string
            const decryptedMessage = new TextDecoder().decode(decryptedBuffer);
            if (!decryptedMessage) {
                throw new Error('AES decryption failed - invalid key or corrupted data');
            }

            return decryptedMessage;
        } catch (error) {
            throw new Error(`Failed to decrypt with AES: ${error.message}`);
        }
    }

    /**
     * Export AES key 
     */
    static async exportAESKey(aesKeyHex) {
        try {
            return aesKeyHex; // Just return the hex string directly - simpler!
        } catch (error) {
            throw new Error(`Failed to export AES key: ${error.message}`);
        }
    }

    /**
     * Import AES key (accepts hex format directly for simplicity)
     */
    static async importAESKey(aesKeyHex) {
        try {
            return aesKeyHex; // Just return the hex string directly - simpler!
        } catch (error) {
            throw new Error(`Failed to import AES key: ${error.message}`);
        }
    }

    /**
     * Export RSA private key
     */
    static async exportPrivateKey(privateKey) {
        try {
            return privateKey; // Just return the PEM string directly - simpler!
        } catch (error) {
            throw new Error(`Failed to export private key: ${error.message}`);
        }
    }

    /**
     * Import RSA private key 
     */
    static async importPrivateKey(privateKeyPem) {
        try {
            return privateKeyPem; // Just return the PEM string directly - simpler!
        } catch (error) {
            throw new Error(`Failed to import private key: ${error.message}`);
        }
    }
}

export default CryptoService;