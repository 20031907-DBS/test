#!/usr/bin/env python3
"""
Reset database script - cleans up and recreates everything
"""

import os
import sys

# Set environment
os.environ['FLASK_ENV'] = 'development'

try:
    from app import app
    from extensions import db
    
    print("Resetting database...")
    
    with app.app_context():
        # Remove existing database file
        db_path = os.path.join('instance', 'database.db')
        if os.path.exists(db_path):
            os.remove(db_path)
            print("✓ Old database removed")
        
        # Recreate tables
        db.create_all()
        print("✓ New database created")
        
        print("✓ Database reset complete!")
        print("You can now run: python run_local.py")

except Exception as e:
    print(f"✗ Reset failed: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)