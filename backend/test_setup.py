#!/usr/bin/env python3
"""
Test script to verify backend setup
"""

import os
import sys

# Set environment
os.environ['FLASK_ENV'] = 'development'

try:
    from app import app
    from extensions import db
    from models.user import User
    from models.message import Message
    from models.room import Room
    
    print("✓ All imports successful")
    
    with app.app_context():
        # Test database connection
        try:
            db.create_all()
            print("✓ Database tables created")
        except Exception as e:
            print(f"✗ Database error: {e}")
            sys.exit(1)
        
        # Test user creation
        try:
            test_user = User(
                email='test@example.com',
                username='testuser',
                display_name='Test User',
                name='Test User',
                password='hashed_password',
                provider='local'
            )
            
            # Don't actually save, just test the model
            print("✓ User model works")
        except Exception as e:
            print(f"✗ User model error: {e}")
            sys.exit(1)
        
        print("✓ Backend setup is working correctly!")
        print("You can now run: python run_local.py")

except ImportError as e:
    print(f"✗ Import error: {e}")
    print("Make sure you're in the backend directory and have installed requirements")
    sys.exit(1)
except Exception as e:
    print(f"✗ Setup error: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)