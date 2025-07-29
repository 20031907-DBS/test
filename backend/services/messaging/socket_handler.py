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
                    
                    # Mark user as online in presence manager
                    self.room_manager.presence_manager.set_user_online(user_id)
                    
                    # Join user's personal room for direct communication
                    personal_room = f"user_{user_id}"
                    join_room(personal_room)
                    print(f"User {user_id} joined personal room: {personal_room}")
                    
                    # Get user display name safely
                    user_name = user.display_name or user.name or user.username or f"User {user_id}"
                    
                    emit('connected', {
                        'status': 'connected',
                        'user_id': user_id,
                        'user_name': user_name,
                        'personal_room': personal_room
                    })
                    
                    # Broadcast user online status
                    emit('user_online', {
                        'user_id': user_id,
                        'user_name': user_name,
                        'timestamp': datetime.now(timezone.utc).isoformat()
                    }, broadcast=True, include_self=False)
                else:
                    print(f"Warning: User {user_id} not found in database")
                    emit('connected', {
                        'status': 'connected', 
                        'authenticated': False,
                        'error': 'User not found'
                    })
            else:
                emit('connected', {'status': 'connected', 'authenticated': False})
            
        @self.socketio.on('disconnect')
        def handle_disconnect():
            """Handle client disconnection and cleanup"""
            from flask import session
            
            print("Client disconnected")
            
            # Get user_id from session and mark as offline
            user_id = session.get('user_id')
            if user_id:
                self.room_manager.presence_manager.set_user_offline(user_id)
                print(f"User {user_id} marked as offline")
            
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
                
                # Check if room exists, create if it doesn't
                room = Room.query.filter_by(id=room_id).first()
                if not room:
                    if room_id == 'general':
                        # Auto-create general room
                        room = Room(
                            id='general',
                            name='General Chat',
                            room_type='group',
                            created_by=user_id
                        )
                    elif '_' in room_id and len(room_id.split('_')) == 2:
                        # Auto-create direct message room (format: user1_user2)
                        user_ids = room_id.split('_')
                        try:
                            user1_id = int(user_ids[0])
                            user2_id = int(user_ids[1])
                            
                            # Verify both users exist
                            user1 = User.query.get(user1_id)
                            user2 = User.query.get(user2_id)
                            
                            if user1 and user2:
                                room = Room(
                                    id=room_id,
                                    name=f"DM: {user1.display_name or user1.username} & {user2.display_name or user2.username}",
                                    room_type='direct',
                                    created_by=user_id
                                )
                            else:
                                emit('room_join_error', {
                                    'status': 'error',
                                    'message': f'One or both users in room {room_id} do not exist'
                                })
                                return
                        except ValueError:
                            emit('room_join_error', {
                                'status': 'error',
                                'message': f'Invalid room ID format: {room_id}'
                            })
                            return
                    else:
                        emit('room_join_error', {
                            'status': 'error',
                            'message': f'Room {room_id} does not exist'
                        })
                        return
                    
                    # Save the new room
                    db.session.add(room)
                    db.session.commit()
                    print(f"Created new room: {room_id} ({room.room_type})")
                
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
                signature = data.get('signature')
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
                    signature=signature,
                    is_encrypted=is_encrypted,
                    message_type=message_type
                )
                
                # Validate encrypted message fields
                try:
                    message.validate_encrypted_fields()
                except ValueError as ve:
                    emit('message_error', {
                        'status': 'error',
                        'message': f'Message validation failed: {str(ve)}'
                    })
                    return
                
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
                    'user_name': user.display_name or user.name or user.username,
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
                    'user_name': user.display_name or user.name or user.username,
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
                
        @self.socketio.on('get_online_users')
        def handle_get_online_users():
            """Get list of currently online users"""
            try:
                from flask import session
                
                # Get current user from session
                current_user_id = session.get('user_id')
                print(f"get_online_users: current_user_id = {current_user_id}")
                
                if not current_user_id:
                    print("get_online_users: No current user in session")
                    emit('online_users_list', {'status': 'error', 'users': []})
                    return
                
                # Get all online users except current user
                online_user_ids = self.room_manager.presence_manager.get_online_users()
                print(f"get_online_users: online_user_ids = {online_user_ids}")
                
                online_users = []
                for user_id in online_user_ids:
                    if user_id != current_user_id:
                        user = User.query.get(user_id)
                        if user:
                            online_users.append({
                                'id': user.id,
                                'username': user.username,
                                'name': user.name or user.username,
                                'email': user.email,
                                'display_name': user.display_name or user.name or user.username,
                                'last_seen': user.last_seen.isoformat() if user.last_seen else None,
                                'is_online': True
                            })
                            print(f"get_online_users: Added user {user.id} - {user.username}")
                
                print(f"get_online_users: Returning {len(online_users)} users")
                emit('online_users_list', {
                    'status': 'success',
                    'users': online_users
                })
                
            except Exception as e:
                print(f"Error in get_online_users: {str(e)}")
                import traceback
                traceback.print_exc()
                emit('online_users_list', {
                    'status': 'error',
                    'message': 'Failed to get online users',
                    'users': []
                })
                
        @self.socketio.on('get_all_users')
        def handle_get_all_users():
            """Get list of all registered users (online and offline)"""
            try:
                from flask import session
                
                # Get current user from session
                current_user_id = session.get('user_id')
                print(f"get_all_users: current_user_id = {current_user_id}")
                
                if not current_user_id:
                    print("get_all_users: No current user in session")
                    emit('all_users_list', {'status': 'error', 'users': []})
                    return
                
                # Get all users except current user
                all_users_query = User.query.filter(User.id != current_user_id).all()
                online_user_ids = set(self.room_manager.presence_manager.get_online_users())
                
                all_users = []
                for user in all_users_query:
                    is_online = user.id in online_user_ids
                    all_users.append({
                        'id': user.id,
                        'username': user.username,
                        'name': user.name or user.username,
                        'email': user.email,
                        'display_name': user.display_name or user.name or user.username,
                        'last_seen': user.last_seen.isoformat() if user.last_seen else None,
                        'is_online': is_online
                    })
                    print(f"get_all_users: Added user {user.id} - {user.username} (online: {is_online})")
                
                print(f"get_all_users: Returning {len(all_users)} users")
                emit('all_users_list', {
                    'status': 'success',
                    'users': all_users
                })
                
            except Exception as e:
                print(f"Error in get_all_users: {str(e)}")
                import traceback
                traceback.print_exc()
                emit('all_users_list', {
                    'status': 'error',
                    'message': 'Failed to get all users',
                    'users': []
                })
                
        @self.socketio.on('start_direct_message')
        def handle_start_direct_message(data):
            """Start a direct message conversation with another user"""
            try:
                from flask import session
                
                current_user_id = session.get('user_id')
                target_user_id = data.get('target_user_id')
                room_id = data.get('room_id')
                
                if not current_user_id or not target_user_id:
                    emit('direct_message_error', {
                        'status': 'error',
                        'message': 'current_user_id and target_user_id are required'
                    })
                    return
                
                # Verify target user exists and is online
                target_user = User.query.get(target_user_id)
                if not target_user:
                    emit('direct_message_error', {
                        'status': 'error',
                        'message': 'Target user not found'
                    })
                    return
                
                # Generate room ID if not provided
                if not room_id:
                    room_id = f"{min(current_user_id, target_user_id)}_dm_{max(current_user_id, target_user_id)}"
                
                # Create or get the direct message room
                room = Room.query.filter_by(id=room_id).first()
                if not room:
                    room = Room(
                        id=room_id,
                        name=f"DM: {current_user_id}-{target_user_id}",
                        room_type='direct',
                        created_by=current_user_id
                    )
                    db.session.add(room)
                    db.session.commit()
                
                # Add both users to the room
                self.room_manager.add_user_to_room(current_user_id, room_id)
                self.room_manager.add_user_to_room(target_user_id, room_id)
                
                # Join the socket.io room
                join_room(room_id)
                
                # Notify both users
                emit('direct_message_created', {
                    'status': 'created',
                    'room_id': room_id,
                    'target_user': {
                        'id': target_user.id,
                        'username': target_user.username,
                        'name': target_user.name,
                        'email': target_user.email,
                        'display_name': target_user.display_name
                    }
                })
                
                # Notify target user
                current_user = User.query.get(current_user_id)
                emit('direct_message_created', {
                    'status': 'created',
                    'room_id': room_id,
                    'target_user': {
                        'id': current_user_id,
                        'username': current_user.username if current_user else f"user_{current_user_id}",
                        'name': current_user.name if current_user else None,
                        'email': current_user.email if current_user else None,
                        'display_name': current_user.display_name if current_user else None
                    }
                }, room=f"user_{target_user_id}")
                
                print(f"Direct message room {room_id} created between {current_user_id} and {target_user_id}")
                
            except Exception as e:
                print(f"Error in start_direct_message: {str(e)}")
                emit('direct_message_error', {
                    'status': 'error',
                    'message': 'Failed to start direct message'
                }) 