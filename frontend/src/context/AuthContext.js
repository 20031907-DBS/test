'use client'
import React, { createContext, useContext, useEffect, useState } from 'react';

const AuthContext = createContext({});

export const useAuth = () => {
  return useContext(AuthContext);
};

export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

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

  const logout = async () => {
    try {
      setLoading(true);
      
      // Clear backend session
      const backendUrl = process.env.NEXT_PUBLIC_WEBSOCKET_URL || 'http://localhost:5000';
      await fetch(`${backendUrl}/api/auth/logout`, {
        method: 'POST',
        credentials: 'include',
      });
      
      setCurrentUser(null);
      setError(null);
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

  const value = {
    currentUser,
    logout,
    loading,
    error,
    clearError,
    refreshUser
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};