'use client'
import React, { createContext, useContext, useEffect, useState } from 'react';
import encryptionService from '../services/encryptionService';
import userPreferencesService from '../services/userPreferencesService';

const AuthContext = createContext({});

export const useAuth = () => {
  return useContext(AuthContext);
};

export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [keyInitialization, setKeyInitialization] = useState({
    isInitializing: false,
    progress: 0,
    status: null,
    error: null
  });

  useEffect(() => {
    // Check if user is already authenticated
    checkAuthStatus();
  }, []);

  const checkAuthStatus = async () => {
    try {
      const backendUrl = process.env.NEXT_PUBLIC_WEBSOCKET_URL || 'http://localhost:5000';
      const response = await fetch(`${backendUrl}/api/auth/me`, {
        method: 'GET',
        credentials: 'include',
      });

      if (response.ok) {
        const data = await response.json();
        if (data.status === 'success') {
          // Create user object compatible with the app
          const user = {
            uid: data.data.id.toString(),
            email: data.data.email,
            displayName: data.data.display_name,
            username: data.data.username,
            photoURL: data.data.profile_picture,
            accessToken: 'local-auth-token'
          };
          setCurrentUser(user);
          setError(null);
          
          // Initialize encryption keys for existing session
          await initializeEncryptionKeys(user);
        } else {
          setCurrentUser(null);
        }
      } else {
        setCurrentUser(null);
      }
    } catch (err) {
      console.error('Auth check error:', err);
      setCurrentUser(null);
    } finally {
      setLoading(false);
    }
  };

  const initializeEncryptionKeys = async (user) => {
    try {
      setKeyInitialization({
        isInitializing: true,
        progress: 0,
        status: 'Initializing encryption keys...',
        error: null
      });

      // Progress: Starting key initialization
      setKeyInitialization(prev => ({
        ...prev,
        progress: 20,
        status: 'Checking existing keys...'
      }));

      // Initialize encryption service with user credentials
      const success = await encryptionService.initialize(user.uid, user.accessToken);
      
      if (success) {
        setKeyInitialization(prev => ({
          ...prev,
          progress: 100,
          status: 'Encryption keys ready',
          isInitializing: false
        }));
        
        // Clear status after a short delay
        setTimeout(() => {
          setKeyInitialization({
            isInitializing: false,
            progress: 0,
            status: null,
            error: null
          });
        }, 2000);
      } else {
        throw new Error('Failed to initialize encryption keys');
      }
    } catch (error) {
      console.error('Key initialization error:', error);
      setKeyInitialization({
        isInitializing: false,
        progress: 0,
        status: null,
        error: error.message || 'Failed to initialize encryption keys'
      });
    }
  };

  const logout = async (options = {}) => {
    try {
      setLoading(true);
      
      // Check user preferences for key cleanup
      const shouldClearKeys = options.clearKeys !== undefined 
        ? options.clearKeys 
        : userPreferencesService.shouldClearKeysOnLogout();
      
      // Clear encryption keys based on user preference
      if (currentUser && shouldClearKeys) {
        await encryptionService.clearKeys();
        console.log('Encryption keys cleared on logout');
      } else if (currentUser) {
        console.log('Encryption keys preserved on logout (user preference)');
      }
      
      // Clear backend session
      const backendUrl = process.env.NEXT_PUBLIC_WEBSOCKET_URL || 'http://localhost:5000';
      await fetch(`${backendUrl}/api/auth/logout`, {
        method: 'POST',
        credentials: 'include',
      });
      
      setCurrentUser(null);
      setError(null);
      setKeyInitialization({
        isInitializing: false,
        progress: 0,
        status: null,
        error: null
      });
    } catch (err) {
      console.error('Logout error:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const clearError = () => {
    setError(null);
  };

  const refreshUser = async () => {
    setLoading(true);
    await checkAuthStatus();
  };

  const login = async (user) => {
    setCurrentUser(user);
    setError(null);
    
    // Initialize encryption keys after successful login
    await initializeEncryptionKeys(user);
  };

  const updateUserPreferences = (preferences) => {
    return userPreferencesService.updatePreferences(preferences);
  };

  const getUserPreferences = () => {
    return userPreferencesService.getPreferences();
  };

  const clearKeysManually = async () => {
    if (currentUser) {
      await encryptionService.clearKeys();
      console.log('Encryption keys manually cleared');
    }
  };

  const value = {
    currentUser,
    login,
    logout,
    loading,
    error,
    clearError,
    refreshUser,
    keyInitialization,
    updateUserPreferences,
    getUserPreferences,
    clearKeysManually
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};