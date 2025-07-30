"use client"
import React, { useState, useEffect } from 'react';
import { Search, MessageCircle, Settings, LogOut, User, MoreVertical, Shield } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { clsx } from 'clsx';
import EncryptionSettings from './EncryptionSettings';

export default function ChatSidebar({ selectedRoomId, onRoomSelect, currentUser, isMobile }) {
  const { logout } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showEncryptionSettings, setShowEncryptionSettings] = useState(false);
  
  // Mock conversations - in a real app, this would come from an API
  const [conversations] = useState([
    {
      id: 'general',
      name: 'General Chat',
      lastMessage: 'Welcome to the encrypted chat!',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      unread: 0,
      online: true,
      isGroup: true,
      avatar: '👥'
    },
    {
      id: 'tech-talk',
      name: 'Tech Talk',
      lastMessage: 'Anyone working on React projects?',
      timestamp: '2:30 PM',
      unread: 2,
      online: true,
      isGroup: true,
      avatar: '💻'
    },
    {
      id: 'random',
      name: 'Random',
      lastMessage: 'Good morning everyone!',
      timestamp: '9:15 AM',
      unread: 0,
      online: false,
      isGroup: true,
      avatar: '🎲'
    }
  ]);

  const filteredConversations = conversations.filter(conv =>
    conv.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    conv.lastMessage.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  const getUserInitials = (name) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const formatTime = (timestamp) => {
    if (timestamp.includes(':')) {
      return timestamp;
    }
    return new Date(timestamp).toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  return (
    <div className="h-full flex flex-col bg-white">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 bg-gray-50">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="relative">
              <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center text-white font-semibold">
                {currentUser?.photoURL ? (
                  <img 
                    src={currentUser.photoURL} 
                    alt="Profile" 
                    className="w-10 h-10 rounded-full object-cover"
                  />
                ) : (
                  getUserInitials(currentUser?.displayName || 'User')
                )}
              </div>
              <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 border-2 border-white rounded-full"></div>
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-lg font-semibold text-gray-900 truncate">
                Chats
              </h2>
              <p className="text-sm text-gray-500 truncate">
                {currentUser?.displayName || currentUser?.email}
              </p>
            </div>
          </div>
          
          <div className="relative">
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-full transition-colors"
            >
              <MoreVertical className="w-5 h-5" />
            </button>
            
            {showUserMenu && (
              <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg border border-gray-200 z-10">
                <div className="py-1">
                  <button className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">
                    <User className="w-4 h-4 mr-3" />
                    Profile
                  </button>
                  <button 
                    onClick={() => {
                      setShowEncryptionSettings(true);
                      setShowUserMenu(false);
                    }}
                    className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                  >
                    <Shield className="w-4 h-4 mr-3" />
                    Encryption Settings
                  </button>
                  <button className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">
                    <Settings className="w-4 h-4 mr-3" />
                    Settings
                  </button>
                  <hr className="my-1" />
                  <button 
                    onClick={handleLogout}
                    className="flex items-center w-full px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                  >
                    <LogOut className="w-4 h-4 mr-3" />
                    Sign Out
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="p-4 border-b border-gray-200">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
          <input
            type="text"
            placeholder="Search conversations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-gray-100 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
      </div>

      {/* Conversations List */}
      <div className="flex-1 overflow-y-auto">
        {filteredConversations.length === 0 ? (
          <div className="p-4 text-center text-gray-500">
            <MessageCircle className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <p>No conversations found</p>
            {searchQuery && (
              <p className="text-sm mt-1">Try a different search term</p>
            )}
          </div>
        ) : (
          filteredConversations.map(conv => (
            <div
              key={conv.id}
              onClick={() => onRoomSelect(conv.id)}
              className={clsx(
                "flex items-center p-4 hover:bg-gray-50 cursor-pointer border-b border-gray-100 transition-colors",
                {
                  "bg-blue-50 border-blue-200": selectedRoomId === conv.id,
                }
              )}
            >
              <div className="relative flex-shrink-0">
                <div className="w-12 h-12 bg-gray-300 rounded-full flex items-center justify-center text-lg">
                  {conv.avatar}
                </div>
                {conv.online && (
                  <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 border-2 border-white rounded-full"></div>
                )}
              </div>
              
              <div className="ml-3 flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <h3 className={clsx(
                    "text-sm font-medium truncate",
                    {
                      "text-blue-900": selectedRoomId === conv.id,
                      "text-gray-900": selectedRoomId !== conv.id,
                    }
                  )}>
                    {conv.name}
                  </h3>
                  <span className="text-xs text-gray-500 ml-2 flex-shrink-0">
                    {formatTime(conv.timestamp)}
                  </span>
                </div>
                
                <div className="flex items-center justify-between mt-1">
                  <p className="text-sm text-gray-600 truncate">
                    {conv.lastMessage}
                  </p>
                  {conv.unread > 0 && (
                    <span className="ml-2 bg-blue-600 text-white text-xs rounded-full px-2 py-1 min-w-[20px] text-center flex-shrink-0">
                      {conv.unread > 99 ? '99+' : conv.unread}
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-gray-200 bg-gray-50">
        <div className="flex items-center justify-between text-xs text-gray-500">
          <span>🔒 End-to-end encrypted</span>
          <span>{filteredConversations.length} chats</span>
        </div>
      </div>

      {/* Encryption Settings Modal */}
      <EncryptionSettings 
        isOpen={showEncryptionSettings}
        onClose={() => setShowEncryptionSettings(false)}
      />
    </div>
  );
}