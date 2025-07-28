from flask import Blueprint, request, jsonify, session
from functools import wraps
from services.auth.firebase_auth import FirebaseAuthService
from flask_socketio import disconnect
from models.user import User
from extensions import db
from werkzeug.security import generate_password_hash, check_password_hash
import re
from datetime import datetime, timezone

auth_bp = Blueprint('auth', __name__)
firebase_auth = FirebaseAuthService()
#authorization header is used to authenticate the user
def require_auth(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        auth_header = request.headers.get('Authorization')
        if not auth_header or not auth_header.startswith('Bearer '):
            return jsonify({'status': 'error', 'message': 'No token provided'}), 401
            
        try:
            token = auth_header.split('Bearer ')[1]
            firebase_user = firebase_auth.verify_firebase_token(token)
            request.user = firebase_user
            return f(*args, **kwargs)
        except Exception as e:
            return jsonify({'status': 'error', 'message': 'Invalid token'}), 401
            
    return decorated
#Frontend sends firebase token to this route make sure 
@auth_bp.route('/firebase', methods=['POST'])
def firebase_auth_handler():
    """Handle Firebase authentication and create+update user in our system"""
    try:
        data = request.get_json()
        if not data or 'firebaseToken' not in data:
            return jsonify({
                'status': 'error',
                'message': 'Firebase token is required'
            }), 400

        firebase_user = firebase_auth.verify_firebase_token(data['firebaseToken'])
        
        user = firebase_auth.get_or_create_user(firebase_user)
        
        session['user_id'] = user.id
        session['firebase_uid'] = firebase_user['uid']
        session['authenticated'] = True
        
        return jsonify({
            'status': 'success',
            'data': {
                'user_id': user.id,
                'email': user.email,
                'username': user.username,
                'profile_picture': user.profile_picture
            }
        }), 200

    except ValueError as e:
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 401
    except Exception as e:
        return jsonify({
            'status': 'error',
            'message': 'Authentication failed'
        }), 500

@auth_bp.route('/check', methods=['GET'])
@require_auth
def check_auth():
    """Check if user is authenticated"""
    return jsonify({
        'status': 'success',
        'authenticated': True,
        'user': request.user
    })

@auth_bp.route('/register', methods=['POST'])
def register():
    """Register a new user with email and password"""
    try:
        data = request.get_json()
        
        # Validate required fields
        required_fields = ['email', 'password', 'username', 'display_name']
        for field in required_fields:
            if not data.get(field):
                return jsonify({
                    'status': 'error',
                    'message': f'{field} is required'
                }), 400
        
        email = data['email'].lower().strip()
        password = data['password']
        username = data['username'].lower().strip()
        display_name = data['display_name'].strip()
        
        # Validate email format
        email_regex = r'^[^\s@]+@[^\s@]+\.[^\s@]+$'
        if not re.match(email_regex, email):
            return jsonify({
                'status': 'error',
                'message': 'Invalid email format'
            }), 400
        
        # Validate password strength
        if len(password) < 6:
            return jsonify({
                'status': 'error',
                'message': 'Password must be at least 6 characters long'
            }), 400
        
        # Validate username
        if len(username) < 3 or len(username) > 30:
            return jsonify({
                'status': 'error',
                'message': 'Username must be between 3 and 30 characters'
            }), 400
        
        if not re.match(r'^[a-zA-Z0-9_]+$', username):
            return jsonify({
                'status': 'error',
                'message': 'Username can only contain letters, numbers, and underscores'
            }), 400
        
        # Check if user already exists
        existing_user = User.query.filter(
            (User.email == email) | (User.username == username)
        ).first()
        
        if existing_user:
            if existing_user.email == email:
                return jsonify({
                    'status': 'error',
                    'message': 'Email already registered'
                }), 409
            else:
                return jsonify({
                    'status': 'error',
                    'message': 'Username already taken'
                }), 409
        
        # Create new user
        hashed_password = generate_password_hash(password)
        new_user = User(
            email=email,
            username=username,
            display_name=display_name,
            name=display_name,  # Also set name field
            password=hashed_password,
            provider='local',
            created_at=datetime.now(timezone.utc)
        )
        
        db.session.add(new_user)
        db.session.commit()
        
        # Create session
        session['user_id'] = new_user.id
        session['authenticated'] = True
        
        return jsonify({
            'status': 'success',
            'message': 'User registered successfully',
            'data': {
                'user_id': new_user.id,
                'email': new_user.email,
                'username': new_user.username,
                'display_name': new_user.display_name
            }
        }), 201
        
    except Exception as e:
        db.session.rollback()
        import traceback
        print(f"Registration error: {str(e)}")
        print("Full traceback:")
        traceback.print_exc()
        return jsonify({
            'status': 'error',
            'message': f'Registration failed: {str(e)}'
        }), 500

@auth_bp.route('/login', methods=['POST'])
def login():
    """Login user with email and password"""
    try:
        data = request.get_json()
        
        if not data.get('email') or not data.get('password'):
            return jsonify({
                'status': 'error',
                'message': 'Email and password are required'
            }), 400
        
        email = data['email'].lower().strip()
        password = data['password']
        
        # Find user by email or username
        user = User.query.filter(
            (User.email == email) | (User.username == email)
        ).first()
        
        if not user:
            return jsonify({
                'status': 'error',
                'message': 'Invalid email or password'
            }), 401
        
        # Check password
        if not user.password or not check_password_hash(user.password, password):
            return jsonify({
                'status': 'error',
                'message': 'Invalid email or password'
            }), 401
        
        # Update last seen
        user.last_seen = datetime.now(timezone.utc)
        user.is_online = True
        db.session.commit()
        
        # Create session
        session['user_id'] = user.id
        session['authenticated'] = True
        
        return jsonify({
            'status': 'success',
            'message': 'Login successful',
            'data': {
                'user_id': user.id,
                'email': user.email,
                'username': user.username,
                'display_name': user.display_name,
                'profile_picture': user.profile_picture
            }
        }), 200
        
    except Exception as e:
        print(f"Login error: {str(e)}")
        return jsonify({
            'status': 'error',
            'message': 'Login failed. Please try again.'
        }), 500

@auth_bp.route('/logout', methods=['POST'])
def logout():
    """Logout user and clear session"""
    try:
        user_id = session.get('user_id')
        if user_id:
            # Update user offline status
            user = User.query.get(user_id)
            if user:
                user.is_online = False
                user.last_seen = datetime.now(timezone.utc)
                db.session.commit()
        
        # Clear session
        session.clear()
        
        return jsonify({
            'status': 'success',
            'message': 'Logout successful'
        }), 200
        
    except Exception as e:
        print(f"Logout error: {str(e)}")
        return jsonify({
            'status': 'error',
            'message': 'Logout failed'
        }), 500

@auth_bp.route('/me', methods=['GET'])
def get_current_user():
    """Get current authenticated user info"""
    try:
        user_id = session.get('user_id')
        if not user_id:
            return jsonify({
                'status': 'error',
                'message': 'Not authenticated'
            }), 401
        
        user = User.query.get(user_id)
        if not user:
            session.clear()
            return jsonify({
                'status': 'error',
                'message': 'User not found'
            }), 401
        
        return jsonify({
            'status': 'success',
            'data': user.to_dict()
        }), 200
        
    except Exception as e:
        print(f"Get user error: {str(e)}")
        return jsonify({
            'status': 'error',
            'message': 'Failed to get user info'
        }), 500 