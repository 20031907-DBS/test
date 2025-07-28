#!/usr/bin/env python3
"""
Production startup script for the chat application
"""

import os
import sys
from app import app, socketio
from extensions import db

def setup_production():
    """Setup production environment"""
    
    # Ensure we're in production mode
    os.environ['FLASK_ENV'] = 'production'
    app.config['DEBUG'] = False
    
    # Create database tables
    with app.app_context():
        try:
            db.create_all()
            print("✓ Database tables created/verified")
        except Exception as e:
            print(f"✗ Database setup failed: {e}")
            sys.exit(1)
    
    # Run migrations
    try:
        from migrations.add_new_fields import upgrade
        with app.app_context():
            upgrade()
        print("✓ Database migrations completed")
    except Exception as e:
        print(f"⚠ Migration warning: {e}")
    
    # Verify required environment variables
    required_vars = [
        'SECRET_KEY',
        'DATABASE_URL',
    ]
    
    missing_vars = [var for var in required_vars if not os.getenv(var)]
    if missing_vars:
        print(f"✗ Missing required environment variables: {', '.join(missing_vars)}")
        sys.exit(1)
    
    print("✓ Environment variables verified")
    
    # Check Firebase credentials
    if not os.getenv('FIREBASE_CREDENTIALS') and not os.getenv('FIREBASE_CREDENTIALS_PATH'):
        print("⚠ Warning: No Firebase credentials found. Authentication may not work.")
    else:
        print("✓ Firebase credentials found")
    
    print("✓ Production setup completed")

if __name__ == '__main__':
    print("Setting up production environment...")
    setup_production()
    
    # Get configuration
    host = os.getenv('HOST', '0.0.0.0')
    port = int(os.getenv('PORT', 5000))
    
    print(f"Starting production server on {host}:{port}")
    
    # Run with production WSGI server
    try:
        import gunicorn
        print("Using Gunicorn for production")
        # Note: In actual deployment, you'd use gunicorn command line
        # gunicorn --worker-class eventlet -w 1 --bind 0.0.0.0:5000 run_production:app
    except ImportError:
        print("Gunicorn not found, using development server (not recommended for production)")
        socketio.run(
            app,
            host=host,
            port=port,
            debug=False,
            use_reloader=False
        )