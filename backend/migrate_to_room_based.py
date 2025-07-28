#!/usr/bin/env python3
"""
Migration script to update Message model from recipient_id to room_id
This script handles the database schema migration for room-based chat
"""

from app import app
from extensions import db
from sqlalchemy import text, inspect
import sys

def migrate_message_table():
    """
    Migrate the message table from recipient_id to room_id structure
    """
    try:
        with app.app_context():
            # Check if the old structure exists
            inspector = inspect(db.engine)
            
            # Check if message table exists
            if not inspector.has_table('message'):
                print("Message table doesn't exist, creating new table with room_id structure...")
                db.create_all()
                print("Created new message table with room_id structure")
                return
                
            columns = [col['name'] for col in inspector.get_columns('message')]
            
            print("Current message table columns:", columns)
            
            # If recipient_id exists, we need to migrate
            if 'recipient_id' in columns:
                print("Migrating from recipient_id to room_id structure...")
                
                # Create a backup table first
                with db.engine.connect() as conn:
                    conn.execute(text("""
                        CREATE TABLE message_backup AS 
                        SELECT * FROM message
                    """))
                    conn.commit()
                print("Created backup table: message_backup")
                
                # Drop the existing message table
                with db.engine.connect() as conn:
                    conn.execute(text("DROP TABLE message"))
                    conn.commit()
                print("Dropped old message table")
                
                # Recreate the table with new structure
                db.create_all()
                print("Created new message table with room_id structure")
                
                # Migrate data from backup - convert recipient conversations to rooms
                # For now, we'll create room IDs based on sender-recipient pairs
                with db.engine.connect() as conn:
                    conn.execute(text("""
                        INSERT INTO message (sender_id, room_id, content, message_type, timestamp)
                        SELECT 
                            sender_id,
                            'general' as room_id,  -- Default all messages to 'general' room
                            encrypted_message as content,
                            message_type,
                            timestamp
                        FROM message_backup
                    """))
                    conn.commit()
                print("Migrated existing messages to 'general' room")
                
                # Clean up backup table
                with db.engine.connect() as conn:
                    conn.execute(text("DROP TABLE message_backup"))
                    conn.commit()
                print("Cleaned up backup table")
                
            elif 'room_id' in columns:
                print("Message table already has room_id structure - no migration needed")
            else:
                print("Creating new message table with room_id structure...")
                db.create_all()
                
            print("Migration completed successfully!")
            
    except Exception as e:
        print(f"Migration failed: {str(e)}")
        print("Attempting to restore from backup if it exists...")
        try:
            # Try to restore from backup if something went wrong
            with db.engine.connect() as conn:
                conn.execute(text("DROP TABLE IF EXISTS message"))
                conn.execute(text("ALTER TABLE message_backup RENAME TO message"))
                conn.commit()
            print("Restored from backup")
        except Exception as restore_error:
            print(f"Could not restore from backup: {str(restore_error)}")
            print("Manual intervention may be required")
        sys.exit(1)

if __name__ == '__main__':
    print("Starting Message table migration to room-based structure...")
    migrate_message_table()