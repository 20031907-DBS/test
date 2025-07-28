import os
from datetime import datetime, timezone
from models.user import User
from extensions import db

class FirebaseAuthService:
    def __init__(self):
        self.initialized = False
        
    def verify_firebase_token(self, id_token):
        try:
            # Mock authentication for demo purposes
            # In production, use firebase_admin.auth.verify_id_token(id_token)
            if not id_token:
                raise ValueError("Token is required")
                
            return {
                'uid': 'mock_uid_' + str(hash(id_token))[-8:],
                'email': 'user@example.com',
                'name': 'Test User',
                'picture': None
            }
        except Exception as e:
            raise ValueError(f"Invalid Firebase token: {str(e)}")

    def get_or_create_user(self, firebase_user):
        user = User.query.filter_by(firebase_uid=firebase_user['uid']).first()

        if user:
            # Update existing user
            user.name = firebase_user.get('name', user.name)
            user.profile_picture = firebase_user.get('picture', user.profile_picture)
            user.last_seen = datetime.now(timezone.utc)
        else:
            email = firebase_user.get('email')
            if not email:
                raise ValueError("Email is required from Firebase user but not provided.")

            if User.query.filter_by(username=email).first():
                raise ValueError(f"Username '{email}' is already taken.")

            user = User(
                firebase_uid=firebase_user['uid'],
                email=email,
                username=email,
                name=firebase_user.get('name'),
                profile_picture=firebase_user.get('picture'),
                provider='firebase',
                last_seen=datetime.now(timezone.utc)
            )
            db.session.add(user)
        
        db.session.commit()
        return user
