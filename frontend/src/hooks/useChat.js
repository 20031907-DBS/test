import { useState, useEffect, useCallback } from 'react';
import websocketService from '../services/websocket';
import encryptionManager from '../services/encryptionManager';
import encryptionService from '../services/encryptionService';

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
        let encryptionError = null;
        let signatureValid = true;
        let decryptionErrorType = null;

        // Check if this is our own message (sender)
        const isOwnMessage = messageData.sender_id === userId;

        try {
            if (messageData.is_encrypted) {
                isEncrypted = true;
                
                if (isOwnMessage) {
                    // ✅ CRITICAL FIX: Don't decrypt our own messages!
                    // We don't have the recipient's private key, so decryption will always fail
                    console.log('handleMessage: This is our own encrypted message - skipping decryption');
                    messageText = '[Message sent encrypted]'; // Placeholder for sender
                    signatureValid = true;
                    encryptionError = null;
                } else {
                    // Only decrypt messages from other users
                    console.log('handleMessage: Decrypting message from other user:', messageData.sender_id);
                    
                    // Use the new EncryptionService for better error handling and signature verification
                    try {
                        messageText = await encryptionService.decryptMessage(messageData, messageData.sender_id);
                        console.log('handleMessage: Message decrypted successfully with signature verification');
                    } catch (decryptError) {
                        console.error('EncryptionService decryption failed:', decryptError);
                        
                        // Handle specific decryption error types
                        if (decryptError.type === 'signature_verification_failed') {
                            signatureValid = false;
                            decryptionErrorType = 'signature_failed';
                            // Still try to decrypt the message content without signature verification
                            try {
                                messageText = await encryptionService.decryptMessageWithoutSignature(messageData);
                                encryptionError = 'Message authenticity could not be verified';
                            } catch (contentDecryptError) {
                                messageText = '[Unable to decrypt message]';
                                encryptionError = 'Failed to decrypt message content';
                                decryptionErrorType = 'decrypt_failed';
                            }
                        } else if (decryptError.type === 'decryption_failed') {
                            messageText = '[Unable to decrypt message]';
                            encryptionError = decryptError.userFriendlyMessage || 'Unable to decrypt this message';
                            decryptionErrorType = 'decrypt_failed';
                        } else {
                            // Try fallback to old encryptionManager
                            try {
                                messageText = await encryptionManager.decryptMessage(messageData);
                                console.log('handleMessage: Fallback decryption successful');
                            } catch (fallbackError) {
                                console.error('Fallback decryption also failed:', fallbackError);
                                messageText = '[Unable to decrypt message]';
                                encryptionError = 'Unable to decrypt this message';
                                decryptionErrorType = 'decrypt_failed';
                            }
                        }
                    }
                }
            } else {
                // Plain text message
                messageText = messageData.content;
                isEncrypted = false;
            }

            console.log('handleMessage: Message processed successfully');
        } catch (error) {
            console.error('Error processing message:', error);
            // Fallback to original content with error indication
            messageText = messageData.content || '[Error processing message]';
            isEncrypted = messageData.is_encrypted || false;
            encryptionError = 'Message processing error';
            decryptionErrorType = 'processing_error';
        }

        const newMessage = {
            id: messageData.id || `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            text: messageText,
            sender: messageData.sender_id === userId ? 'me' : 'other',
            senderName: messageData.sender_name || 'Unknown User',
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            isEncrypted: isEncrypted,
            encryptionError: encryptionError,
            signatureValid: signatureValid,
            decryptionErrorType: decryptionErrorType
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
    const sendMessage = async (roomId, messageContent, encryptedMessageData = null) => {
        if (!messageContent.trim() || !roomId) return;

        try {
            let messageData;

            if (encryptedMessageData) {
                // Use pre-encrypted message data from ChatMain
                messageData = {
                    content: encryptedMessageData.content,
                    encrypted_aes_key: encryptedMessageData.encrypted_aes_key,
                    iv: encryptedMessageData.iv,
                    signature: encryptedMessageData.signature,
                    is_encrypted: encryptedMessageData.is_encrypted
                };
            } else {
                // Fallback to encryptionManager for backward compatibility
                const fallbackData = await encryptionManager.encryptMessage(messageContent.trim(), roomId);
                messageData = {
                    content: fallbackData.content,
                    encrypted_aes_key: fallbackData.encrypted_aes_key,
                    iv: fallbackData.iv,
                    is_encrypted: fallbackData.is_encrypted
                };
            }

            // Send encrypted or plain message
            const result = websocketService.sendMessage(roomId, messageData.content, {
                encrypted_aes_key: messageData.encrypted_aes_key,
                iv: messageData.iv,
                signature: messageData.signature,
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