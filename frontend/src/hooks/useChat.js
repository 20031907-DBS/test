import { useState, useEffect, useCallback } from 'react';
import websocketService from '../services/websocket';
import encryptionManager from '../services/encryptionManager';

/**
 * chat project with end-to-end encryption
 * Modified to support user-initiated chats instead of auto-joining rooms
 */
export const useChat = (userId, token) => {
    const [messages, setMessages] = useState([]);
    const [isConnected, setIsConnected] = useState(false);
    const [currentRoom, setCurrentRoom] = useState(null);
    const [connectionError, setConnectionError] = useState(null);
    const [lastError, setLastError] = useState(null);
    const [pendingMessagesCount, setPendingMessagesCount] = useState(0);
    const [encryptionStatus, setEncryptionStatus] = useState({ initialized: false });
    const [typingUsers, setTypingUsers] = useState([]);
    const [onlineUsers, setOnlineUsers] = useState(new Set());

    // Handle incoming messages
    const handleMessage = useCallback(async (messageData) => {
        console.log('handleMessage: Processing message:', messageData);
        
        let messageText;
        let isEncrypted = false;
        
        try {
            // Try to decrypt message if it's encrypted
            messageText = await encryptionManager.decryptMessage(messageData);
            isEncrypted = messageData.is_encrypted || false;
            console.log('handleMessage: Message decrypted successfully');
        } catch (error) {
            console.error('Error decrypting message:', error);
            // Fallback to original content
            messageText = messageData.content || '[Error decrypting message]';
            isEncrypted = false;
        }
        
        const newMessage = {
            id: messageData.id || `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            text: messageText,
            sender: messageData.sender_id === userId ? 'me' : 'other',
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            isEncrypted: isEncrypted
        };
        
        console.log('handleMessage: Adding message to state:', newMessage);
        setMessages(prev => {
            // Check if message already exists to prevent duplicates
            const exists = prev.find(msg => msg.id === newMessage.id);
            if (exists) {
                console.log('handleMessage: Message already exists, skipping:', newMessage.id);
                return prev;
            }
            return [...prev, newMessage];
        });
    }, [userId]);

    // Handle connection status
    const handleConnectionStatus = useCallback((status) => {
        setIsConnected(status.connected);
        setConnectionError(status.error || null);
        
        // Update pending messages count
        if (status.connected) {
            setPendingMessagesCount(0);
        } else {
            setPendingMessagesCount(websocketService.getPendingMessagesCount());
        }
    }, []);

    // Handle room status
    const handleRoomStatus = useCallback((roomId) => {
        setCurrentRoom(roomId);
    }, []);

    // Handle errors
    const handleError = useCallback((errorData) => {
        setLastError(errorData);
        
        // Update pending messages count for send errors
        if (errorData.type === 'send_message') {
            setPendingMessagesCount(websocketService.getPendingMessagesCount());
        }
        
        // Auto-clear error after 5 seconds
        setTimeout(() => {
            setLastError(null);
        }, 5000);
    }, []);

    // Handle typing indicators
    const handleTyping = useCallback((typingData) => {
        // Handle typing indicators for any room (we'll filter by room in the component)
        setTypingUsers(prev => {
            const filtered = prev.filter(user => 
                user.user_id !== typingData.user_id || user.room_id !== typingData.room_id
            );
            if (typingData.is_typing) {
                return [...filtered, typingData];
            }
            return filtered;
        });
    }, []);

    // Handle presence updates
    const handlePresence = useCallback((presenceData) => {
        setOnlineUsers(prev => {
            const newSet = new Set(prev);
            if (presenceData.status === 'online') {
                newSet.add(presenceData.user_id);
            } else {
                newSet.delete(presenceData.user_id);
            }
            return newSet;
        });
    }, []);

    // Initialize encryption
    useEffect(() => {
        if (!userId || !token) return;

        const initEncryption = async () => {
            try {
                await encryptionManager.initialize(userId, token);
                setEncryptionStatus(encryptionManager.getStatus());
            } catch (error) {
                console.error('Failed to initialize encryption:', error);
                setEncryptionStatus({ initialized: false, error: error.message });
            }
        };

        initEncryption();
    }, [userId, token]);

    // Setup WebSocket connection (without auto-joining rooms)
    useEffect(() => {
        if (!userId || !token) {
            console.log('Missing required parameters for WebSocket connection:', { userId: !!userId, token: !!token });
            return;
        }

        console.log('useChat: Setting up WebSocket callbacks');
        
        // Remove any existing callbacks first to prevent duplicates
        websocketService.removeMessageCallback(handleMessage);
        websocketService.removeConnectionCallback(handleConnectionStatus);
        websocketService.removeRoomCallback(handleRoomStatus);
        websocketService.removeErrorCallback(handleError);
        websocketService.removeTypingCallback(handleTyping);
        websocketService.removePresenceCallback(handlePresence);
        
        // Register callbacks
        websocketService.onMessage(handleMessage);
        websocketService.onConnectionStatus(handleConnectionStatus);
        websocketService.onRoomStatus(handleRoomStatus);
        websocketService.onError(handleError);
        websocketService.onTyping(handleTyping);
        websocketService.onPresence(handlePresence);

        // Connect to WebSocket server (but don't join any rooms automatically)
        websocketService.connect(userId, token);

        // Cleanup
        return () => {
            console.log('useChat: Cleaning up WebSocket callbacks');
            websocketService.removeMessageCallback(handleMessage);
            websocketService.removeConnectionCallback(handleConnectionStatus);
            websocketService.removeRoomCallback(handleRoomStatus);
            websocketService.removeErrorCallback(handleError);
            websocketService.removeTypingCallback(handleTyping);
            websocketService.removePresenceCallback(handlePresence);
        };
    }, [userId, token]);

    // Start a chat with a specific user
    const startChatWithUser = async (targetUserId) => {
        if (!targetUserId || !isConnected) {
            console.error('Cannot start chat: missing targetUserId or not connected');
            return null;
        }

        console.log('useChat: Starting chat with targetUserId:', targetUserId, 'currentUserId:', userId);

        // Use the WebSocket service to start a direct message
        const roomId = websocketService.startDirectMessage(targetUserId);
        
        if (roomId) {
            console.log('useChat: Direct message room created:', roomId);
            return roomId;
        } else {
            console.error('useChat: Failed to create direct message room');
            return null;
        }
    };

    // Send message function (requires roomId to be passed)
    const sendMessage = async (roomId, messageContent) => {
        if (!messageContent.trim() || !roomId) return;

        try {
            // Encrypt message if encryption is available
            const messageData = await encryptionManager.encryptMessage(messageContent.trim(), roomId);
            
            // Send encrypted or plain message
            const result = websocketService.sendMessage(roomId, messageData.content, {
                encrypted_aes_key: messageData.encrypted_aes_key,
                iv: messageData.iv,
                is_encrypted: messageData.is_encrypted
            });
            
            // Update pending messages count
            setPendingMessagesCount(websocketService.getPendingMessagesCount());
            
            return result;
        } catch (error) {
            console.error('Failed to send message:', error);
            // Fallback to plain text
            const result = websocketService.sendMessage(roomId, messageContent.trim());
            setPendingMessagesCount(websocketService.getPendingMessagesCount());
            return result;
        }
    };

    // Retry connection function
    const retryConnection = () => {
        websocketService.retryConnection();
    };

    // Typing functions (requires roomId to be passed)
    const startTyping = (roomId) => {
        if (roomId) {
            websocketService.handleTyping(roomId, true);
        }
    };

    const stopTyping = (roomId) => {
        if (roomId) {
            websocketService.handleTyping(roomId, false);
        }
    };

    // Debug function to check connection status
    const getDebugInfo = () => {
        return {
            hookState: {
                isConnected,
                currentRoom,
                connectionError,
                lastError,
                pendingMessagesCount
            },
            websocketInfo: websocketService.getConnectionInfo()
        };
    };

    return {
        messages,
        isConnected,
        currentRoom,
        sendMessage,
        startChatWithUser,
        connectionError,
        lastError,
        pendingMessagesCount,
        retryConnection,
        encryptionStatus,
        typingUsers,
        onlineUsers,
        startTyping,
        stopTyping,
        getDebugInfo
    };
};

export default useChat;