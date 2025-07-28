'use client'
import React, { useState, useEffect } from 'react';
import { signInWithPopup } from 'firebase/auth';
import { auth, googleProvider } from '../../firebase.config';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../context/AuthContext';

function Login() {
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { currentUser } = useAuth();

  // Redirect if already logged in
  useEffect(() => {
    if (currentUser) {
      router.push('/home');
    }
  }, [currentUser, router]);

  const handleLogin = async (provider) => {
    try {
      setError('');
      setLoading(true);
      
      const result = await signInWithPopup(auth, provider);
      
      if (result.user) {
        // Get Firebase ID token
        const idToken = await result.user.getIdToken();
        
        // Send token to backend (try different ports)
        const backendUrl = process.env.NEXT_PUBLIC_WEBSOCKET_URL || 'http://localhost:5000';
        const response = await fetch(`${backendUrl}/api/auth/firebase`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
          body: JSON.stringify({ firebaseToken: idToken })
        });
        
        const data = await response.json();
        
        if (data.status === 'success') {
          console.log("Successfully logged in:", data.data);
          router.push('/home');
        } else {
          setError(data.message || 'Authentication failed');
        }
      } else {
        setError('Sign-in failed. Please try again.');
      }
      
    } catch (error) {
      console.error("Login error:", error);
      
      
      let errorMessage = 'Failed to sign in. Please try again.';
      
      switch (error.code) {
        case 'auth/popup-closed-by-user':
          errorMessage = 'Sign-in was cancelled. Please try again.';
          break;
        case 'auth/popup-blocked':
          errorMessage = 'Pop-up was blocked. Please allow pop-ups and try again.';
          break;
        case 'auth/network-request-failed':
          errorMessage = 'Network error. Please check your connection and try again.';
          break;
        case 'auth/too-many-requests':
          errorMessage = 'Too many failed attempts. Please try again later.';
          break;
        default:
          errorMessage = 'Error in signing in. Please try again.';
      }
      
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // Don't render login form if user is already authenticated
  if (currentUser) {
    return null;
  }

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <h2>Login</h2>
        
        {error && (
          <div style={styles.errorMessage}>
            {error}
          </div>
        )}
        
        <button 
          onClick={() => handleLogin(googleProvider)} 
          style={{
            ...styles.button,
            opacity: loading ? 0.6 : 1,
            cursor: loading ? 'not-allowed' : 'pointer'
          }}
          disabled={loading}
        >
          {loading ? 'Signing in...' : 'Sign In with Google'}
        </button>
      </div>
    </div>
  );
}

const styles = {
  container: {
    display: 'flex',
    height: '100vh',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  card: {
    padding: 30,
    backgroundColor: '#fff',
    borderRadius: 10,
    boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
    textAlign: 'center',
    minWidth: '300px',
  },
  button: {
    padding: '12px 24px',
    backgroundColor: '#4285F4',
    color: '#fff',
    border: 'none',
    borderRadius: 5,
    cursor: 'pointer',
    marginTop: 15,
    fontSize: '16px',
    transition: 'opacity 0.3s',
  },
  errorMessage: {
    backgroundColor: '#ffebee',
    color: '#c62828',
    padding: '10px',
    borderRadius: '4px',
    marginBottom: '15px',
    border: '1px solid #ffcdd2',
  }
};

export default Login;
