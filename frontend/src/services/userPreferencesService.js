/**
 * UserPreferencesService - Manages user preferences for encryption and other settings
 * Handles storing/retrieving user preferences in localStorage with validation
 */

class UserPreferencesService {
  constructor() {
    this.storageKey = 'user_preferences';
    this.defaultPreferences = {
      encryption: {
        clearKeysOnLogout: false, // Default to keeping keys for convenience
        keyPersistenceAcrossSessions: true,
        autoInitializeKeys: true
      },
      ui: {
        showEncryptionIndicators: true,
        showKeyInitializationProgress: true
      }
    };
  }

  /**
   * Get all user preferences
   * @returns {Object} User preferences object
   */
  getPreferences() {
    try {
      const stored = localStorage.getItem(this.storageKey);
      if (stored) {
        const parsed = JSON.parse(stored);
        // Merge with defaults to ensure all properties exist
        return this._mergeWithDefaults(parsed);
      }
    } catch (error) {
      console.error('Failed to load user preferences:', error);
    }
    
    return { ...this.defaultPreferences };
  }

  /**
   * Update user preferences
   * @param {Object} preferences - Preferences to update
   */
  updatePreferences(preferences) {
    try {
      const current = this.getPreferences();
      const updated = this._deepMerge(current, preferences);
      localStorage.setItem(this.storageKey, JSON.stringify(updated));
      return updated;
    } catch (error) {
      console.error('Failed to save user preferences:', error);
      throw error;
    }
  }

  /**
   * Get encryption-specific preferences
   * @returns {Object} Encryption preferences
   */
  getEncryptionPreferences() {
    return this.getPreferences().encryption;
  }

  /**
   * Update encryption preferences
   * @param {Object} encryptionPrefs - Encryption preferences to update
   */
  updateEncryptionPreferences(encryptionPrefs) {
    return this.updatePreferences({ encryption: encryptionPrefs });
  }

  /**
   * Check if keys should be cleared on logout
   * @returns {boolean}
   */
  shouldClearKeysOnLogout() {
    return this.getEncryptionPreferences().clearKeysOnLogout;
  }

  /**
   * Check if keys should persist across sessions
   * @returns {boolean}
   */
  shouldPersistKeysAcrossSessions() {
    return this.getEncryptionPreferences().keyPersistenceAcrossSessions;
  }

  /**
   * Check if keys should be auto-initialized
   * @returns {boolean}
   */
  shouldAutoInitializeKeys() {
    return this.getEncryptionPreferences().autoInitializeKeys;
  }

  /**
   * Reset preferences to defaults
   */
  resetToDefaults() {
    try {
      localStorage.removeItem(this.storageKey);
    } catch (error) {
      console.error('Failed to reset preferences:', error);
    }
  }

  /**
   * Clear all preferences
   */
  clearPreferences() {
    this.resetToDefaults();
  }

  /**
   * Merge preferences with defaults to ensure all properties exist
   * @private
   */
  _mergeWithDefaults(preferences) {
    return this._deepMerge(this.defaultPreferences, preferences);
  }

  /**
   * Deep merge two objects
   * @private
   */
  _deepMerge(target, source) {
    const result = { ...target };
    
    for (const key in source) {
      if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
        result[key] = this._deepMerge(target[key] || {}, source[key]);
      } else {
        result[key] = source[key];
      }
    }
    
    return result;
  }
}

// Export singleton instance
const userPreferencesService = new UserPreferencesService();
export default userPreferencesService;