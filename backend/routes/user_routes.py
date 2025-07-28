from flask import Blueprint, jsonify, request
from models.user import User
from services.security.key_management import KeyManagementService
from routes.auth_routes import require_auth
from extensions import db

user_bp = Blueprint('user', __name__)

@user_bp.route('/users/<int:user_id>/public-key', methods=['GET'])
@require_auth
def get_public_key(user_id):
    """Get user's public key (requires authentication)"""
    try:
        # Verify the user is authenticated
        if not request.user:
            return jsonify({
                'status': 'error',
                'message': 'Authentication required'
            }), 401

        user = User.query.get(user_id)
        if not user:
            return jsonify({
                'status': 'error',
                'message': 'User not found'
            }), 404
            
        if not user.public_key:
            return jsonify({
                'status': 'error',
                'message': 'No public key available for this user'
            }), 404

        # Validate publickey format
        if not KeyManagementService.validate_public_key(user.public_key):
            return jsonify({
                'status': 'error',
                'message': 'Invalid public key format'
            }), 500

        return jsonify({
            'status': 'success',
            'data': {
                'user_id': user.id,
                'public_key': user.public_key,
                'key_version': user.key_version,
                'created_at': user.created_at.isoformat()
            }
        }), 200

    except Exception as e:
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500

@user_bp.route('/users/<int:user_id>/public-key', methods=['POST'])
@require_auth
def update_public_key(user_id):
    """Update user's public key (requires authentication)"""
    try:
        # For now, allow any authenticated user to update any public key
        # In production, you'd want proper authorization
        if not request.user:
            return jsonify({
                'status': 'error',
                'message': 'Authentication required'
            }), 401

        data = request.get_json()
        if not data or 'public_key' not in data:
            return jsonify({
                'status': 'error',
                'message': 'Public key is required'
            }), 400

        public_key = data['public_key']
        
        # Validate public key format
        if not KeyManagementService.validate_public_key(public_key):
            return jsonify({
                'status': 'error',
                'message': 'Invalid public key format'
            }), 400

        user = User.query.get(user_id)
        if not user:
            return jsonify({
                'status': 'error',
                'message': 'User not found'
            }), 404

        # Update user's public key
        user.public_key = public_key
        user.key_version += 1
        db.session.commit()

        return jsonify({
            'status': 'success',
            'data': {
                'user_id': user.id,
                'key_version': user.key_version,
                'message': 'Public key updated successfully'
            }
        }), 200

    except Exception as e:
        db.session.rollback()
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500

@user_bp.route('/users/search', methods=['GET'])
@require_auth
def search_users():
    """Search users for chat (requires authentication)"""
    try:
        if not request.user:
            return jsonify({
                'status': 'error',
                'message': 'Authentication required'
            }), 401

        query = request.args.get('q', '').strip()
        if not query:
            return jsonify({
                'status': 'error',
                'message': 'Search query is required'
            }), 400

        # Search users by username or email
        users = User.query.filter(
            (User.username.ilike(f'%{query}%')) | 
            (User.email.ilike(f'%{query}%'))
        ).limit(10).all()

        user_data = []
        for user in users:
            user_data.append({
                'id': user.id,
                'username': user.username,
                'email': user.email,
                'profile_picture': user.profile_picture,
                'has_public_key': user.public_key is not None
            })

        return jsonify({
            'status': 'success',
            'data': user_data
        }), 200

    except Exception as e:
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500 