"use client"
import React, { useState, useRef, useEffect } from 'react';
import { ArrowLeft, Phone, Video, MoreVertical, Send, Paperclip, Smile, Check, CheckCheck, Clock, AlertCircle, Wifi, WifiOff, MessageCircle } from 'lucide-react';
import { clsx } from 'clsx';

export default function ChatMain({
  messages,
  isConnected,
  currentRoom,
  selectedRoomId,
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
  const messageEndRef = useRef(null);
  const inputRef = useRef(null);
  const typingTimeoutRef = useRef(null);

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
      try {
        const result = await sendMessage(messageInput);
        if (result?.success || result?.queued) {
          setMessageInput('');
        }
      } finally {
        // Add a small delay to prevent double-sending
        setTimeout(() => {
          setIsSending(false);
        }, 500);
      }
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

  if (!selectedRoomId) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="w-24 h-24 bg-gray-200 rounded-full flex items-center justify-center mx-auto mb-4">
            <MessageCircle className="w-12 h-12 text-gray-400" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            Welcome to Chat
          </h3>
          <p className="text-gray-500">
            Select a conversation to start messaging
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-white">
      {/* Chat Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-white">
        <div className="flex items-center space-x-3">
          {isMobile && (
            <button
              onClick={onBackToList}
              className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-full transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          )}
          
          <div className="w-10 h-10 bg-gray-300 rounded-full flex items-center justify-center text-lg">
            {getRoomAvatar()}
          </div>
          
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-semibold text-gray-900 truncate">
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
          <button className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-full transition-colors">
            <Phone className="w-5 h-5" />
          </button>
          <button className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-full transition-colors">
            <Video className="w-5 h-5" />
          </button>
          <button className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-full transition-colors">
            <MoreVertical className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Connection Status Banner */}
      {!isConnected && (
        <div className="bg-yellow-50 border-b border-yellow-200 px-4 py-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 text-yellow-600" />
              <span className="text-sm text-yellow-800">
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
              className="text-sm text-yellow-800 hover:text-yellow-900 underline"
            >
              Retry Connection
            </button>
          </div>
        </div>
      )}

      {/* Error Banner */}
      {lastError && (
        <div className="bg-red-50 border-b border-red-200 px-4 py-2">
          <div className="flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 text-red-600" />
            <span className="text-sm text-red-800">
              {lastError.message}
              {lastError.type === 'send_message' && lastError.details?.queued && (
                <span className="ml-2">(Message queued for retry)</span>
              )}
            </span>
          </div>
        </div>
      )}

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
        {messages.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <div className="w-16 h-16 bg-gray-200 rounded-full flex items-center justify-center mx-auto mb-4">
                {getRoomAvatar()}
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                {getRoomDisplayName()}
              </h3>
              {isConnected ? (
                <p className="text-gray-500">
                  No messages yet. Start the conversation!
                </p>
              ) : (
                <p className="text-gray-500">
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
                  "max-w-xs lg:max-w-md px-4 py-2 rounded-lg shadow-sm",
                  isOwn 
                    ? "bg-blue-600 text-white" 
                    : "bg-white text-gray-900 border border-gray-200"
                )}>
                  {showSender && (
                    <div className="text-xs font-medium mb-1 text-gray-600">
                      {message.senderName || 'Unknown User'}
                    </div>
                  )}
                  
                  <div className="break-words">
                    {message.text}
                  </div>
                  
                  <div className={clsx(
                    "flex items-center justify-end space-x-1 mt-1 text-xs",
                    isOwn ? "text-blue-100" : "text-gray-500"
                  )}>
                    <span>{message.timestamp}</span>
                    {getMessageStatus(message)}
                    {message.isEncrypted && (
                      <span className="text-xs">🔒</span>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}

        {/* Typing Indicators */}
        {typingUsers.length > 0 && (
          <div className="flex justify-start mb-4">
            <div className="max-w-xs lg:max-w-md px-4 py-2 rounded-lg bg-gray-200 text-gray-600">
              <div className="flex items-center space-x-2">
                <div className="flex space-x-1">
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                </div>
                <span className="text-sm">
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
      <div className="border-t border-gray-200 bg-white p-4">
        <div className="flex items-end space-x-3">
          <button className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-full transition-colors">
            <Paperclip className="w-5 h-5" />
          </button>
          
          <div className="flex-1 relative">
            <textarea
              ref={inputRef}
              value={messageInput}
              onChange={handleInputChange}
              onKeyPress={handleKeyPress}
              placeholder={isConnected ? "Type a message..." : "Connecting..."}
              disabled={!isConnected}
              className={clsx(
                "w-full px-4 py-2 border border-gray-300 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent",
                {
                  "bg-gray-100 opacity-70": !isConnected,
                  "bg-white": isConnected
                }
              )}
              rows={1}
              style={{ minHeight: '40px', maxHeight: '120px' }}
            />
          </div>
          
          <button className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-full transition-colors">
            <Smile className="w-5 h-5" />
          </button>
          
          <button
            onClick={handleSendMessage}
            disabled={!messageInput.trim() || isSending}
            className={clsx(
              "p-2 rounded-full transition-colors",
              messageInput.trim() && isConnected && !isSending
                ? "bg-blue-600 text-white hover:bg-blue-700"
                : "bg-gray-200 text-gray-400 cursor-not-allowed"
            )}
            title={!isConnected ? 'Message will be queued and sent when reconnected' : 'Send message'}
          >
            <Send className="w-5 h-5" />
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