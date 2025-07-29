from flask_socketio import emit
from models.room import Room
from models.message import Message
from extensions import db
from typing import Dict, Set, List, Optional
from services.presence.presence_manager import PresenceManager


class RoomManager:
    """
    Manages user presence in chat rooms and handles message broadcasting.
    Tracks which users are currently connected to which rooms.
    """
    
    def __init__(self, socketio):
        self.socketio = socketio
        # Track active users in rooms: {room_id: {user_id1, user_id2, ...}}
        self.room_users: Dict[str, Set[int]] = {}
        # Track which rooms each user is in: {user_id: {room_id1, room_id2, ...}}
        self.user_rooms: Dict[int, Set[str]] = {}
        # Initialize presence manager
        self.presence_manager = PresenceManager(socketio)
    
    def add_user_to_room(self, user_id: int, room_id: str) -> bool:
        """
        Add a user to a room's active user list.
        
        Args:
            user_id: The ID of the user to add
            room_id: The ID of the room to add the user to
            
        Returns:
            bool: True if user was successfully added, False otherwise
        """
        try:
            # Initialize room if it doesn't exist
            if room_id not in self.room_users:
                self.room_users[room_id] = set()
            
            # Initialize user if they don't exist
            if user_id not in self.user_rooms:
                self.user_rooms[user_id] = set()
            
            # Add user to room and room to user
            self.room_users[room_id].add(user_id)
            self.user_rooms[user_id].add(room_id)
            
            return True
            
        except Exception as e:
            print(f"Error adding user {user_id} to room {room_id}: {str(e)}")
            return False
    
    def remove_user_from_room(self, user_id: int, room_id: str) -> bool:
        """
        Remove a user from a room's active user list.
        
        Args:
            user_id: The ID of the user to remove
            room_id: The ID of the room to remove the user from
            
        Returns:
            bool: True if user was successfully removed, False otherwise
        """
        try:
            # Remove user from room if they exist
            if room_id in self.room_users and user_id in self.room_users[room_id]:
                self.room_users[room_id].discard(user_id)
                
                # Clean up empty room
                if not self.room_users[room_id]:
                    del self.room_users[room_id]
            
            # Remove room from user if they exist
            if user_id in self.user_rooms and room_id in self.user_rooms[user_id]:
                self.user_rooms[user_id].discard(room_id)
                
                # Clean up user with no rooms
                if not self.user_rooms[user_id]:
                    del self.user_rooms[user_id]
            
            return True
            
        except Exception as e:
            print(f"Error removing user {user_id} from room {room_id}: {str(e)}")
            return False
    
    def remove_user_from_all_rooms(self, user_id: int) -> bool:
        """
        Remove a user from all rooms (typically called on disconnect).
        
        Args:
            user_id: The ID of the user to remove from all rooms
            
        Returns:
            bool: True if user was successfully removed from all rooms
        """
        try:
            if user_id not in self.user_rooms:
                return True
            
            # Get copy of rooms to avoid modification during iteration
            user_room_list = list(self.user_rooms[user_id])
            
            # Remove user from each room
            for room_id in user_room_list:
                self.remove_user_from_room(user_id, room_id)
            
            return True
            
        except Exception as e:
            print(f"Error removing user {user_id} from all rooms: {str(e)}")
            return False
    
    def get_room_users(self, room_id: str) -> Set[int]:
        """
        Get the set of users currently active in a room.
        
        Args:
            room_id: The ID of the room
            
        Returns:
            Set[int]: Set of user IDs currently in the room
        """
        return self.room_users.get(room_id, set())
    
    def get_user_rooms(self, user_id: int) -> Set[str]:
        """
        Get the set of rooms a user is currently in.
        
        Args:
            user_id: The ID of the user
            
        Returns:
            Set[str]: Set of room IDs the user is currently in
        """
        return self.user_rooms.get(user_id, set())
    
    def is_user_in_room(self, user_id: int, room_id: str) -> bool:
        """
        Check if a user is currently in a specific room.
        
        Args:
            user_id: The ID of the user
            room_id: The ID of the room
            
        Returns:
            bool: True if user is in the room, False otherwise
        """
        return (room_id in self.room_users and 
                user_id in self.room_users[room_id])
    
    def broadcast_to_room(self, room_id: str, event: str, data: dict, exclude_user: Optional[int] = None) -> bool:
        """
        Broadcast a message/event to all users in a room.
        
        Args:
            room_id: The ID of the room to broadcast to
            event: The socket event name to emit
            data: The data to send with the event
            exclude_user: Optional user ID to exclude from broadcast (e.g., message sender)
            
        Returns:
            bool: True if broadcast was successful, False otherwise
        """
        try:
            if room_id not in self.room_users:
                return True  # No users in room, nothing to broadcast
            
            users_in_room = self.room_users[room_id].copy()
            
            # Remove excluded user if specified
            if exclude_user and exclude_user in users_in_room:
                users_in_room.discard(exclude_user)
            
            # Broadcast to each user's personal room (socket.io room pattern)
            for user_id in users_in_room:
                user_room = f"user_{user_id}"
                emit(event, data, room=user_room, namespace='/')
            
            return True
            
        except Exception as e:
            print(f"Error broadcasting to room {room_id}: {str(e)}")
            return False
    
    def broadcast_message_to_room(self, room_id: str, message: Message, exclude_sender: bool = True) -> bool:
        """
        Broadcast a message to all users in a room.
        
        Args:
            room_id: The ID of the room to broadcast to
            message: The Message object to broadcast
            exclude_sender: Whether to exclude the message sender from broadcast
            
        Returns:
            bool: True if broadcast was successful, False otherwise
        """
        try:
            message_data = message.to_dict()
            exclude_user = message.sender_id if exclude_sender else None
            
            return self.broadcast_to_room(
                room_id=room_id,
                event='new_message',
                data=message_data,
                exclude_user=exclude_user
            )
            
        except Exception as e:
            print(f"Error broadcasting message to room {room_id}: {str(e)}")
            return False
    
    def get_room_count(self) -> int:
        """
        Get the total number of active rooms.
        
        Returns:
            int: Number of rooms with active users
        """
        return len(self.room_users)
    
    def get_total_users(self) -> int:
        """
        Get the total number of connected users across all rooms.
        
        Returns:
            int: Total number of unique connected users
        """
        return len(self.user_rooms)
    
    def get_room_info(self, room_id: str) -> dict:
        """
        Get information about a specific room.
        
        Args:
            room_id: The ID of the room
            
        Returns:
            dict: Room information including user count and user list
        """
        users_in_room = self.get_room_users(room_id)
        
        return {
            'room_id': room_id,
            'user_count': len(users_in_room),
            'users': list(users_in_room),
            'is_active': len(users_in_room) > 0
        }