"use client"
import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../context/AuthContext';
import AuthForm from '../../components/AuthForm';

export default function LoginPage() {
  const router = useRouter();
  const { currentUser, loading: authLoading, login, keyInitialization } = useAuth();

  // Redirect if already logged in
  useEffect(() => {
    if (!authLoading && currentUser) {
      router.replace('/chat');
    }
  }, [currentUser, authLoading, router]);

  const handleAuthSuccess = async (user) => {
    // Use the login function from AuthContext to initialize keys
    await login(user);
    
    // Redirect to chat after successful login and key initialization
    router.push('/chat');
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

  return (
    <>
      <AuthForm onSuccess={handleAuthSuccess} />
      
      {/* Key Initialization Progress Overlay */}
      {keyInitialization.isInitializing && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-sm w-full mx-4">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Setting up encryption
              </h3>
              <p className="text-sm text-gray-600 mb-4">
                {keyInitialization.status}
              </p>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${keyInitialization.progress}%` }}
                ></div>
              </div>
              <p className="text-xs text-gray-500 mt-2">
                This may take a few seconds...
              </p>
            </div>
          </div>
        </div>
      )}
      
      {/* Key Initialization Error */}
      {keyInitialization.error && (
        <div className="fixed bottom-4 right-4 bg-red-50 border border-red-200 rounded-lg p-4 max-w-sm">
          <div className="flex items-start space-x-3">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            </div>
            <div>
              <h4 className="text-sm font-medium text-red-800">
                Encryption Setup Failed
              </h4>
              <p className="text-sm text-red-700 mt-1">
                {keyInitialization.error}
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}