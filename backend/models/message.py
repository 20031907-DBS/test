from extensions import db
from datetime import datetime, timezone 

class Message(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    sender_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    room_id = db.Column(db.String(50), nullable=False)
    content = db.Column(db.Text, nullable=False)  # For plain text or encrypted content
    encrypted_aes_key = db.Column(db.Text, nullable=True)  # RSA-encrypted AES key
    iv = db.Column(db.String(255), nullable=True)  # AES initialization vector
    is_encrypted = db.Column(db.Boolean, nullable=False, default=False)
    message_type = db.Column(db.String(20), nullable=False, default='text')
    status = db.Column(db.String(20), nullable=False, default='sent')  # sent, delivered, read
    delivered_at = db.Column(db.DateTime(timezone=True), nullable=True)
    timestamp = db.Column(db.DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc))

    def to_dict(self):
        return {
            'id': self.id,
            'message_id': self.id,  # Keep for backward compatibility
            'sender_id': self.sender_id,
            'room_id': self.room_id,
            'content': self.content,
            'encrypted_aes_key': self.encrypted_aes_key,
            'iv': self.iv,
            'is_encrypted': self.is_encrypted,
            'message_type': self.message_type,
            'status': self.status,
            'delivered_at': self.delivered_at.isoformat() if self.delivered_at else None,
            'timestamp': self.timestamp.isoformat() if self.timestamp else None
        }