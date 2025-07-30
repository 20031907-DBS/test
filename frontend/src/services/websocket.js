import { io } from 'socket.io-client';
import { AppError, ErrorCodes, logError, retryWithBackoff } from '../utils/errorHandler';
import { validateMessage, validateRoomId, validateUserId, sanitizeMessage } from '../utils/validation';

class WebSocketService {
  constructor() {
    this.socket = null;
    this.isConnected = false;
    this.connectionCallbacks = [];
    this.messageCallbacks = [];
    this.roomCallbacks = [];
    this.errorCallbacks = [];
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 3;
    this.currentRoom = null;
    this.pendingRoomJoin = null;
    this.reconnectTimer = null;
    this.connectionError = null;
    this.pendingMessages = [];
    this.isReconnecting = false;
    this.typingCallbacks = [];
    this.presenceCallbacks = [];
    this.typingTimer = null;
  }

  /**
   * Find available server port
   */
  findAvailableServer() {
    // Try common ports the backend might be running on
    const ports = [5000, 5001, 5002, 5003, 8000];
    // For now, just return the first one - in a real app you'd test connectivity
    return `http://localhost:${ports[0]}`;
  }

  /**
   * Connect to the WebSocket server
   */
  connect(userId, token) {
    if (this.socket && this.isConnected) {
      console.log('WebSocket already connected');
      return;
    }

    // Get server URL from environment or try common ports
    const serverUrl = process.env.NEXT_PUBLIC_WEBSOCKET_URL || this.findAvailableServer();

    this.socket = io(serverUrl, {
      auth: {
        user_id: userId,
        userId, // Keep for backward compatibility
        token
      },
      transports: ['websocket', 'polling'],
      timeout: 20000,
      withCredentials: true, // Important for session-based auth
    });

    this.setupEventListeners();
  }

  /**
   * Disconnect from the WebSocket server
   */
  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.isConnected = false;
      this.reconnectAttempts = 0;
      this.notifyConnectionStatus(false);
    }
  }

  /**
   * Join a specific chat room
   */
  joinRoom(roomId) {
    if (!roomId) {
      console.error('Cannot join room: roomId is required');
      return;
    }

    if (this.socket && this.isConnected) {
      // Get user_id from auth data stored during connection
      const userId = this.socket.auth?.userId;
      if (!userId) {
        console.error('Cannot join room: userId not found in auth data');
        this.pendingRoomJoin = roomId;
        return;
      }

      console.log(`Joining room: ${roomId} with user: ${userId}`);
      this.socket.emit('join_room', {
        room_id: roomId,
        user_id: userId
      });
      this.pendingRoomJoin = roomId;
    } else {
      console.log(`WebSocket not connected, storing room ${roomId} for later join`);
      // Store the room to join once connected
      this.pendingRoomJoin = roomId;
    }
  }

  /**
   * Leave a specific chat room
   */
  leaveRoom(roomId) {
    if (this.socket && this.isConnected) {
      // Get user_id from auth data stored during connection
      const userId = this.socket.auth?.userId;
      this.socket.emit('leave_room', {
        room_id: roomId,
        user_id: userId
      });
      if (this.currentRoom === roomId) {
        this.currentRoom = null;
        this.notifyRoomStatus(null);
      }
    } else {
      console.error('Cannot leave room: WebSocket not connected');
    }
  }

  /**
   * Validate encrypted message data format
   */
  validateEncryptedMessageData(encryptionData) {
    if (!encryptionData.is_encrypted) {
      return null; // No validation needed for unencrypted messages
    }

    const errors = [];

    if (!encryptionData.encrypted_aes_key) {
      errors.push('Encrypted AES key is required for encrypted messages');
    }

    if (!encryptionData.iv) {
      errors.push('Initialization vector (IV) is required for encrypted messages');
    }

    // Signature is optional but should be validated if present
    if (encryptionData.signature && typeof encryptionData.signature !== 'string') {
      errors.push('Message signature must be a string');
    }

    return errors.length > 0 ? errors[0] : null;
  }

  /**
   * Send a message to a room
   */
  sendMessage(roomId, message, encryptionData = {}) {
    try {
      // Validate inputs
      const roomError = validateRoomId(roomId);
      if (roomError) {
        throw new AppError(roomError, ErrorCodes.VALIDATION_ERROR);
      }

      const userError = validateUserId(this.socket?.auth?.userId);
      if (userError) {
        throw new AppError(userError, ErrorCodes.VALIDATION_ERROR);
      }

      const messageErrors = validateMessage(message);
      if (messageErrors.length > 0) {
        throw new AppError(messageErrors[0], ErrorCodes.VALIDATION_ERROR);
      }

      // Validate encryption data if message is encrypted
      const encryptionError = this.validateEncryptedMessageData(encryptionData);
      if (encryptionError) {
        throw new AppError(encryptionError, ErrorCodes.VALIDATION_ERROR);
      }

      // Sanitize message content
      const sanitizedMessage = sanitizeMessage(message);

      const messageData = {
        sender_id: this.socket.auth.userId,
        room_id: roomId,
        content: sanitizedMessage,
        message_type: 'text',
        id: `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`, // Unique ID for tracking
        timestamp: new Date().toISOString(),
        // Encryption fields
        encrypted_aes_key: encryptionData.encrypted_aes_key || null,
        iv: encryptionData.iv || null,
        signature: encryptionData.signature || null,
        is_encrypted: encryptionData.is_encrypted || false
      };

      if (this.socket && this.isConnected) {
        try {
          this.socket.emit('send_message', messageData);
          return { success: true, messageId: messageData.id };
        } catch (error) {
          const appError = new AppError('Failed to send message', ErrorCodes.WEBSOCKET_ERROR, { originalError: error });
          logError(appError, { messageData });
          this.notifyError(appError.message, 'send_message', { messageData, error: error.message });
          return { success: false, error: appError.message, messageId: messageData.id };
        }
      } else {
        // Queue message for retry when reconnected
        this.pendingMessages.push(messageData);
        const errorMsg = this.isReconnecting ? 'Reconnecting... Message will be sent when connected.' : 'WebSocket not connected';
        this.notifyError(errorMsg, 'send_message', { messageData });
        return { success: false, error: errorMsg, messageId: messageData.id, queued: true };
      }
    } catch (error) {
      if (error instanceof AppError) {
        logError(error, { roomId, message });
        this.notifyError(error.message, 'send_message', error.details);
        return { success: false, error: error.message };
      } else {
        const appError = new AppError('Unexpected error sending message', ErrorCodes.UNKNOWN_ERROR, { originalError: error });
        logError(appError, { roomId, message });
        this.notifyError(appError.message, 'send_message', appError.details);
        return { success: false, error: appError.message };
      }
    }
  }

  /**
   * Register callback for incoming messages
   */
  onMessage(callback) {
    this.messageCallbacks.push(callback);
  }

  /**
   * Register callback for connection status changes
   */
  onConnectionStatus(callback) {
    this.connectionCallbacks.push(callback);
  }

  /**
   * Register callback for room status changes
   */
  onRoomStatus(callback) {
    this.roomCallbacks.push(callback);
  }

  /**
   * Register callback for error notifications
   */
  onError(callback) {
    this.errorCallbacks.push(callback);
  }

  /**
   * Register callback for typing indicators
   */
  onTyping(callback) {
    this.typingCallbacks.push(callback);
  }

  /**
   * Register callback for presence updates
   */
  onPresence(callback) {
    this.presenceCallbacks.push(callback);
  }

  /**
   * Remove message callback
   */
  removeMessageCallback(callback) {
    this.messageCallbacks = this.messageCallbacks.filter(cb => cb !== callback);
  }

  /**
   * Remove connection status callback
   */
  removeConnectionCallback(callback) {
    this.connectionCallbacks = this.connectionCallbacks.filter(cb => cb !== callback);
  }

  /**
   * Remove room status callback
   */
  removeRoomCallback(callback) {
    this.roomCallbacks = this.roomCallbacks.filter(cb => cb !== callback);
  }

  /**
   * Remove error callback
   */
  removeErrorCallback(callback) {
    this.errorCallbacks = this.errorCallbacks.filter(cb => cb !== callback);
  }

  /**
   * Remove typing callback
   */
  removeTypingCallback(callback) {
    this.typingCallbacks = this.typingCallbacks.filter(cb => cb !== callback);
  }

  /**
   * Remove presence callback
   */
  removePresenceCallback(callback) {
    this.presenceCallbacks = this.presenceCallbacks.filter(cb => cb !== callback);
  }

  /**
   * Setup event listeners for the socket
   */
  setupEventListeners() {
    if (!this.socket) return;

    // Connection established
    this.socket.on('connect', () => {
      console.log('WebSocket connected');
      this.isConnected = true;
      this.isReconnecting = false;
      this.reconnectAttempts = 0;
      this.connectionError = null;

      // Clear any existing reconnect timer
      if (this.reconnectTimer) {
        clearTimeout(this.reconnectTimer);
        this.reconnectTimer = null;
      }

      this.notifyConnectionStatus(true);

      // Auto-join pending room if any
      if (this.pendingRoomJoin) {
        const roomToJoin = this.pendingRoomJoin;
        this.pendingRoomJoin = null; // Clear it first to avoid loops
        setTimeout(() => {
          this.joinRoom(roomToJoin);
        }, 100);
      }

      // Send any pending messages
      this.sendPendingMessages();
    });

    // Connection lost
    this.socket.on('disconnect', (reason) => {
      console.log('WebSocket disconnected:', reason);
      this.isConnected = false;
      this.connectionError = `Disconnected: ${reason}`;
      this.notifyConnectionStatus(false, this.connectionError);

      // Attempt reconnection if not manually disconnected
      if (reason !== 'io client disconnect') {
        this.isReconnecting = true;
        this.attemptReconnection();
      }
    });

    // Connection error
    this.socket.on('connect_error', (error) => {
      console.error('WebSocket connection error:', error);
      this.isConnected = false;
      this.connectionError = error.message || 'Connection failed';

      // Provide more specific error messages
      let userFriendlyError = 'Connection failed';
      if (error.message?.includes('ECONNREFUSED')) {
        userFriendlyError = 'Backend server is not running. Please start the backend server.';
      } else if (error.message?.includes('timeout')) {
        userFriendlyError = 'Connection timeout. Please check your network connection.';
      } else if (error.message?.includes('unauthorized')) {
        userFriendlyError = 'Authentication failed. Please log in again.';
      }

      this.notifyConnectionStatus(false, userFriendlyError);
      this.notifyError(userFriendlyError, 'connect_error', { error: error.message });

      if (!this.isReconnecting) {
        this.isReconnecting = true;
        this.attemptReconnection();
      }
    });

    // Incoming messages
    this.socket.on('new_message', (messageData) => {
      this.messageCallbacks.forEach(callback => {
        try {
          callback(messageData);
        } catch (error) {
          console.error('Error in message callback:', error);
        }
      });
    });

    // Room joined confirmation
    this.socket.on('room_joined', (data) => {
      console.log('Joined room:', data.room_id);
      this.currentRoom = data.room_id;
      this.pendingRoomJoin = null;
      this.notifyRoomStatus(data.room_id);
    });

    // Room left confirmation
    this.socket.on('room_left', (data) => {
      console.log('Left room:', data.room_id);
      if (this.currentRoom === data.room_id) {
        this.currentRoom = null;
        this.notifyRoomStatus(null);
      }
    });

    // Message sent confirmation
    this.socket.on('message_sent', (data) => {
      console.log('Message sent successfully:', data);
    });

    // Room join error handling
    this.socket.on('room_join_error', (data) => {
      console.error('Room join error:', data.message);
      this.pendingRoomJoin = null;
    });

    // Room leave error handling
    this.socket.on('room_leave_error', (data) => {
      console.error('Room leave error:', data.message);
    });

    // Message error handling
    this.socket.on('message_error', (data) => {
      console.error('Message error:', data.message);
      this.notifyError('Message failed to send', 'message_error', data);
    });

    // Typing indicators
    this.socket.on('typing_indicator', (data) => {
      this.typingCallbacks.forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error('Error in typing callback:', error);
        }
      });
    });

    // Presence updates
    this.socket.on('user_online', (data) => {
      this.presenceCallbacks.forEach(callback => {
        try {
          callback({ ...data, status: 'online' });
        } catch (error) {
          console.error('Error in presence callback:', error);
        }
      });
    });

    this.socket.on('user_offline', (data) => {
      this.presenceCallbacks.forEach(callback => {
        try {
          callback({ ...data, status: 'offline' });
        } catch (error) {
          console.error('Error in presence callback:', error);
        }
      });
    });

    // Message status updates
    this.socket.on('message_status_update', (data) => {
      this.messageCallbacks.forEach(callback => {
        try {
          callback({ ...data, type: 'status_update' });
        } catch (error) {
          console.error('Error in message status callback:', error);
        }
      });
    });

    // Online users list response
    this.socket.on('online_users_list', (data) => {
      console.log('WebSocketService: Received online users list:', data);
      // This will be handled by components that listen for this event
    });

    // All users list response - Let components handle this directly
    // Removed WebSocketService listener to avoid conflicts

    // Direct message room created
    this.socket.on('direct_message_created', (data) => {
      console.log('Direct message room created:', data);
      if (data.room_id) {
        this.joinRoom(data.room_id);
      }
    });
  }

  /**
   * Attempt to reconnect to the server
   */
  attemptReconnection() {
    // Clear any existing timer
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('Max reconnection attempts reached');
      this.isReconnecting = false;
      this.connectionError = 'Max reconnection attempts reached. Please refresh the page.';
      this.notifyConnectionStatus(false, this.connectionError);
      this.notifyError('Connection failed permanently', 'max_reconnect_attempts', {
        attempts: this.reconnectAttempts,
        maxAttempts: this.maxReconnectAttempts
      });
      return;
    }

    this.reconnectAttempts++;
    const delay = Math.min(Math.pow(2, this.reconnectAttempts) * 1000, 30000); // Exponential backoff, max 30s

    console.log(`Attempting reconnection ${this.reconnectAttempts}/${this.maxReconnectAttempts} in ${delay}ms`);

    this.connectionError = `Reconnecting... (${this.reconnectAttempts}/${this.maxReconnectAttempts})`;
    this.notifyConnectionStatus(false, this.connectionError);

    this.reconnectTimer = setTimeout(() => {
      if (this.socket && !this.isConnected) {
        try {
          this.socket.connect();
        } catch (error) {
          console.error('Reconnection attempt failed:', error);
          this.attemptReconnection(); // Try again
        }
      }
    }, delay);
  }

  /**
   * Notify all connection status callbacks
   */
  notifyConnectionStatus(connected, error = null) {
    this.connectionCallbacks.forEach(callback => {
      try {
        callback({ connected, error });
      } catch (error) {
        console.error('Error in connection status callback:', error);
      }
    });
  }

  /**
   * Get current connection status
   */
  getConnectionStatus() {
    return this.isConnected;
  }

  /**
   * Get detailed connection info for debugging
   */
  getConnectionInfo() {
    return {
      isConnected: this.isConnected,
      isReconnecting: this.isReconnecting,
      reconnectAttempts: this.reconnectAttempts,
      currentRoom: this.currentRoom,
      pendingRoomJoin: this.pendingRoomJoin,
      connectionError: this.connectionError,
      hasSocket: !!this.socket,
      socketConnected: this.socket?.connected,
      socketId: this.socket?.id,
      auth: this.socket?.auth
    };
  }

  /**
   * Test connection to backend server
   */
  async testConnection() {
    const serverUrl = process.env.NEXT_PUBLIC_WEBSOCKET_URL || this.findAvailableServer();

    try {
      const response = await fetch(`${serverUrl}/health`, {
        method: 'GET',
        timeout: 5000
      });
      return {
        success: response.ok,
        status: response.status,
        serverUrl
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        serverUrl
      };
    }
  }

  /**
   * Get current rooms
   */
  getCurrentRoom() {
    return this.currentRoom;
  }

  /**
   * Notify all room status callbacks
   */
  notifyRoomStatus(roomId) {
    this.roomCallbacks.forEach(callback => {
      try {
        callback(roomId);
      } catch (error) {
        console.error('Error in room status callback:', error);
      }
    });
  }

  /**
   * Notify all error callbacks
   */
  notifyError(message, type, details = {}) {
    const errorData = {
      message,
      type,
      details,
      timestamp: new Date().toISOString()
    };

    this.errorCallbacks.forEach(callback => {
      try {
        callback(errorData);
      } catch (error) {
        console.error('Error in error callback:', error);
      }
    });
  }

  /**
   * Send any pending messages that were queued during disconnection
   */
  sendPendingMessages() {
    if (this.pendingMessages.length === 0) return;

    console.log(`Sending ${this.pendingMessages.length} pending messages`);
    const messagesToSend = [...this.pendingMessages];
    this.pendingMessages = [];

    messagesToSend.forEach(messageData => {
      try {
        this.socket.emit('send_message', messageData);
      } catch (error) {
        console.error('Failed to send pending message:', error);
        // Re-queue the message if it fails
        this.pendingMessages.push(messageData);
        this.notifyError('Failed to send queued message', 'send_pending_message', { messageData, error: error.message });
      }
    });
  }

  /**
   * Manually retry connection
   */
  retryConnection() {
    if (this.isConnected) {
      console.log('Already connected');
      return;
    }

    // Reset reconnection attempts to allow manual retry
    this.reconnectAttempts = 0;
    this.isReconnecting = true;
    this.connectionError = 'Retrying connection...';
    this.notifyConnectionStatus(false, this.connectionError);

    if (this.socket) {
      try {
        this.socket.connect();
      } catch (error) {
        console.error('Manual retry failed:', error);
        this.attemptReconnection();
      }
    }
  }

  /**
   * Get current connection error
   */
  getConnectionError() {
    return this.connectionError;
  }

  /**
   * Get pending messages count
   */
  getPendingMessagesCount() {
    return this.pendingMessages.length;
  }

  /**
   * Start typing indicator
   */
  startTyping(roomId) {
    if (this.socket && this.isConnected) {
      const userId = this.socket.auth?.userId;
      this.socket.emit('typing_start', {
        user_id: userId,
        room_id: roomId
      });
    }
  }

  /**
   * Stop typing indicator
   */
  stopTyping(roomId) {
    if (this.socket && this.isConnected) {
      const userId = this.socket.auth?.userId;
      this.socket.emit('typing_stop', {
        user_id: userId,
        room_id: roomId
      });
    }
  }

  /**
   * Handle typing with debounce
   */
  handleTyping(roomId, isTyping) {
    if (isTyping) {
      this.startTyping(roomId);

      // Clear existing timer
      if (this.typingTimer) {
        clearTimeout(this.typingTimer);
      }

      // Set timer to stop typing after 3 seconds of inactivity
      this.typingTimer = setTimeout(() => {
        this.stopTyping(roomId);
      }, 3000);
    } else {
      if (this.typingTimer) {
        clearTimeout(this.typingTimer);
        this.typingTimer = null;
      }
      this.stopTyping(roomId);
    }
  }

  /**
   * Mark message as delivered
   */
  markMessageDelivered(messageId) {
    if (this.socket && this.isConnected) {
      const userId = this.socket.auth?.userId;
      this.socket.emit('message_delivered', {
        message_id: messageId,
        user_id: userId
      });
    }
  }

  /**
   * Request list of online users
   */
  requestOnlineUsers() {
    if (this.socket && this.isConnected) {
      console.log('WebSocketService: Emitting get_online_users event');
      this.socket.emit('get_online_users');
    } else {
      console.log('WebSocketService: Cannot request online users - socket not connected');
    }
  }

  /**
   * Request list of all users (online and offline)
   */
  requestAllUsers() {
    if (this.socket && this.isConnected) {
      console.log('WebSocketService: Emitting get_all_users event');
      this.socket.emit('get_all_users');
    } else {
      console.log('WebSocketService: Cannot request all users - socket not connected');
    }
  }

  /**
   * Create or join a direct message room with another user
   */
  startDirectMessage(targetUserId) {
    if (!this.socket || !this.isConnected) {
      console.error('Cannot start direct message: WebSocket not connected');
      return null;
    }

    const currentUserId = this.socket.auth?.userId;
    if (!currentUserId) {
      console.error('Cannot start direct message: current user ID not found');
      return null;
    }

    // Generate consistent room ID for direct messages (simpler format for now)
    const roomId = [currentUserId, targetUserId].sort().join('_');
    
    console.log('WebSocketService: Starting direct message', {
      currentUserId,
      targetUserId,
      roomId
    });
    
    // For now, just join the room directly instead of using start_direct_message
    // This bypasses the backend room creation issue
    this.joinRoom(roomId);

    return roomId;
  }

  /**
   * Test connection to backend server
   */
  async testConnection() {
    const serverUrl = process.env.NEXT_PUBLIC_WEBSOCKET_URL || this.findAvailableServer();
    
    try {
      const response = await fetch(`${serverUrl}/health`, { 
        method: 'GET',
        timeout: 5000 
      });
      return {
        success: response.ok,
        status: response.status,
        serverUrl
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        serverUrl
      };
    }
  }
}

const websocketService = new WebSocketService();

// Make it available globally for debugging
if (typeof window !== 'undefined') {
  window.websocketService = websocketService;
}

export default websocketService;