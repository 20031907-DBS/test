"use client"
import React, { useState, useRef, useEffect } from 'react';
import { ArrowLeft, Phone, Video, MoreVertical, Send, Paperclip, Smile, Check, CheckCheck, Clock, AlertCircle, Wifi, WifiOff, MessageCircle, Lock, LockOpen, AlertTriangle } from 'lucide-react';
import { clsx } from 'clsx';
import encryptionService from '../services/encryptionService';
import EncryptionErrorDisplay, { EncryptionErrorBanner } from './EncryptionErrorDisplay';
import { EncryptionStatusPanel } from './EncryptionStatusIndicator';
import useEncryptionErrors from '../hooks/useEncryptionErrors';
import encryptionErrorManager from '../services/encryptionErrorManager';

export default function ChatMain({
  messages,
  isConnected,
  currentRoom,
  selectedRoomId,
  selectedUser,
  sendMessage,
  connectionError,
  lastError,
  pendingMessagesCount,
  retryConnection,
  encryptionStatus,
  currentUser,
  isMobile,
  onBackToList,
  typingUsers = [],
  onlineUsers = new Set(),
  startTyping,
  stopTyping
}) {
  const [messageInput, setMessageInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [encryptionError, setEncryptionError] = useState(null);
  const [isEncrypting, setIsEncrypting] = useState(false);
  const messageEndRef = useRef(null);
  const inputRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  // Enhanced encryption error management
  const {
    errors: encryptionErrors,
    addError: addEncryptionError,
    removeError: removeEncryptionError,
    clearErrors: clearEncryptionErrors,
    canRetry,
    retryOperation
  } = useEncryptionErrors();

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messageEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Focus input when room changes
  useEffect(() => {
    if (inputRef.current && !isMobile) {
      inputRef.current.focus();
    }
  }, [selectedRoomId, isMobile]);

  const [isSending, setIsSending] = useState(false);

  const handleSendMessage = async () => {
    if (messageInput.trim() && !isSending) {
      setIsSending(true);
      setIsEncrypting(true);
      setEncryptionError(null);
      
      try {
        // Check if encryption is available and we have a recipient
        const canEncrypt = encryptionService.isEncryptionAvailable() && selectedUser?.id;
        let messageData = null;
        
        if (canEncrypt) {
          try {
            // Use encryption error manager for better error handling
            messageData = await encryptionErrorManager.handleEncryptionOperation(
              () => encryptionService.encryptMessage(messageInput.trim(), selectedUser.id.toString()),
              'encryption',
              { 
                messageText: messageInput.trim(),
                recipientId: selectedUser.id.toString(),
                recipientName: selectedUser.display_name || selectedUser.name
              }
            );
            console.log('Message encrypted successfully');
          } catch (encryptError) {
            console.error('Encryption failed:', encryptError);
            
            // Add to error management system
            const errorId = addEncryptionError(encryptError);
            setEncryptionError(encryptError);
            
            // Don't send the message if encryption fails
            return;
          }
        }
        
        setIsEncrypting(false);
        
        // Send the message (encrypted or plain)
        const result = await sendMessage(messageInput, messageData);
        if (result?.success || result?.queued) {
          setMessageInput('');
          setEncryptionError(null);
          clearEncryptionErrors(); // Clear any previous errors on success
        }
      } catch (error) {
        console.error('Failed to send message:', error);
        setEncryptionError({
          type: 'send_failed',
          message: error.message,
          userFriendlyMessage: 'Failed to send message. Please try again.'
        });
      } finally {
        setIsEncrypting(false);
        // Add a small delay to prevent double-sending
        setTimeout(() => {
          setIsSending(false);
        }, 500);
      }
    }
  };

  // Handle encryption error retry
  const handleEncryptionRetry = async (errorId) => {
    const error = encryptionErrors.find(e => e.id === errorId);
    if (!error) return false;

    try {
      if (error.type === 'encryption_failed') {
        // Retry message encryption
        return await retryOperation(errorId, async () => {
          const messageData = await encryptionService.encryptMessage(
            messageInput.trim(), 
            selectedUser.id.toString()
          );
          return messageData;
        });
      } else if (error.type === 'initialization_failed') {
        // Retry encryption initialization
        return await retryOperation(errorId, async () => {
          return await encryptionService.initialize(currentUser.id, currentUser.token);
        });
      }
      
      return false;
    } catch (retryError) {
      console.error('Encryption retry failed:', retryError);
      return false;
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleInputChange = (e) => {
    const value = e.target.value;
    setMessageInput(value);

    // Handle typing indicators
    if (value.trim() && !isTyping && startTyping) {
      setIsTyping(true);
      startTyping();
    }

    // Clear existing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    // Set timeout to stop typing
    typingTimeoutRef.current = setTimeout(() => {
      if (isTyping && stopTyping) {
        setIsTyping(false);
        stopTyping();
      }
    }, 1000);
  };

  // Stop typing when component unmounts or room changes
  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      if (isTyping && stopTyping) {
        stopTyping();
      }
    };
  }, [selectedRoomId, isTyping, stopTyping]);

  const getMessageStatus = (message) => {
    if (message.sender === 'me') {
      if (message.status === 'sending') {
        return <Clock className="w-3 h-3 text-gray-400" />;
      } else if (message.status === 'sent') {
        return <Check className="w-3 h-3 text-gray-400" />;
      } else if (message.status === 'delivered') {
        return <CheckCheck className="w-3 h-3 text-gray-400" />;
      } else if (message.status === 'read') {
        return <CheckCheck className="w-3 h-3 text-blue-500" />;
      }
      return <CheckCheck className="w-3 h-3 text-gray-400" />;
    }
    return null;
  };

  const getRoomDisplayName = () => {
    const roomNames = {
      'general': 'General Chat',
      'tech-talk': 'Tech Talk',
      'random': 'Random'
    };
    return roomNames[selectedRoomId] || selectedRoomId;
  };

  const getRoomAvatar = () => {
    const roomAvatars = {
      'general': '👥',
      'tech-talk': '💻',
      'random': '🎲'
    };
    return roomAvatars[selectedRoomId] || '💬';
  };

  const getEncryptionStatusText = (message) => {
    if (!message.isEncrypted) {
      return 'Not encrypted';
    }
    
    if (message.encryptionError) {
      if (message.decryptionErrorType === 'signature_failed') {
        return 'Encrypted (signature verification failed)';
      } else if (message.decryptionErrorType === 'decrypt_failed') {
        return 'Encrypted (decryption failed)';
      } else {
        return 'Encrypted (error)';
      }
    }
    
    if (message.signatureValid) {
      return 'Encrypted and verified';
    } else {
      return 'Encrypted (signature not verified)';
    }
  };

  if (!selectedRoomId) {
    return (
      <div className="flex-1 flex items-center justify-center gradient-neutral">
        <div className="text-center">
          <div className="w-32 h-32 gradient-primary rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-strong">
            <MessageCircle className="w-16 h-16 text-white" />
          </div>
          <h3 className="text-3xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent mb-4">
            Welcome to Chat
          </h3>
          <p className="text-lg text-gray-600">
            Select a conversation to start messaging
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-white">
      {/* Chat Header */}
      <div className="flex items-center justify-between p-6 border-b border-gray-100 glass-morphism shadow-soft">
        <div className="flex items-center space-x-3">
          {isMobile && (
            <button
              onClick={onBackToList}
              className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-full transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          )}
          
          <div className="w-12 h-12 gradient-primary rounded-xl flex items-center justify-center text-xl shadow-soft">
            {getRoomAvatar()}
          </div>
          
          <div className="flex-1 min-w-0">
            <h2 className="text-xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent truncate">
              {getRoomDisplayName()}
            </h2>
            <div className="flex items-center space-x-2 text-sm text-gray-500">
              {isConnected ? (
                <>
                  <Wifi className="w-3 h-3 text-green-500" />
                  <span className="text-green-600">Connected</span>
                  {currentRoom && (
                    <span>• Room: {currentRoom}</span>
                  )}
                </>
              ) : (
                <>
                  <WifiOff className="w-3 h-3 text-red-500" />
                  <span className="text-red-600">
                    {connectionError || 'Disconnected'}
                  </span>
                  <button
                    onClick={retryConnection}
                    className="text-blue-600 hover:text-blue-800 underline"
                  >
                    Retry
                  </button>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <button className="p-3 text-gray-500 hover:text-white hover:bg-gradient-to-r hover:from-green-400 hover:to-blue-500 rounded-xl transition-all duration-300 shadow-soft hover:shadow-medium hover:scale-105">
            <Phone className="w-5 h-5" />
          </button>
          <button className="p-3 text-gray-500 hover:text-white hover:bg-gradient-to-r hover:from-purple-400 hover:to-pink-500 rounded-xl transition-all duration-300 shadow-soft hover:shadow-medium hover:scale-105">
            <Video className="w-5 h-5" />
          </button>
          <button className="p-3 text-gray-500 hover:text-white hover:bg-gradient-to-r hover:from-gray-400 hover:to-gray-600 rounded-xl transition-all duration-300 shadow-soft hover:shadow-medium hover:scale-105">
            <MoreVertical className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Connection Status Banner */}
      {!isConnected && (
        <div className="gradient-warning border-b border-orange-200 px-6 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <AlertCircle className="w-5 h-5 text-white" />
              <span className="text-sm font-medium text-white">
                {connectionError || 'Disconnected from chat'}
                {pendingMessagesCount > 0 && (
                  <span className="ml-2">
                    ({pendingMessagesCount} message{pendingMessagesCount > 1 ? 's' : ''} queued)
                  </span>
                )}
              </span>
            </div>
            <button
              onClick={retryConnection}
              className="text-sm text-white hover:text-gray-100 underline font-medium transition-colors duration-200"
            >
              Retry Connection
            </button>
          </div>
        </div>
      )}

      {/* Error Banner */}
      {lastError && (
        <div className="gradient-error border-b border-red-200 px-6 py-3">
          <div className="flex items-center space-x-3">
            <AlertCircle className="w-5 h-5 text-white" />
            <span className="text-sm font-medium text-white">
              {lastError.message}
              {lastError.type === 'send_message' && lastError.details?.queued && (
                <span className="ml-2">(Message queued for retry)</span>
              )}
            </span>
          </div>
        </div>
      )}

      {/* Encryption Error Banners */}
      {encryptionErrors.map(error => (
        <EncryptionErrorBanner
          key={error.id}
          error={error}
          onRetry={canRetry(error.id) ? () => handleEncryptionRetry(error.id) : null}
          onDismiss={() => removeEncryptionError(error.id)}
          className="border-b"
        />
      ))}

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4 gradient-neutral">
        {messages.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <div className="w-20 h-20 gradient-primary rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-strong">
                {getRoomAvatar()}
              </div>
              <h3 className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent mb-3">
                {getRoomDisplayName()}
              </h3>
              {isConnected ? (
                <p className="text-gray-600 text-lg">
                  No messages yet. Start the conversation!
                </p>
              ) : (
                <p className="text-gray-600 text-lg">
                  Connecting to chat...
                </p>
              )}
            </div>
          </div>
        ) : (
          messages.map((message, index) => {
            const isOwn = message.sender === 'me';
            const showSender = !isOwn && (index === 0 || messages[index - 1].sender !== message.sender);
            
            return (
              <div
                key={message.id}
                className={clsx(
                  "flex",
                  isOwn ? "justify-end" : "justify-start"
                )}
              >
                <div className={clsx(
                  "max-w-xs lg:max-w-md px-5 py-3 rounded-2xl shadow-medium transition-all duration-300 hover:shadow-strong",
                  isOwn 
                    ? "gradient-primary text-white" 
                    : "glass-morphism text-gray-900"
                )}>
                  {showSender && (
                    <div className="text-xs font-medium mb-1 text-gray-600">
                      {message.senderName || 'Unknown User'}
                    </div>
                  )}
                  
                  <div className="break-words">
                    {message.text}
                  </div>
                  
                  {/* Encryption error message display */}
                  {message.encryptionError && (
                    <div className={clsx(
                      "text-xs mt-1 px-2 py-1 rounded",
                      message.decryptionErrorType === 'signature_failed'
                        ? isOwn 
                          ? "bg-yellow-100 text-yellow-800 border border-yellow-200" 
                          : "bg-yellow-50 text-yellow-700 border border-yellow-200"
                        : isOwn 
                          ? "bg-red-100 text-red-800 border border-red-200" 
                          : "bg-red-50 text-red-700 border border-red-200"
                    )}>
                      <div className="flex items-center space-x-1">
                        {message.decryptionErrorType === 'signature_failed' ? (
                          <AlertTriangle className="w-3 h-3 text-yellow-600" />
                        ) : (
                          <AlertTriangle className="w-3 h-3 text-red-600" />
                        )}
                        <span>{message.encryptionError}</span>
                      </div>
                      
                      {/* Additional context for different error types */}
                      {message.decryptionErrorType === 'signature_failed' && (
                        <div className="mt-1 text-xs opacity-75">
                          The message was decrypted but the sender&apos;s identity could not be verified.
                        </div>
                      )}
                      
                      {message.decryptionErrorType === 'decrypt_failed' && (
                        <div className="mt-1 text-xs opacity-75">
                          This message may be corrupted or sent with incompatible encryption.
                        </div>
                      )}
                    </div>
                  )}
                  
                  <div className={clsx(
                    "flex items-center justify-between mt-1 text-xs",
                    isOwn ? "text-blue-100" : "text-gray-500"
                  )}>
                    <div className="flex items-center space-x-1">
                      {/* Encryption status text */}
                      <span className={clsx(
                        "text-xs opacity-75",
                        message.encryptionError && message.decryptionErrorType === 'signature_failed' 
                          ? isOwn ? "text-yellow-200" : "text-yellow-600"
                          : message.encryptionError 
                            ? isOwn ? "text-red-200" : "text-red-500"
                            : message.isEncrypted 
                              ? isOwn ? "text-green-200" : "text-green-600"
                              : isOwn ? "text-gray-300" : "text-gray-400"
                      )}>
                        {getEncryptionStatusText(message)}
                      </span>
                    </div>
                    
                    <div className="flex items-center space-x-1">
                      <span>{message.timestamp}</span>
                      {getMessageStatus(message)}
                      
                      {/* Encryption status indicators */}
                      {message.isEncrypted && !message.encryptionError && message.signatureValid && (
                        <div className="flex items-center space-x-1">
                          <Lock className={clsx(
                            "w-3 h-3",
                            isOwn ? "text-green-200" : "text-green-600"
                          )} title="End-to-end encrypted and signature verified" />
                          <div className={clsx(
                            "w-1 h-1 rounded-full",
                            isOwn ? "bg-green-200" : "bg-green-600"
                          )} title="Verified sender" />
                        </div>
                      )}
                      
                      {message.isEncrypted && !message.encryptionError && !message.signatureValid && (
                        <div className="flex items-center space-x-1">
                          <Lock className={clsx(
                            "w-3 h-3",
                            isOwn ? "text-blue-200" : "text-green-600"
                          )} title="End-to-end encrypted" />
                          <AlertTriangle className={clsx(
                            "w-3 h-3",
                            isOwn ? "text-yellow-200" : "text-yellow-500"
                          )} title="Message signature could not be verified - sender authenticity unknown" />
                        </div>
                      )}
                      
                      {message.encryptionError && message.decryptionErrorType === 'decrypt_failed' && (
                        <div className="flex items-center space-x-1">
                          <LockOpen className={clsx(
                            "w-3 h-3",
                            isOwn ? "text-red-200" : "text-red-500"
                          )} title="Failed to decrypt message" />
                          <AlertTriangle className={clsx(
                            "w-3 h-3",
                            isOwn ? "text-red-200" : "text-red-500"
                          )} title="Decryption error" />
                        </div>
                      )}
                      
                      {message.encryptionError && message.decryptionErrorType === 'signature_failed' && (
                        <div className="flex items-center space-x-1">
                          <Lock className={clsx(
                            "w-3 h-3",
                            isOwn ? "text-blue-200" : "text-green-600"
                          )} title="Message decrypted successfully" />
                          <AlertTriangle className={clsx(
                            "w-3 h-3",
                            isOwn ? "text-yellow-200" : "text-yellow-500"
                          )} title="Signature verification failed - sender authenticity could not be verified" />
                        </div>
                      )}
                      
                      {!message.isEncrypted && (
                        <LockOpen className={clsx(
                          "w-3 h-3",
                          isOwn ? "text-gray-300" : "text-gray-400"
                        )} title="Message not encrypted" />
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}

        {/* Typing Indicators */}
        {typingUsers.length > 0 && (
          <div className="flex justify-start mb-4">
            <div className="max-w-xs lg:max-w-md px-5 py-3 rounded-2xl glass-morphism text-gray-600 shadow-soft">
              <div className="flex items-center space-x-3">
                <div className="flex space-x-1">
                  <div className="w-2 h-2 gradient-accent rounded-full animate-bounce"></div>
                  <div className="w-2 h-2 gradient-accent rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                  <div className="w-2 h-2 gradient-accent rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                </div>
                <span className="text-sm font-medium">
                  {typingUsers.length === 1 
                    ? `${typingUsers[0].user_name} is typing...`
                    : `${typingUsers.length} people are typing...`
                  }
                </span>
              </div>
            </div>
          </div>
        )}

        <div ref={messageEndRef} />
      </div>

      {/* Message Input */}
      <div className="border-t border-gray-100 glass-morphism p-6 shadow-strong">
        {/* Enhanced Encryption Status Panel */}
        <div className="mb-3">
          <EncryptionStatusPanel
            selectedUser={selectedUser}
            onSettingsClick={() => {
              // This could trigger a settings modal or callback to parent
              console.log('Encryption settings clicked');
            }}
          />
        </div>
        
        {/* Encryption Error Display */}
        {encryptionError && (
          <div className="mb-3">
            <EncryptionErrorDisplay
              error={encryptionError}
              onRetry={encryptionError.type !== 'signature_verification_failed' ? () => {
                setEncryptionError(null);
                handleSendMessage();
              } : null}
              onDismiss={() => setEncryptionError(null)}
              compact={true}
            />
          </div>
        )}
        
        <div className="flex items-end space-x-4">
          <button className="p-3 text-gray-500 hover:text-white hover:bg-gradient-to-r hover:from-purple-400 hover:to-pink-500 rounded-xl transition-all duration-300 shadow-soft hover:shadow-medium hover:scale-105">
            <Paperclip className="w-5 h-5" />
          </button>
          
          <div className="flex-1 relative">
            <textarea
              ref={inputRef}
              value={messageInput}
              onChange={handleInputChange}
              onKeyPress={handleKeyPress}
              placeholder={isConnected ? "Type a message..." : "Connecting..."}
              disabled={!isConnected || isEncrypting}
              className={clsx(
                "w-full px-5 py-3 border-2 border-transparent rounded-2xl resize-none focus:outline-none focus:ring-4 focus:ring-purple-200 focus:border-purple-300 transition-all duration-300 shadow-soft",
                {
                  "bg-gray-100 opacity-70": !isConnected || isEncrypting,
                  "glass-morphism": isConnected && !isEncrypting
                }
              )}
              rows={1}
              style={{ minHeight: '48px', maxHeight: '120px' }}
            />
            
            {/* Encryption indicator in input */}
            {isEncrypting && (
              <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                <div className="flex items-center space-x-1 text-xs text-blue-600">
                  <div className="animate-spin rounded-full h-3 w-3 border-b border-blue-600"></div>
                  <span>Encrypting...</span>
                </div>
              </div>
            )}
          </div>
          
          <button className="p-3 text-gray-500 hover:text-white hover:bg-gradient-to-r hover:from-yellow-400 hover:to-orange-500 rounded-xl transition-all duration-300 shadow-soft hover:shadow-medium hover:scale-105">
            <Smile className="w-5 h-5" />
          </button>
          
          <button
            onClick={handleSendMessage}
            disabled={!messageInput.trim() || isSending || isEncrypting}
            className={clsx(
              "p-3 rounded-xl transition-all duration-300 relative shadow-soft hover:shadow-medium",
              messageInput.trim() && isConnected && !isSending && !isEncrypting
                ? "gradient-accent text-white hover:scale-105"
                : "bg-gray-200 text-gray-400 cursor-not-allowed"
            )}
            title={
              isEncrypting ? 'Encrypting message...' :
              !isConnected ? 'Message will be queued and sent when reconnected' : 
              'Send message'
            }
          >
            {isEncrypting ? (
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
            ) : (
              <Send className="w-5 h-5" />
            )}
          </button>
        </div>
        
        {pendingMessagesCount > 0 && (
          <div className="mt-2 text-xs text-yellow-600">
            {pendingMessagesCount} message{pendingMessagesCount > 1 ? 's' : ''} queued for sending
          </div>
        )}
      </div>
    </div>
  );
}