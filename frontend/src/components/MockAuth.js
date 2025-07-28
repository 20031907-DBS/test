"use client"
import React, { useState } from 'react';
import { MessageCircle, User, Mail } from 'lucide-react';

export default function MockAuth({ onLogin }) {
  const [loading, setLoading] = useState(false);

  const handleMockLogin = async () => {
    setLoading(true);
    
    // Simulate login delay
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Create mock user
    const mockUser = {
      uid: 'mock-user-123',
      email: 'demo@example.com',
      displayName: 'Demo User',
      photoURL: null,
      accessToken: 'mock-token-123'
    };
    
    onLogin(mockUser);
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 px-4">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <div className="mx-auto h-16 w-16 bg-blue-600 rounded-full flex items-center justify-center">
            <MessageCircle className="h-8 w-8 text-white" />
          </div>
          <h2 className="mt-6 text-3xl font-bold text-gray-900">
            Welcome to Chat
          </h2>
          <p className="mt-2 text-sm text-gray-600">
            Demo mode - Click below to try the app
          </p>
        </div>

        <div className="bg-white py-8 px-6 shadow-lg rounded-lg">
          <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-md">
            <div className="flex items-start space-x-3">
              <User className="h-5 w-5 text-blue-500 mt-0.5 flex-shrink-0" />
              <div className="text-sm text-blue-700">
                <p className="font-medium">Demo Mode</p>
                <p>You'll be logged in as a demo user to test all features.</p>
              </div>
            </div>
          </div>

          <button
            onClick={handleMockLogin}
            disabled={loading}
            className="w-full flex justify-center items-center py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
          >
            {loading ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-3"></div>
                Signing in...
              </>
            ) : (
              <>
                <User className="w-5 h-5 mr-3" />
                Continue as Demo User
              </>
            )}
          </button>

          <div className="mt-6 text-center">
            <p className="text-xs text-gray-500">
              Demo user • All features enabled • End-to-end encrypted
            </p>
          </div>
        </div>

        <div className="text-center">
          <p className="text-sm text-gray-600">
            🔒 Secure • 📱 Mobile Ready • ⚡ Real-time
          </p>
        </div>
      </div>
    </div>
  );
}