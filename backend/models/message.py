from extensions import db
from datetime import datetime, timezone
import re

class Message(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    sender_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    room_id = db.Column(db.String(50), nullable=False)
    content = db.Column(db.Text, nullable=False)  # For plain text or encrypted content
    encrypted_aes_key = db.Column(db.Text, nullable=True)  # RSA-encrypted AES key
    iv = db.Column(db.String(255), nullable=True)  # AES initialization vector
    signature = db.Column(db.Text, nullable=True)  # RSA signature of the message
    is_encrypted = db.Column(db.Boolean, nullable=False, default=False)
    message_type = db.Column(db.String(20), nullable=False, default='text')
    status = db.Column(db.String(20), nullable=False, default='sent')  # sent, delivered, read
    delivered_at = db.Column(db.DateTime(timezone=True), nullable=True)
    timestamp = db.Column(db.DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc))

    def validate_encrypted_fields(self):
        """Validate that encrypted messages have required fields"""
        if self.is_encrypted:
            # For encrypted messages, we need encrypted_aes_key and iv
            if not self.encrypted_aes_key:
                raise ValueError("Encrypted messages must have encrypted_aes_key")
            if not self.iv:
                raise ValueError("Encrypted messages must have iv")
            # Signature is optional but recommended for encrypted messages
            
        # Validate signature format if present (should be base64-like)
        if self.signature:
            if not re.match(r'^[A-Za-z0-9+/=]+$', self.signature):
                raise ValueError("Invalid signature format")
                
        # Validate IV format if present (should be base64-like)
        if self.iv:
            if not re.match(r'^[A-Za-z0-9+/=]+$', self.iv):
                raise ValueError("Invalid IV format")
                
        return True

    def to_dict(self):
        return {
            'id': self.id,
            'message_id': self.id,  # Keep for backward compatibility
            'sender_id': self.sender_id,
            'room_id': self.room_id,
            'content': self.content,
            'encrypted_aes_key': self.encrypted_aes_key,
            'iv': self.iv,
            'signature': self.signature,
            'is_encrypted': self.is_encrypted,
            'message_type': self.message_type,
            'status': self.status,
            'delivered_at': self.delivered_at.isoformat() if self.delivered_at else None,
            'timestamp': self.timestamp.isoformat() if self.timestamp else None
        }