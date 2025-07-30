"use client"
import React, { useState, useEffect } from 'react';
import { Shield, Key, AlertTriangle, Settings, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { clsx } from 'clsx';

export default function EncryptionSettings({ isOpen, onClose }) {
  const { getUserPreferences, updateUserPreferences, clearKeysManually } = useAuth();
  const [preferences, setPreferences] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setPreferences(getUserPreferences());
    }
  }, [isOpen, getUserPreferences]);

  const handlePreferenceChange = async (path, value) => {
    try {
      setLoading(true);
      const newPrefs = { ...preferences };
      
      // Navigate to the nested property and update it
      const keys = path.split('.');
      let current = newPrefs;
      for (let i = 0; i < keys.length - 1; i++) {
        current = current[keys[i]];
      }
      current[keys[keys.length - 1]] = value;
      
      const updated = updateUserPreferences(newPrefs);
      setPreferences(updated);
    } catch (error) {
      console.error('Failed to update preferences:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleClearKeys = async () => {
    try {
      setLoading(true);
      await clearKeysManually();
      setShowClearConfirm(false);
    } catch (error) {
      console.error('Failed to clear keys:', error);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen || !preferences) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <div className="flex items-center space-x-3">
            <Shield className="h-6 w-6 text-blue-600" />
            <h2 className="text-xl font-semibold text-gray-900">
              Encryption Settings
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Key Persistence Settings */}
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              Key Management
            </h3>
            
            <div className="space-y-4">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <label className="text-sm font-medium text-gray-700">
                    Clear keys on logout
                  </label>
                  <p className="text-xs text-gray-500 mt-1">
                    Remove encryption keys from this device when you log out
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={preferences.encryption.clearKeysOnLogout}
                  onChange={(e) => handlePreferenceChange('encryption.clearKeysOnLogout', e.target.checked)}
                  disabled={loading}
                  className="ml-3 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
              </div>

              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <label className="text-sm font-medium text-gray-700">
                    Keep keys across sessions
                  </label>
                  <p className="text-xs text-gray-500 mt-1">
                    Remember encryption keys between browser sessions
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={preferences.encryption.keyPersistenceAcrossSessions}
                  onChange={(e) => handlePreferenceChange('encryption.keyPersistenceAcrossSessions', e.target.checked)}
                  disabled={loading}
                  className="ml-3 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
              </div>

              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <label className="text-sm font-medium text-gray-700">
                    Auto-initialize keys
                  </label>
                  <p className="text-xs text-gray-500 mt-1">
                    Automatically set up encryption when you log in
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={preferences.encryption.autoInitializeKeys}
                  onChange={(e) => handlePreferenceChange('encryption.autoInitializeKeys', e.target.checked)}
                  disabled={loading}
                  className="ml-3 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
              </div>
            </div>
          </div>

          {/* UI Settings */}
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              Display Options
            </h3>
            
            <div className="space-y-4">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <label className="text-sm font-medium text-gray-700">
                    Show encryption indicators
                  </label>
                  <p className="text-xs text-gray-500 mt-1">
                    Display lock icons for encrypted messages
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={preferences.ui.showEncryptionIndicators}
                  onChange={(e) => handlePreferenceChange('ui.showEncryptionIndicators', e.target.checked)}
                  disabled={loading}
                  className="ml-3 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
              </div>

              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <label className="text-sm font-medium text-gray-700">
                    Show key setup progress
                  </label>
                  <p className="text-xs text-gray-500 mt-1">
                    Display progress when initializing encryption
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={preferences.ui.showKeyInitializationProgress}
                  onChange={(e) => handlePreferenceChange('ui.showKeyInitializationProgress', e.target.checked)}
                  disabled={loading}
                  className="ml-3 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
              </div>
            </div>
          </div>

          {/* Manual Key Management */}
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              Manual Actions
            </h3>
            
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <div className="flex items-start space-x-3">
                <AlertTriangle className="h-5 w-5 text-yellow-600 mt-0.5" />
                <div className="flex-1">
                  <h4 className="text-sm font-medium text-yellow-800">
                    Clear Encryption Keys
                  </h4>
                  <p className="text-xs text-yellow-700 mt-1">
                    Remove all encryption keys from this device. You&apos;ll need to generate new keys on next login.
                  </p>
                  <button
                    onClick={() => setShowClearConfirm(true)}
                    disabled={loading}
                    className="mt-3 text-sm bg-yellow-600 text-white px-3 py-1 rounded hover:bg-yellow-700 disabled:opacity-50"
                  >
                    Clear Keys
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t bg-gray-50 rounded-b-lg">
          <div className="flex justify-end">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
            >
              Close
            </button>
          </div>
        </div>
      </div>

      {/* Clear Keys Confirmation Modal */}
      {showClearConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-60">
          <div className="bg-white rounded-lg shadow-xl max-w-sm w-full mx-4">
            <div className="p-6">
              <div className="flex items-center space-x-3 mb-4">
                <AlertTriangle className="h-6 w-6 text-red-600" />
                <h3 className="text-lg font-semibold text-gray-900">
                  Confirm Key Deletion
                </h3>
              </div>
              <p className="text-sm text-gray-600 mb-6">
                Are you sure you want to clear all encryption keys? This action cannot be undone and you&apos;ll need to generate new keys on your next login.
              </p>
              <div className="flex space-x-3">
                <button
                  onClick={() => setShowClearConfirm(false)}
                  disabled={loading}
                  className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleClearKeys}
                  disabled={loading}
                  className="flex-1 px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700 disabled:opacity-50"
                >
                  {loading ? 'Clearing...' : 'Clear Keys'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}