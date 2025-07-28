"use client"
import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../context/AuthContext';
import AuthForm from '../../components/AuthForm';

export default function LoginPage() {
  const router = useRouter();
  const { currentUser, loading: authLoading, refreshUser } = useAuth();

  // Redirect if already logged in
  useEffect(() => {
    if (!authLoading && currentUser) {
      router.replace('/chat');
    }
  }, [currentUser, authLoading, router]);

  const handleAuthSuccess = (user) => {
    // Refresh the auth context to pick up the new session
    if (refreshUser) {
      refreshUser();
    }
    
    // Small delay to ensure auth context updates, then redirect
    setTimeout(() => {
      router.push('/chat');
    }, 100);
  };

  // Show loading while checking auth state
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  // Don't render login form if user is already authenticated
  if (currentUser) {
    return null;
  }

  return <AuthForm onSuccess={handleAuthSuccess} />;
}