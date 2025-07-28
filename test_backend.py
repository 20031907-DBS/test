#!/usr/bin/env python3
"""
Simple test script to verify backend is working
"""

import requests
import json

def test_backend():
    base_url = "http://localhost:5000"
    
    print("Testing backend endpoints...")
    
    # Test 1: Health check
    try:
        response = requests.get(f"{base_url}/")
        if response.status_code == 200:
            print("✓ Health check passed")
        else:
            print(f"✗ Health check failed: {response.status_code}")
            return False
    except Exception as e:
        print(f"✗ Cannot connect to backend: {e}")
        print("Make sure the backend is running with: python backend/run_local.py")
        return False
    
    # Test 2: Registration
    try:
        test_user = {
            "email": "test@example.com",
            "password": "testpass123",
            "username": "testuser",
            "display_name": "Test User"
        }
        
        response = requests.post(
            f"{base_url}/api/auth/register",
            json=test_user,
            headers={"Content-Type": "application/json"}
        )
        
        if response.status_code in [201, 409]:  # 201 = created, 409 = already exists
            print("✓ Registration endpoint working")
        else:
            print(f"✗ Registration failed: {response.status_code} - {response.text}")
            return False
    except Exception as e:
        print(f"✗ Registration test failed: {e}")
        return False
    
    # Test 3: Login
    try:
        login_data = {
            "email": "test@example.com",
            "password": "testpass123"
        }
        
        session = requests.Session()
        response = session.post(
            f"{base_url}/api/auth/login",
            json=login_data,
            headers={"Content-Type": "application/json"}
        )
        
        if response.status_code == 200:
            print("✓ Login endpoint working")
            
            # Test 4: Get current user
            response = session.get(f"{base_url}/api/auth/me")
            if response.status_code == 200:
                print("✓ Session authentication working")
                user_data = response.json()
                print(f"  User: {user_data['data']['display_name']} ({user_data['data']['email']})")
            else:
                print(f"✗ Session check failed: {response.status_code}")
                return False
        else:
            print(f"✗ Login failed: {response.status_code} - {response.text}")
            return False
    except Exception as e:
        print(f"✗ Login test failed: {e}")
        return False
    
    print("\n🎉 All backend tests passed!")
    print("Your backend is ready for the chat app!")
    return True

if __name__ == "__main__":
    test_backend()