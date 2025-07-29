from extensions import db
from datetime import datetime, timezone


class Room(db.Model):
    id = db.Column(db.String(50), primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    room_type = db.Column(db.String(20), nullable=False, default='group')  # 'group', 'direct'
    created_by = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=True)
    created_at = db.Column(db.DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc))
    is_active = db.Column(db.Boolean, default=True, nullable=False)

    # Relationship to get the creator user
    creator = db.relationship('User', backref='created_rooms', lazy=True)

    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'room_type': self.room_type,
            'created_by': self.created_by,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'is_active': self.is_active
        }

    def __repr__(self):
        return f'<Room {self.id}: {self.name}>'