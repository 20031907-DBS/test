/**
 * Basic tests for CryptoService
 * These tests verify the core cryptographic operations
 */

import CryptoService from './cryptoService.js';

// Simple test runner for browser environment
class TestRunner {
  static async runTests() {
    console.log('🧪 Running CryptoService Tests...\n');
    
    try {
      await this.testRSAKeyGeneration();
      await this.testRSAKeyExportImport();
      await this.testRSAEncryptionDecryption();
      await this.testAESKeyGeneration();
      await this.testAESEncryptionDecryption();
      await this.testAESKeyExportImport();
      await this.testEndToEndFlow();
      
      console.log('✅ All tests passed!');
    } catch (error) {
      console.error('❌ Test failed:', error);
    }
  }

  static async testRSAKeyGeneration() {
    console.log('Testing RSA key generation...');
    const keyPair = await CryptoService.generateRSAKeyPair();
    
    if (!keyPair.publicKey || !keyPair.privateKey) {
      throw new Error('RSA key pair generation failed');
    }
    
    console.log('✓ RSA key generation successful');
  }

  static async testRSAKeyExportImport() {
    console.log('Testing RSA key export/import...');
    const keyPair = await CryptoService.generateRSAKeyPair();
    
    // Test public key export/import
    const exportedPublicKey = await CryptoService.exportPublicKey(keyPair.publicKey);
    const importedPublicKey = await CryptoService.importPublicKey(exportedPublicKey);
    
    if (!exportedPublicKey || !importedPublicKey) {
      throw new Error('RSA public key export/import failed');
    }
    
    // Test private key export/import
    const exportedPrivateKey = await CryptoService.exportPrivateKey(keyPair.privateKey);
    const importedPrivateKey = await CryptoService.importPrivateKey(exportedPrivateKey);
    
    if (!exportedPrivateKey || !importedPrivateKey) {
      throw new Error('RSA private key export/import failed');
    }
    
    console.log('✓ RSA key export/import successful');
  }

  static async testRSAEncryptionDecryption() {
    console.log('Testing RSA encryption/decryption...');
    const keyPair = await CryptoService.generateRSAKeyPair();
    const testMessage = 'Hello, RSA encryption!';
    
    // Encrypt with public key
    const encrypted = await CryptoService.encryptWithRSA(testMessage, keyPair.publicKey);
    
    // Decrypt with private key
    const decryptedBuffer = await CryptoService.decryptWithRSA(encrypted, keyPair.privateKey);
    const decryptedMessage = new TextDecoder().decode(decryptedBuffer);
    
    if (decryptedMessage !== testMessage) {
      throw new Error(`RSA encryption/decryption failed. Expected: ${testMessage}, Got: ${decryptedMessage}`);
    }
    
    console.log('✓ RSA encryption/decryption successful');
  }

  static async testAESKeyGeneration() {
    console.log('Testing AES key generation...');
    const aesKey = await CryptoService.generateAESKey();
    
    if (!aesKey) {
      throw new Error('AES key generation failed');
    }
    
    console.log('✓ AES key generation successful');
  }

  static async testAESEncryptionDecryption() {
    console.log('Testing AES encryption/decryption...');
    const aesKey = await CryptoService.generateAESKey();
    const testMessage = 'Hello, AES encryption! This is a longer message to test AES-GCM.';
    
    // Encrypt message
    const { encryptedData, iv } = await CryptoService.encryptWithAES(testMessage, aesKey);
    
    // Decrypt message
    const decryptedMessage = await CryptoService.decryptWithAES(encryptedData, iv, aesKey);
    
    if (decryptedMessage !== testMessage) {
      throw new Error(`AES encryption/decryption failed. Expected: ${testMessage}, Got: ${decryptedMessage}`);
    }
    
    console.log('✓ AES encryption/decryption successful');
  }

  static async testAESKeyExportImport() {
    console.log('Testing AES key export/import...');
    const aesKey = await CryptoService.generateAESKey();
    
    // Export and import AES key
    const exportedKey = await CryptoService.exportAESKey(aesKey);
    const importedKey = await CryptoService.importAESKey(exportedKey);
    
    // Test that the imported key works
    const testMessage = 'Test AES key import';
    const { encryptedData, iv } = await CryptoService.encryptWithAES(testMessage, importedKey);
    const decryptedMessage = await CryptoService.decryptWithAES(encryptedData, iv, importedKey);
    
    if (decryptedMessage !== testMessage) {
      throw new Error('AES key export/import failed - key doesn\'t work after import');
    }
    
    console.log('✓ AES key export/import successful');
  }

  static async testEndToEndFlow() {
    console.log('Testing end-to-end encryption flow...');
    
    // Simulate two users
    const user1KeyPair = await CryptoService.generateRSAKeyPair();
    const user2KeyPair = await CryptoService.generateRSAKeyPair();
    
    // User 1 generates AES key and encrypts it for User 2
    const aesKey = await CryptoService.generateAESKey();
    const exportedAESKey = await CryptoService.exportAESKey(aesKey);
    const encryptedAESKey = await CryptoService.encryptWithRSA(exportedAESKey, user2KeyPair.publicKey);
    
    // User 2 decrypts the AES key
    const decryptedAESKeyBuffer = await CryptoService.decryptWithRSA(encryptedAESKey, user2KeyPair.privateKey);
    const decryptedAESKeyString = new TextDecoder().decode(decryptedAESKeyBuffer);
    const user2AESKey = await CryptoService.importAESKey(decryptedAESKeyString);
    
    // User 1 encrypts a message with AES
    const message = 'This is a secret message!';
    const { encryptedData, iv } = await CryptoService.encryptWithAES(message, aesKey);
    
    // User 2 decrypts the message with their AES key
    const decryptedMessage = await CryptoService.decryptWithAES(encryptedData, iv, user2AESKey);
    
    if (decryptedMessage !== message) {
      throw new Error(`End-to-end flow failed. Expected: ${message}, Got: ${decryptedMessage}`);
    }
    
    console.log('✓ End-to-end encryption flow successful');
  }
}

// Export for use in other contexts
export default TestRunner;

// Auto-run tests if in browser environment
if (typeof window !== 'undefined') {
  // Run tests when the script loads
  TestRunner.runTests();
}