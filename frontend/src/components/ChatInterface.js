"use client"
import React, { useState, useEffect, memo } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '../context/AuthContext';
import { useChat } from '../hooks/useChat';
import { usePerformance, useConnectionMonitor } from '../hooks/usePerformance';
import ChatSidebar from './ChatSidebar';
import ChatMain from './ChatMain';
import { clsx } from 'clsx';

function ChatInterface({ roomId }) {
  const { currentUser } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const { measureAsync } = usePerformance('ChatInterface');
  const { isOnline } = useConnectionMonitor();
  
  // Default room for this implementation
  const defaultRoomId = roomId || 'general';
  const [selectedRoomId, setSelectedRoomId] = useState(defaultRoomId);
  const [isMobile, setIsMobile] = useState(false);
  const [showSidebar, setShowSidebar] = useState(true);

  // Use WebSocket chat hook
  const { 
    messages, 
    isConnected, 
    currentRoom, 
    sendMessage: sendWebSocketMessage,
    connectionError,
    lastError,
    pendingMessagesCount,
    retryConnection,
    encryptionStatus,
    typingUsers,
    onlineUsers,
    startTyping,
    stopTyping
  } = useChat(
    selectedRoomId,
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

  // Handle room selection
  const handleRoomSelect = (newRoomId) => {
    setSelectedRoomId(newRoomId);
    
    // Update URL without page refresh
    if (newRoomId === 'general') {
      router.push('/chat', undefined, { shallow: true });
    } else {
      router.push(`/chat/${newRoomId}`, undefined, { shallow: true });
    }

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
        setSelectedRoomId('general');
        if (isMobile) {
          setShowSidebar(true);
        }
      } else if (pathname.startsWith('/chat/')) {
        const roomFromUrl = pathname.split('/chat/')[1];
        if (roomFromUrl && roomFromUrl !== selectedRoomId) {
          setSelectedRoomId(roomFromUrl);
          if (isMobile) {
            setShowSidebar(false);
          }
        }
      }
    };

    handleRouteChange();
  }, [pathname, isMobile, selectedRoomId]);

  return (
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
        <ChatSidebar 
          selectedRoomId={selectedRoomId}
          onRoomSelect={handleRoomSelect}
          currentUser={currentUser}
          isMobile={isMobile}
        />
      </div>

      {/* Main Chat Area */}
      <div className={clsx(
        "flex-1 flex flex-col transition-all duration-300 ease-in-out",
        {
          "hidden": isMobile && showSidebar,
        }
      )}>
        <ChatMain
          messages={messages}
          isConnected={isConnected}
          currentRoom={currentRoom}
          selectedRoomId={selectedRoomId}
          sendMessage={sendWebSocketMessage}
          connectionError={connectionError}
          lastError={lastError}
          pendingMessagesCount={pendingMessagesCount}
          retryConnection={retryConnection}
          encryptionStatus={encryptionStatus}
          currentUser={currentUser}
          isMobile={isMobile}
          onBackToList={handleBackToList}
          typingUsers={typingUsers}
          onlineUsers={onlineUsers}
          startTyping={startTyping}
          stopTyping={stopTyping}
        />
      </div>
    </div>
  );
}

export default memo(ChatInterface);