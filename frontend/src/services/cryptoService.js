/** CryptoService - crypto-js wrapper for RSA and AES operationsImplements end-to-end encryption functionality for the chat application
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
     * Generate AES key for message encryption
     */
    static async generateAESKey() {
        try {
            // Generate 256-bit (32 bytes) random key
            const key = CryptoJS.lib.WordArray.random(32);
            return key.toString(CryptoJS.enc.Hex);
        } catch (error) {
            throw new Error(`Failed to generate AES key: ${error.message}`);
        }
    }

    /**
     * Encrypt message using AES-CBC
     */
    static async encryptWithAES(message, aesKeyHex) {
        try {
            // Generate random IV for each message
            const iv = CryptoJS.lib.WordArray.random(16); // 128-bit IV for CBC

            // Convert hex key to WordArray
            const key = CryptoJS.enc.Hex.parse(aesKeyHex);

            // Encrypt message
            const encrypted = CryptoJS.AES.encrypt(message, key, {
                iv: iv,
                mode: CryptoJS.mode.CBC,
                padding: CryptoJS.pad.Pkcs7
            });

            return {
                encryptedData: encrypted.toString(),
                iv: iv.toString(CryptoJS.enc.Base64)
            };
        } catch (error) {
            throw new Error(`Failed to encrypt with AES: ${error.message}`);
        }
    }

    /**
     * Decrypt message using AES-CBC
     */
    static async decryptWithAES(encryptedData, ivB64, aesKeyHex) {
        try {
            // Convert hex key and base64 IV to WordArray
            const key = CryptoJS.enc.Hex.parse(aesKeyHex);
            const iv = CryptoJS.enc.Base64.parse(ivB64);

            // Decrypt message
            const decrypted = CryptoJS.AES.decrypt(encryptedData, key, {
                iv: iv,
                mode: CryptoJS.mode.CBC,
                padding: CryptoJS.pad.Pkcs7
            });

            const decryptedMessage = decrypted.toString(CryptoJS.enc.Utf8);
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