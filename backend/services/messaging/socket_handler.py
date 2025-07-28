from flask_socketio import emit, join_room, leave_room
from models.message import Message
from models.room import Room
from models.user import User
from extensions import db
from services.messaging.room_manager import RoomManager
from datetime import datetime, timezone
from sqlalchemy import desc

class SocketHandler:
    def __init__(self, socketio):
        self.socketio = socketio
        self.room_manager = RoomManager(socketio)
        self.setup_handlers()
        
    def setup_handlers(self):
        @self.socketio.on('connect')
        def handle_connect(auth_data=None):
            """Handle client connection with session-based authentication"""
            from flask import session, request
            
            print("Client connected")
            
            # Get user_id from session or auth_data
            user_id = session.get('user_id')
            
            # Fallback to auth_data if provided (for backward compatibility)
            if not user_id and auth_data and isinstance(auth_data, dict):
                user_id = auth_data.get('user_id')
            
            if user_id:
                # Update user's online status and last seen
                user = User.query.get(user_id)
                if user:
                    user.last_seen = datetime.now(timezone.utc)
                    user.is_online = True
                    db.session.commit()
                
                # Join user's personal room for direct communication
                personal_room = f"user_{user_id}"
                join_room(personal_room)
                print(f"User {user_id} joined personal room: {personal_room}")
                
                emit('connected', {
                    'status': 'connected',
                    'user_id': user_id,
                    'user_name': user.display_name or user.username,
                    'personal_room': personal_room
                })
                
                # Broadcast user online status
                emit('user_online', {
                    'user_id': user_id,
                    'user_name': user.display_name or user.username,
                    'timestamp': datetime.now(timezone.utc).isoformat()
                }, broadcast=True, include_self=False)
            else:
                emit('connected', {'status': 'connected', 'authenticated': False})
            
        @self.socketio.on('disconnect')
        def handle_disconnect():
            """Handle client disconnection and cleanup"""
            print("Client disconnected")
            
            # Note: In a production app, we'd need to track user_id per session
            # For now, we'll handle cleanup when we have better session management
            # TODO: Implement proper user session tracking and offline status updates
            
        @self.socketio.on('join_room')
        def handle_join_room(data):
            """Join a chat room for group conversations"""
            try:
                user_id = data.get('user_id')
                room_id = data.get('room_id')
                
                if not user_id or not room_id:
                    emit('room_join_error', {
                        'status': 'error',
                        'message': 'user_id and room_id are required'
                    })
                    return
                
                # Check if room exists, create if it doesn't (for 'general' room)
                room = Room.query.filter_by(id=room_id).first()
                if not room and room_id == 'general':
                    # Auto-create general room
                    room = Room(
                        id='general',
                        name='General Chat',
                        created_by=user_id
                    )
                    db.session.add(room)
                    db.session.commit()
                elif not room:
                    emit('room_join_error', {
                        'status': 'error',
                        'message': f'Room {room_id} does not exist'
                    })
                    return
                
                # Add user to room in room manager
                success = self.room_manager.add_user_to_room(user_id, room_id)
                
                if success:
                    # Join the socket.io room
                    join_room(room_id)
                    
                    emit('room_joined', {
                        'status': 'joined',
                        'room_id': room_id,
                        'room_name': room.name,
                        'user_count': len(self.room_manager.get_room_users(room_id))
                    })
                    
                    print(f"User {user_id} joined room: {room_id}")
                else:
                    emit('room_join_error', {
                        'status': 'error',
                        'message': 'Failed to join room'
                    })
                    
            except Exception as e:
                print(f"Error in join_room: {str(e)}")
                emit('room_join_error', {
                    'status': 'error',
                    'message': 'Internal server error'
                })
        
        @self.socketio.on('leave_room')
        def handle_leave_room(data):
            """Leave a chat room"""
            try:
                user_id = data.get('user_id')
                room_id = data.get('room_id')
                
                if not user_id or not room_id:
                    emit('room_leave_error', {
                        'status': 'error',
                        'message': 'user_id and room_id are required'
                    })
                    return
                
                # Remove user from room in room manager
                success = self.room_manager.remove_user_from_room(user_id, room_id)
                
                if success:
                    # Leave the socket.io room
                    leave_room(room_id)
                    
                    emit('room_left', {
                        'status': 'left',
                        'room_id': room_id
                    })
                    
                    print(f"User {user_id} left room: {room_id}")
                else:
                    emit('room_leave_error', {
                        'status': 'error',
                        'message': 'Failed to leave room'
                    })
                    
            except Exception as e:
                print(f"Error in leave_room: {str(e)}")
                emit('room_leave_error', {
                    'status': 'error',
                    'message': 'Internal server error'
                })
                
        @self.socketio.on('send_message')
        def handle_send_message(data):
            """Send a message to a chat room (supports both plain text and encrypted)"""
            try:
                sender_id = data.get('sender_id')
                room_id = data.get('room_id')
                content = data.get('content')
                message_type = data.get('message_type', 'text')
                
                # Encryption fields (optional)
                encrypted_aes_key = data.get('encrypted_aes_key')
                iv = data.get('iv')
                is_encrypted = data.get('is_encrypted', False)
                
                if not sender_id or not room_id or not content:
                    emit('message_error', {
                        'status': 'error',
                        'message': 'sender_id, room_id, and content are required'
                    })
                    return
                
                # Verify user is in the room
                if not self.room_manager.is_user_in_room(sender_id, room_id):
                    emit('message_error', {
                        'status': 'error',
                        'message': 'User is not in the specified room'
                    })
                    return
                
                # Create and store the message
                message = Message(
                    sender_id=sender_id,
                    room_id=room_id,
                    content=content,
                    encrypted_aes_key=encrypted_aes_key,
                    iv=iv,
                    is_encrypted=is_encrypted,
                    message_type=message_type
                )
                
                db.session.add(message)
                db.session.commit()
                
                # Send confirmation to sender
                emit('message_sent', {
                    'status': 'sent',
                    'message_id': message.id,
                    'timestamp': message.timestamp.isoformat()
                })
                
                # Broadcast message to all users in the room (excluding sender)
                broadcast_success = self.room_manager.broadcast_message_to_room(
                    room_id=room_id,
                    message=message,
                    exclude_sender=True
                )
                
                if not broadcast_success:
                    print(f"Warning: Failed to broadcast message {message.id} to room {room_id}")
                
                print(f"Message {message.id} sent to room {room_id} by user {sender_id} (encrypted: {is_encrypted})")
                
            except Exception as e:
                print(f"Error in send_message: {str(e)}")
                emit('message_error', {
                    'status': 'error',
                    'message': 'Failed to send message'
                })
                
        # Keep legacy relay_message handler for backward compatibility
        @self.socketio.on('relay_message')
        def handle_legacy_message(data):
            """Legacy message handler for backward compatibility"""
            print("Warning: relay_message is deprecated, use send_message instead")
            
            # Convert legacy format to new format
            legacy_data = {
                'sender_id': data.get('sender_id'),
                'room_id': data.get('room_id', 'general'),
                'content': data.get('content', data.get('encrypted_message', '')),
                'message_type': data.get('message_type', 'text')
            }
            
            # Call the new handler
            handle_send_message(legacy_data)
            
        @self.socketio.on('get_chats')
        def handle_get_chats(data):
            """Get user's chat list with recent messages and unread counts"""
            try:
                user_id = data.get('user_id')
                
                if not user_id:
                    emit('chat_list_error', {
                        'status': 'error',
                        'message': 'user_id is required'
                    })
                    return
                
                # Get all rooms the user has participated in
                user_rooms = db.session.query(Room).join(
                    Message, Room.id == Message.room_id
                ).filter(Message.sender_id == user_id).distinct().all()
                
                # Also include default rooms
                default_rooms = Room.query.filter(Room.id.in_(['general', 'tech-talk', 'random'])).all()
                
                # Combine and deduplicate
                all_rooms = {room.id: room for room in user_rooms + default_rooms}
                
                chat_list = []
                for room in all_rooms.values():
                    # Get last message
                    last_message = Message.query.filter_by(room_id=room.id).order_by(desc(Message.timestamp)).first()
                    
                    # Get unread count (simplified - in production, track read status per user)
                    unread_count = 0  # TODO: Implement proper unread tracking
                    
                    chat_info = {
                        'id': room.id,
                        'name': room.name,
                        'room_type': getattr(room, 'room_type', 'group'),
                        'last_message': last_message.content if last_message else 'No messages yet',
                        'last_message_time': last_message.timestamp.isoformat() if last_message else room.created_at.isoformat(),
                        'unread_count': unread_count,
                        'is_online': True  # TODO: Implement proper online status
                    }
                    chat_list.append(chat_info)
                
                # Sort by last activity
                chat_list.sort(key=lambda x: x['last_message_time'], reverse=True)
                
                emit('chat_list', {
                    'status': 'success',
                    'chats': chat_list
                })
                
            except Exception as e:
                print(f"Error in get_chats: {str(e)}")
                emit('chat_list_error', {
                    'status': 'error',
                    'message': 'Failed to retrieve chat list'
                })
                
        @self.socketio.on('get_chat_history')
        def handle_get_chat_history(data):
            """Get message history for a specific chat room"""
            try:
                user_id = data.get('user_id')
                room_id = data.get('room_id')
                limit = data.get('limit', 50)
                offset = data.get('offset', 0)
                
                if not user_id or not room_id:
                    emit('chat_history_error', {
                        'status': 'error',
                        'message': 'user_id and room_id are required'
                    })
                    return
                
                # Get messages for the room
                messages = Message.query.filter_by(room_id=room_id)\
                    .order_by(desc(Message.timestamp))\
                    .offset(offset)\
                    .limit(limit)\
                    .all()
                
                # Get sender information
                message_list = []
                for msg in reversed(messages):  # Reverse to get chronological order
                    sender = User.query.get(msg.sender_id)
                    message_data = msg.to_dict()
                    message_data['sender_name'] = sender.name or sender.username if sender else 'Unknown'
                    message_data['sender_email'] = sender.email if sender else 'unknown@example.com'
                    message_list.append(message_data)
                
                emit('chat_history', {
                    'status': 'success',
                    'room_id': room_id,
                    'messages': message_list,
                    'has_more': len(messages) == limit
                })
                
            except Exception as e:
                print(f"Error in get_chat_history: {str(e)}")
                emit('chat_history_error', {
                    'status': 'error',
                    'message': 'Failed to retrieve chat history'
                })
                
        @self.socketio.on('typing_start')
        def handle_typing_start(data):
            """Handle user started typing"""
            try:
                user_id = data.get('user_id')
                room_id = data.get('room_id')
                
                if not user_id or not room_id:
                    return
                
                # Get user info
                user = User.query.get(user_id)
                if not user:
                    return
                
                # Broadcast typing indicator to room (excluding sender)
                emit('typing_indicator', {
                    'user_id': user_id,
                    'user_name': user.name or user.username,
                    'room_id': room_id,
                    'is_typing': True
                }, room=room_id, include_self=False)
                
            except Exception as e:
                print(f"Error in typing_start: {str(e)}")
                
        @self.socketio.on('typing_stop')
        def handle_typing_stop(data):
            """Handle user stopped typing"""
            try:
                user_id = data.get('user_id')
                room_id = data.get('room_id')
                
                if not user_id or not room_id:
                    return
                
                # Get user info
                user = User.query.get(user_id)
                if not user:
                    return
                
                # Broadcast typing stopped to room (excluding sender)
                emit('typing_indicator', {
                    'user_id': user_id,
                    'user_name': user.name or user.username,
                    'room_id': room_id,
                    'is_typing': False
                }, room=room_id, include_self=False)
                
            except Exception as e:
                print(f"Error in typing_stop: {str(e)}")
                
        @self.socketio.on('message_delivered')
        def handle_message_delivered(data):
            """Mark message as delivered"""
            try:
                message_id = data.get('message_id')
                user_id = data.get('user_id')
                
                if not message_id or not user_id:
                    return
                
                # Update message status (in a real app, you'd track delivery per recipient)
                message = Message.query.get(message_id)
                if message:
                    # For now, just emit back to sender that message was delivered
                    emit('message_status_update', {
                        'message_id': message_id,
                        'status': 'delivered',
                        'timestamp': datetime.now(timezone.utc).isoformat()
                    }, room=f"user_{message.sender_id}")
                
            except Exception as e:
                print(f"Error in message_delivered: {str(e)}") 