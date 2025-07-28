#!/usr/bin/env python3
"""
Migration script to add Room table to the database
This script creates the Room table for room-based chat functionality
"""

from app import app
from extensions import db
from sqlalchemy import text, inspect
import sys

def create_room_table():
    """
    Create the Room table if it doesn't exist
    """
    try:
        with app.app_context():
            # Import the Room model to ensure it's registered
            from models.room import Room
            
            # Check if the room table already exists
            inspector = inspect(db.engine)
            
            if inspector.has_table('room'):
                print("Room table already exists - no migration needed")
                return
                
            print("Creating Room table...")
            
            # Create the room table
            db.create_all()
            
            print("Room table created successfully!")
            
            # Create a default 'general' room
            with db.engine.connect() as conn:
                # Check if general room already exists
                result = conn.execute(text("SELECT COUNT(*) FROM room WHERE id = 'general'"))
                count = result.scalar()
                
                if count == 0:
                    # Create default general room (assuming user with id=1 exists)
                    conn.execute(text("""
                        INSERT INTO room (id, name, created_by, created_at, is_active)
                        VALUES ('general', 'General Chat', 1, datetime('now'), 1)
                    """))
                    conn.commit()
                    print("Created default 'general' room")
                else:
                    print("Default 'general' room already exists")
            
            print("Room table migration completed successfully!")
            
    except Exception as e:
        print(f"Migration failed: {str(e)}")
        sys.exit(1)

if __name__ == '__main__':
    print("Starting Room table creation migration...")
    create_room_table()