#!/usr/bin/env python3
"""
Local development startup script
"""

import os
import sys
from app import app, socketio
from extensions import db

def setup_local():
    """Setup local development environment"""
    
    # Ensure we're in development mode
    os.environ['FLASK_ENV'] = 'development'
    app.config['DEBUG'] = True
    
    # Import all models to ensure they're registered
    try:
        from models.user import User
        from models.message import Message
        from models.room import Room
        print("✓ Models imported successfully")
    except Exception as e:
        print(f"✗ Failed to import models: {e}")
        return False
    
    # Create database tables
    with app.app_context():
        try:
            # Drop and recreate tables for clean start (development only)
            db.drop_all()
            db.create_all()
            print("✓ Database tables created/verified")
            
            # Create default rooms
            default_rooms = [
                {'id': 'general', 'name': 'General Chat'},
                {'id': 'tech-talk', 'name': 'Tech Talk'},
                {'id': 'random', 'name': 'Random'}
            ]
            
            for room_data in default_rooms:
                existing_room = Room.query.filter_by(id=room_data['id']).first()
                if not existing_room:
                    room = Room(
                        id=room_data['id'],
                        name=room_data['name'],
                        created_by=None  # System created rooms
                    )
                    db.session.add(room)
            
            try:
                db.session.commit()
                print("✓ Default rooms created")
            except Exception as e:
                print(f"Warning: Could not create default rooms: {e}")
                db.session.rollback()
            
        except Exception as e:
            print(f"✗ Database setup failed: {e}")
            import traceback
            traceback.print_exc()
            return False
    
    print("✓ Local development setup completed")
    return True

if __name__ == '__main__':
    print("Setting up local development environment...")
    
    if setup_local():
        print("Starting development server...")
        print("Backend will be available at: http://localhost:5000")
        print("WebSocket will be available at: ws://localhost:5000")
        print("\nPress Ctrl+C to stop the server")
        
        # Run with SocketIO
        socketio.run(
            app,
            host='0.0.0.0',
            port=5000,
            debug=True,
            use_reloader=True
        )
    else:
        print("Failed to setup local environment")
        exit(1)