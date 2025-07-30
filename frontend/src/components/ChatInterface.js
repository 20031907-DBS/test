"use client"
import React, { useState, useEffect, memo } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '../context/AuthContext';
import { useChat } from '../hooks/useChat';
import { usePerformance, useConnectionMonitor } from '../hooks/usePerformance';
import ChatSidebar from './ChatSidebar';
import ChatMain from './ChatMain';
import UserList from './UserList';
import EncryptionErrorBoundary from './EncryptionErrorBoundary';
import EncryptionSettings from './EncryptionSettings';
import { EncryptionStatusBadge } from './EncryptionStatusIndicator';
import encryptionService from '../services/encryptionService';
import { clsx } from 'clsx';

function ChatInterface({ roomId }) {
  const { currentUser } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const { measureAsync } = usePerformance('ChatInterface');
  const { isOnline } = useConnectionMonitor();
  
  // Removed excessive logging to prevent infinite loops

  const [selectedRoomId, setSelectedRoomId] = useState(roomId || null);
  const [selectedUser, setSelectedUser] = useState(null);
  const [isMobile, setIsMobile] = useState(false);
  const [showSidebar, setShowSidebar] = useState(true);
  const [activeChats, setActiveChats] = useState([]);
  const [showEncryptionSettings, setShowEncryptionSettings] = useState(false);
  const [encryptionFallbackMode, setEncryptionFallbackMode] = useState(false);

  // Update selectedRoomId when roomId prop changes
  useEffect(() => {
    if (roomId && roomId !== selectedRoomId) {
      console.log('ChatInterface: Setting room from URL:', roomId);
      setSelectedRoomId(roomId);
      
      // Try to determine the user from the room ID (format: user1_user2)
      if (roomId.includes('_')) {
        const userIds = roomId.split('_');
        const otherUserId = userIds.find(id => id !== currentUser?.uid);
        if (otherUserId) {
          // Create a mock user object for now
          const mockUser = {
            id: parseInt(otherUserId),
            username: `user${otherUserId}`,
            name: `User ${otherUserId}`,
            display_name: `User ${otherUserId}`,
            email: `user${otherUserId}@example.com`
          };
          setSelectedUser(mockUser);
          
          // Add to active chats
          setActiveChats(prev => {
            const exists = prev.find(chat => chat.roomId === roomId);
            if (!exists) {
              return [...prev, { roomId, user: mockUser, lastActivity: new Date() }];
            }
            return prev;
          });
        }
      }
    }
  }, [roomId, selectedRoomId, currentUser?.uid]);

  // Use WebSocket chat hook only when we have authentication data
  const {
    messages,
    isConnected,
    currentRoom,
    sendMessage: sendWebSocketMessage,
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
  } = useChat(
    currentUser?.uid,
    currentUser?.accessToken
  );

  // Handle responsive design
  useEffect(() => {
    const checkMobile = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      if (mobile && roomId) {
        setShowSidebar(false);
      } else if (!mobile) {
        setShowSidebar(true);
      }
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, [roomId]);

  // Handle starting a chat with a user
  const handleStartChat = async (user) => {
    console.log('ChatInterface: Starting chat with user:', user);
    const roomId = await startChatWithUser(user.id);
    if (roomId) {
      setSelectedRoomId(roomId);
      setSelectedUser(user);

      // Add to active chats if not already there
      setActiveChats(prev => {
        const exists = prev.find(chat => chat.roomId === roomId);
        if (!exists) {
          return [...prev, { roomId, user, lastActivity: new Date() }];
        }
        return prev;
      });

      // Update URL
      router.push(`/chat/${roomId}`, undefined, { shallow: true });

      // On mobile, hide sidebar when chat is selected
      if (isMobile) {
        setShowSidebar(false);
      }
    }
  };

  // Handle selecting an existing chat
  const handleChatSelect = (chat) => {
    setSelectedRoomId(chat.roomId);
    setSelectedUser(chat.user);

    // Update URL
    router.push(`/chat/${chat.roomId}`, undefined, { shallow: true });

    // On mobile, hide sidebar when chat is selected
    if (isMobile) {
      setShowSidebar(false);
    }
  };

  // Handle back to chat list on mobile
  const handleBackToList = () => {
    if (isMobile) {
      setShowSidebar(true);
      router.push('/chat', undefined, { shallow: true });
    }
  };

  // Handle browser back/forward navigation
  useEffect(() => {
    const handleRouteChange = () => {
      if (pathname === '/chat') {
        setSelectedRoomId(null);
        setSelectedUser(null);
        if (isMobile) {
          setShowSidebar(true);
        }
      } else if (pathname.startsWith('/chat/')) {
        const roomFromUrl = pathname.split('/chat/')[1];
        if (roomFromUrl && roomFromUrl !== selectedRoomId) {
          setSelectedRoomId(roomFromUrl);
          // Try to find the user from active chats
          const chat = activeChats.find(c => c.roomId === roomFromUrl);
          if (chat) {
            setSelectedUser(chat.user);
          }
          if (isMobile) {
            setShowSidebar(false);
          }
        }
      }
    };

    handleRouteChange();
  }, [pathname, isMobile, selectedRoomId, activeChats]);

  // Auto-debug logging for development (only when significant changes occur)
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      console.log('=== ChatInterface Debug Info ===');
      console.log('Current User:', currentUser?.uid);
      console.log('Is Connected:', isConnected);
      console.log('Selected Room ID:', selectedRoomId);
      console.log('Active Chats Count:', activeChats.length);
      console.log('================================');
    }
  }, [currentUser?.uid, isConnected, selectedRoomId]);

  // Handle encryption fallback mode
  const handleEncryptionFallback = () => {
    setEncryptionFallbackMode(true);
  };

  // Handle clearing encryption (for error recovery)
  const handleClearEncryption = async () => {
    try {
      await encryptionService.clearEncryption();
      setEncryptionFallbackMode(true);
    } catch (error) {
      console.error('Failed to clear encryption:', error);
    }
  };

  // Debug function for development
  const handleDebug = () => {
    console.log('Debug Info:', getDebugInfo());
    console.log('Current User:', currentUser);
    console.log('Is Connected:', isConnected);
    console.log('Connection Error:', connectionError);
    console.log('Online Users:', onlineUsers);
    console.log('Encryption Status:', encryptionService.getEncryptionStatus());
  };

  // Show loading state if user data is not available
  if (!currentUser?.uid || !currentUser?.accessToken) {
    return (
      <div className="flex h-screen items-center justify-center bg-white">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading chat...</p>
        </div>
      </div>
    );
  }

  return (
    <EncryptionErrorBoundary 
      onFallbackMode={handleEncryptionFallback}
      onClearEncryption={handleClearEncryption}
    >
      {/* Encryption Fallback Mode Banner */}
      {encryptionFallbackMode && (
        <div className="bg-yellow-50 border-b border-yellow-200 px-4 py-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2 text-yellow-800">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              <span className="text-sm font-medium">
                Encryption disabled - messages are not encrypted
              </span>
            </div>
            <button
              onClick={() => setShowEncryptionSettings(true)}
              className="text-sm text-yellow-700 hover:text-yellow-900 underline"
            >
              Settings
            </button>
          </div>
        </div>
      )}

      <div className="flex h-screen bg-white">
      {/* Sidebar */}
      <div className={clsx(
        "transition-all duration-300 ease-in-out bg-white border-r border-gray-200",
        {
          "w-80": !isMobile && showSidebar,
          "w-full": isMobile && showSidebar,
          "w-0 overflow-hidden": !showSidebar,
        }
      )}>
        <div className="h-full flex flex-col">
          {/* Header with user info and logout */}
          <div className="border-b border-gray-200 p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-white text-sm font-medium">
                  {(currentUser?.displayName || currentUser?.username || 'U').charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900">
                    {currentUser?.displayName || currentUser?.username}
                  </p>
                  <div className="flex items-center space-x-2">
                    <p className="text-xs text-gray-500">Online</p>
                    <EncryptionStatusBadge 
                      selectedUser={selectedUser}
                      className="text-xs"
                    />
                  </div>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setShowEncryptionSettings(true)}
                  className="text-xs text-gray-500 hover:text-gray-700 px-2 py-1 rounded hover:bg-gray-100"
                  title="Encryption Settings"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                </button>
                <button
                  onClick={async () => {
                    try {
                      // Clear encryption before logout if enabled in preferences
                      await encryptionService.clearEncryption();
                      
                      // Call logout API
                      await fetch('http://localhost:5000/api/auth/logout', {
                        method: 'POST',
                        credentials: 'include'
                      });
                      // Redirect to login
                      window.location.href = '/login';
                    } catch (error) {
                      console.error('Logout error:', error);
                      // Force redirect anyway
                      window.location.href = '/login';
                    }
                  }}
                  className="text-xs text-gray-500 hover:text-gray-700 px-2 py-1 rounded hover:bg-gray-100"
                >
                  Logout
                </button>
              </div>
            </div>
          </div>

          {/* Active Chats Section */}
          {activeChats.length > 0 && (
            <div className="border-b border-gray-200">
              <div className="p-4">
                <h3 className="text-lg font-semibold mb-3 text-gray-800">Active Chats</h3>
                <div className="space-y-2">
                  {activeChats.map(chat => (
                    <div
                      key={chat.roomId}
                      onClick={() => handleChatSelect(chat)}
                      className={clsx(
                        "flex items-center space-x-3 p-3 rounded-lg cursor-pointer transition-colors",
                        {
                          "bg-blue-100 border border-blue-200": selectedRoomId === chat.roomId,
                          "hover:bg-gray-100": selectedRoomId !== chat.roomId,
                        }
                      )}
                    >
                      <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-white text-sm font-medium">
                        {(chat.user.display_name || chat.user.name || chat.user.username || chat.user.email || 'U').charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {chat.user.display_name || chat.user.name || chat.user.username || chat.user.email}
                        </p>
                        <p className="text-xs text-gray-500">Active chat</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Online Users Section */}
          <div className="flex-1 overflow-y-auto">
            <UserList
              currentUser={currentUser}
              onStartChat={handleStartChat}
              onlineUsers={onlineUsers}
            />
          </div>
        </div>
      </div>

      {/* Main Chat Area */}
      <div className={clsx(
        "flex-1 flex flex-col transition-all duration-300 ease-in-out",
        {
          "hidden": isMobile && showSidebar,
        }
      )}>
        {selectedRoomId && selectedUser ? (
          <ChatMain
            messages={messages}
            isConnected={isConnected}
            currentRoom={currentRoom}
            selectedRoomId={selectedRoomId}
            selectedUser={selectedUser}
            sendMessage={(message, encryptedData) => sendWebSocketMessage(selectedRoomId, message, encryptedData)}
            connectionError={connectionError}
            lastError={lastError}
            pendingMessagesCount={pendingMessagesCount}
            retryConnection={retryConnection}
            encryptionStatus={encryptionStatus}
            currentUser={currentUser}
            isMobile={isMobile}
            onBackToList={handleBackToList}
            typingUsers={typingUsers.filter(user => user.room_id === selectedRoomId)}
            onlineUsers={onlineUsers}
            startTyping={() => startTyping(selectedRoomId)}
            stopTyping={() => stopTyping(selectedRoomId)}
          />
        ) : (
          <div className="flex-1 flex items-center justify-center bg-gray-50">
            <div className="text-center">
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">Welcome to Chat</h3>
              <p className="text-gray-600 mb-4">Select a user from the sidebar to start chatting</p>
              {!isConnected && (
                <div className="text-sm text-red-600">
                  {connectionError || 'Connecting to chat server...'}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Encryption Settings Modal */}
        <EncryptionSettings
          isOpen={showEncryptionSettings}
          onClose={() => setShowEncryptionSettings(false)}
        />
      </div>
      </div>
    </EncryptionErrorBoundary>
  );
}

export default memo(ChatInterface);