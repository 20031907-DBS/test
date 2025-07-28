from datetime import datetime, timezone
from models.user import User
from extensions import db

class PresenceManager:
    def __init__(self, socketio):
        self.socketio = socketio
        self.online_users = set()  # In production, use Redis for scalability
        
    def set_user_online(self, user_id):
        """Mark user as online"""
        try:
            self.online_users.add(user_id)
            
            # Update database
            user = User.query.get(user_id)
            if user:
                user.last_seen = datetime.now(timezone.utc)
                db.session.commit()
                
            # Broadcast online status
            self.socketio.emit('user_online', {
                'user_id': user_id,
                'timestamp': datetime.now(timezone.utc).isoformat()
            }, broadcast=True)
            
            return True
        except Exception as e:
            print(f"Error setting user online: {str(e)}")
            return False
            
    def set_user_offline(self, user_id):
        """Mark user as offline"""
        try:
            self.online_users.discard(user_id)
            
            # Update database
            user = User.query.get(user_id)
            if user:
                user.last_seen = datetime.now(timezone.utc)
                db.session.commit()
                
            # Broadcast offline status
            self.socketio.emit('user_offline', {
                'user_id': user_id,
                'timestamp': datetime.now(timezone.utc).isoformat()
            }, broadcast=True)
            
            return True
        except Exception as e:
            print(f"Error setting user offline: {str(e)}")
            return False
            
    def get_user_status(self, user_id):
        """Get user's online status"""
        return user_id in self.online_users
        
    def get_online_users(self):
        """Get list of online users"""
        return list(self.online_users)
        
    def get_online_contacts(self, user_id):
        """Get online status of user's contacts"""
        # In a real app, you'd get the user's contact list
        # For now, return all online users
        online_contacts = []
        for online_user_id in self.online_users:
            if online_user_id != user_id:
                user = User.query.get(online_user_id)
                if user:
                    online_contacts.append({
                        'user_id': online_user_id,
                        'name': user.name or user.username,
                        'email': user.email
                    })
        return online_contacts
        
    def broadcast_presence_update(self, user_id, status):
        """Broadcast presence update to relevant users"""
        try:
            self.socketio.emit('presence_update', {
                'user_id': user_id,
                'status': status,
                'timestamp': datetime.now(timezone.utc).isoformat()
            }, broadcast=True)
            return True
        except Exception as e:
            print(f"Error broadcasting presence update: {str(e)}")
            return False