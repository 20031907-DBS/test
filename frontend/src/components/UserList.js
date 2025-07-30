"use client"
import React, { useState, useEffect } from 'react';
import websocketService from '../services/websocket';

const UserList = ({ currentUser, onStartChat }) => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  // Removed excessive logging to prevent console spam

  const loadUsers = () => {
    console.log('UserList: loadUsers called');
    setLoading(true);

    if (websocketService.getConnectionStatus()) {
      console.log('UserList: Requesting users from backend...');
      websocketService.requestAllUsers();
    } else {
      console.log('UserList: WebSocket not connected');
      setLoading(false);
    }
  };

  useEffect(() => {
    console.log('UserList: useEffect triggered, currentUser:', currentUser?.uid);

    if (!currentUser?.uid) {
      console.log('UserList: No current user, skipping...');
      return;
    }

    // Define event handler
    const handleAllUsersList = (data) => {
      console.log('UserList: Event handler - Received all users response:', data);

      if (data.status === 'success' && data.users && Array.isArray(data.users)) {
        // Filter out current user
        console.log('UserList: Raw users from backend:', data.users);
        console.log('UserList: Current user for filtering:', currentUser.uid, typeof currentUser.uid);

        const filteredUsers = data.users.filter(user => {
          const userId = user.id.toString();
          const currentUserId = currentUser.uid.toString();
          const shouldInclude = userId !== currentUserId;
          console.log(`UserList: User ${user.id} (${user.username || user.display_name}) - userId: "${userId}", currentUserId: "${currentUserId}", include: ${shouldInclude}`);
          return shouldInclude;
        });

        console.log('UserList: Final filtered users:', filteredUsers);
        setUsers(filteredUsers);
      } else {
        console.log('UserList: No users in response or error');
        setUsers([]);
      }
      setLoading(false);
    };

    // Add event listener and load users
    const setupAndLoad = () => {
      if (websocketService.socket && websocketService.getConnectionStatus()) {
        console.log('UserList: Socket ready, adding event listener');
        websocketService.socket.on('all_users_list', handleAllUsersList);

        // Load users after listener is set
        setTimeout(() => {
          console.log('UserList: Auto-loading users on mount');
          loadUsers();
        }, 200);
      } else {
        console.log('UserList: Socket not ready, retrying in 500ms...');
        setTimeout(setupAndLoad, 500);
      }
    };

    setupAndLoad();

    // Cleanup
    return () => {
      if (websocketService.socket) {
        console.log('UserList: Removing event listener');
        websocketService.socket.off('all_users_list', handleAllUsersList);
      }
    };
  }, [currentUser?.uid]);

  const handleRefresh = () => {
    console.log('UserList: Manual refresh requested');
    loadUsers();
  };

  const handleUserClick = (user) => {
    console.log('UserList: User clicked:', user);
    onStartChat(user);
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">Users</h3>
          <div className="flex space-x-2">
            <button
              onClick={handleRefresh}
              className="p-2 text-gray-500 hover:text-white hover:bg-gradient-to-r hover:from-purple-500 hover:to-blue-500 rounded-xl transition-all duration-300 shadow-soft hover:shadow-medium"
              title="Refresh user list"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
            <button
              onClick={() => {
                console.log('Manual test - WebSocket status:', websocketService.getConnectionStatus());
                console.log('Manual test - Socket object:', websocketService.socket);
                if (websocketService.socket) {
                  console.log('Manual test - Emitting get_all_users');
                  websocketService.socket.emit('get_all_users');

                  // Test if we can receive a direct event
                  console.log('Manual test - Adding temporary listener');
                  const tempHandler = (data) => {
                    console.log('TEMP HANDLER - Received all_users_list:', data);
                    if (data.status === 'success' && data.users) {
                      console.log('TEMP HANDLER - Setting users directly:', data.users);
                      setUsers(data.users.filter(u => u.id.toString() !== currentUser.uid.toString()));
                      setLoading(false);
                    }
                  };
                  websocketService.socket.once('all_users_list', tempHandler);
                }
              }}
              className="px-3 py-1 text-xs text-white gradient-accent rounded-lg hover:scale-105 transition-all duration-300 shadow-soft"
              title="Test backend connection"
            >
              Test
            </button>
          </div>
        </div>
        <div className="animate-pulse">
          <div className="h-4 gradient-neutral rounded-lg w-3/4 mb-4"></div>
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="flex items-center space-x-3 p-3 glass-morphism rounded-xl">
                <div className="w-10 h-10 gradient-neutral rounded-full"></div>
                <div className="h-4 gradient-neutral rounded-lg w-1/2"></div>
              </div>
            ))}
          </div>
        </div>
        <div className="mt-4 text-sm text-gray-500 text-center">
          Loading users...
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
          Users ({users.length})
        </h3>
        <div className="flex space-x-2">
          <button
            onClick={handleRefresh}
            className="p-2 text-gray-500 hover:text-white hover:bg-gradient-to-r hover:from-purple-500 hover:to-blue-500 rounded-xl transition-all duration-300 shadow-soft hover:shadow-medium"
            title="Refresh user list"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
          <button
            onClick={() => {
              console.log('Debug - Current users state:', users);
              console.log('Debug - Current user:', currentUser);
              console.log('Debug - Loading state:', loading);
              // Also request fresh data
              if (websocketService.socket) {
                websocketService.socket.emit('get_all_users');
              }
            }}
            className="px-3 py-1 text-xs text-white gradient-success rounded-lg hover:scale-105 transition-all duration-300 shadow-soft"
            title="Debug state"
          >
            Debug
          </button>
        </div>
      </div>

      {users.length === 0 ? (
        <div className="text-center py-12">
          <div className="w-16 h-16 gradient-neutral rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-soft">
            <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
            </svg>
          </div>
          <p className="text-base font-semibold text-gray-700 mb-2">No other users found</p>
          <p className="text-sm text-gray-500">Click refresh to load users or create more accounts</p>
        </div>
      ) : (
        <div className="space-y-3">
          {users.map(user => (
            <div
              key={user.id}
              onClick={() => handleUserClick(user)}
              className="flex items-center space-x-4 p-4 glass-morphism rounded-xl cursor-pointer transition-all duration-300 hover:scale-[1.02] hover:shadow-medium"
            >
              <div className="relative">
                <div className="w-12 h-12 gradient-primary rounded-xl flex items-center justify-center text-white text-base font-semibold shadow-soft">
                  {(user.display_name || user.name || user.username || user.email || 'U').charAt(0).toUpperCase()}
                </div>
                {user.is_online && (
                  <div className="absolute -bottom-1 -right-1 w-4 h-4 gradient-success rounded-full border-2 border-white shadow-soft"></div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-base font-semibold text-gray-900 truncate">
                  {user.display_name || user.name || user.username || user.email}
                </p>
                <p className="text-sm text-gray-500 flex items-center space-x-1">
                  <span className={`w-2 h-2 rounded-full ${user.is_online ? 'bg-green-400' : 'bg-gray-400'}`}></span>
                  <span>{user.is_online ? 'Online' : 'Offline'}</span>
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default UserList;