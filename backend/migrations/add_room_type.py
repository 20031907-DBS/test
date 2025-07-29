#!/usr/bin/env python3
"""
Migration script to add room_type column to Room table
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from extensions import db
from models.room import Room
from sqlalchemy import text

def migrate():
    """Add room_type column to Room table"""
    try:
        # Check if column already exists
        result = db.session.execute(text("PRAGMA table_info(room)"))
        columns = [row[1] for row in result.fetchall()]
        
        if 'room_type' not in columns:
            print("Adding room_type column to Room table...")
            db.session.execute(text("ALTER TABLE room ADD COLUMN room_type VARCHAR(20) DEFAULT 'group'"))
            db.session.commit()
            print("Successfully added room_type column")
        else:
            print("room_type column already exists")
            
    except Exception as e:
        print(f"Error during migration: {e}")
        db.session.rollback()
        raise

if __name__ == '__main__':
    from app import app
    
    with app.app_context():
        migrate()