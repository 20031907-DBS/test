#!/usr/bin/env python3
"""
Quick test script to verify the chat app is working
"""

import requests
import json
import time
from datetime import datetime

def test_backend():
    """Test if backend is running and responding"""
    try:
        response = requests.get('http://localhost:5000/')
        if response.status_code == 200:
            print("✅ Backend is running and responding")
            return True
        else:
            print(f"❌ Backend responded with status {response.status_code}")
            return False
    except requests.exceptions.ConnectionError:
        print("❌ Backend is not running on port 5000")
        return False
    except Exception as e:
        print(f"❌ Error testing backend: {e}")
        return False

def test_auth():
    """Test authentication endpoint"""
    try:
        response = requests.post('http://localhost:5000/api/auth/firebase', 
                               json={'firebaseToken': 'test_token_123'})
        if response.status_code in [200, 401]:  # Either success or expected auth failure
            print("✅ Authentication endpoint is working")
            return True
        else:
            print(f"❌ Auth endpoint responded with status {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ Error testing auth: {e}")
        return False

def main():
    print("🧪 Testing End-to-End Encrypted Chat App")
    print("=" * 50)
    
    # Test backend
    backend_ok = test_backend()
    
    # Test auth
    auth_ok = test_auth()
    
    print("\n📊 Test Results:")
    print(f"Backend API: {'✅ PASS' if backend_ok else '❌ FAIL'}")
    print(f"Authentication: {'✅ PASS' if auth_ok else '❌ FAIL'}")
    
    if backend_ok and auth_ok:
        print("\n🎉 All tests passed! Your app is ready to use.")
        print("\n🚀 Next steps:")
        print("1. Open http://localhost:3000 in your browser")
        print("2. Click 'Sign In with Google' (or use mock auth)")
        print("3. Start chatting with end-to-end encryption!")
    else:
        print("\n⚠️  Some tests failed. Check the setup:")
        print("1. Make sure backend is running: python backend/run.py")
        print("2. Make sure frontend is running: npm run dev")
        print("3. Check for any error messages in the console")

if __name__ == "__main__":
    main()