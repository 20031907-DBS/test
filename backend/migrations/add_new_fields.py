"""
Database migration script to add new fields for enhanced chat functionality
"""

from extensions import db
from models.user import User
from models.message import Message
from models.room import Room

def upgrade():
    """Add new columns to existing tables"""
    
    # Add new columns to User table
    try:
        db.engine.execute('ALTER TABLE user ADD COLUMN is_online BOOLEAN DEFAULT FALSE')
        print("Added is_online column to user table")
    except Exception as e:
        print(f"is_online column might already exist: {e}")
    
    try:
        db.engine.execute('ALTER TABLE user ADD COLUMN display_name VARCHAR(100)')
        print("Added display_name column to user table")
    except Exception as e:
        print(f"display_name column might already exist: {e}")
    
    # Add new columns to Message table
    try:
        db.engine.execute('ALTER TABLE message ADD COLUMN status VARCHAR(20) DEFAULT "sent"')
        print("Added status column to message table")
    except Exception as e:
        print(f"status column might already exist: {e}")
    
    try:
        db.engine.execute('ALTER TABLE message ADD COLUMN delivered_at DATETIME')
        print("Added delivered_at column to message table")
    except Exception as e:
        print(f"delivered_at column might already exist: {e}")
    
    # Create indexes for better performance
    try:
        db.engine.execute('CREATE INDEX IF NOT EXISTS idx_message_room_timestamp ON message(room_id, timestamp)')
        print("Created index on message(room_id, timestamp)")
    except Exception as e:
        print(f"Index creation failed: {e}")
    
    try:
        db.engine.execute('CREATE INDEX IF NOT EXISTS idx_message_sender ON message(sender_id)')
        print("Created index on message(sender_id)")
    except Exception as e:
        print(f"Index creation failed: {e}")
    
    try:
        db.engine.execute('CREATE INDEX IF NOT EXISTS idx_user_firebase_uid ON user(firebase_uid)')
        print("Created index on user(firebase_uid)")
    except Exception as e:
        print(f"Index creation failed: {e}")

def downgrade():
    """Remove added columns (use with caution)"""
    # Note: SQLite doesn't support DROP COLUMN, so this would require table recreation
    print("Downgrade not implemented for SQLite. Use with PostgreSQL for full migration support.")

if __name__ == '__main__':
    from app import app
    with app.app_context():
        upgrade()
        print("Migration completed successfully!")