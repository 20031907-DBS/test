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
    <div className="min-h-screen flex items-center justify-center gradient-primary px-4">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <div className="mx-auto h-20 w-20 glass-morphism rounded-2xl flex items-center justify-center shadow-strong">
            <MessageCircle className="h-10 w-10 text-white" />
          </div>
          <h2 className="mt-6 text-4xl font-bold text-white drop-shadow-lg">
            Welcome to Chat
          </h2>
          <p className="mt-3 text-lg text-white/90 drop-shadow">
            Demo mode - Experience the future of messaging
          </p>
        </div>

        <div className="glass-morphism py-8 px-6 rounded-2xl shadow-strong">
          <div className="mb-6 p-4 bg-white/10 border border-white/20 rounded-xl backdrop-blur-sm">
            <div className="flex items-start space-x-3">
              <User className="h-6 w-6 text-white mt-0.5 flex-shrink-0" />
              <div className="text-sm text-white">
                <p className="font-semibold text-white">Demo Mode</p>
                <p className="text-white/90">You&apos;ll be logged in as a demo user to test all features.</p>
              </div>
            </div>
          </div>

          <button
            onClick={handleMockLogin}
            disabled={loading}
            className="w-full flex justify-center items-center py-4 px-6 border border-transparent rounded-xl shadow-medium text-base font-semibold text-white gradient-accent hover:scale-105 focus:outline-none focus:ring-4 focus:ring-white/30 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 transition-all duration-300 ease-out"
          >
            {loading ? (
              <>
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white mr-3"></div>
                Signing in...
              </>
            ) : (
              <>
                <User className="w-6 h-6 mr-3" />
                Continue as Demo User
              </>
            )}
          </button>

          <div className="mt-6 text-center">
            <p className="text-sm text-white/80">
              Demo user • All features enabled • End-to-end encrypted
            </p>
          </div>
        </div>

        <div className="text-center">
          <div className="flex justify-center space-x-8 text-white/90">
            <div className="flex flex-col items-center">
              <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center mb-2 backdrop-blur-sm">
                🔒
              </div>
              <span className="text-sm font-medium">Secure</span>
            </div>
            <div className="flex flex-col items-center">
              <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center mb-2 backdrop-blur-sm">
                📱
              </div>
              <span className="text-sm font-medium">Mobile Ready</span>
            </div>
            <div className="flex flex-col items-center">
              <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center mb-2 backdrop-blur-sm">
                ⚡
              </div>
              <span className="text-sm font-medium">Real-time</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}