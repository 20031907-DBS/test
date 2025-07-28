import { useState, useCallback, useRef, useEffect } from 'react';

export const useMessagePagination = (roomId, initialMessages = []) => {
  const [messages, setMessages] = useState(initialMessages);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const pageSize = 50;
  const loadedPages = useRef(new Set());

  // Reset when room changes
  useEffect(() => {
    if (roomId) {
      setMessages([]);
      setHasMore(true);
      setError(null);
      loadedPages.current.clear();
    }
  }, [roomId]);

  const loadMoreMessages = useCallback(async () => {
    if (loading || !hasMore || !roomId) return;

    setLoading(true);
    setError(null);

    try {
      const offset = messages.length;
      const page = Math.floor(offset / pageSize);
      
      if (loadedPages.current.has(page)) {
        setLoading(false);
        return;
      }

      // In a real app, this would be an API call
      // For now, simulate loading older messages
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Mock older messages
      const olderMessages = Array.from({ length: Math.min(pageSize, 20) }, (_, i) => ({
        id: `old-${page}-${i}`,
        text: `Older message ${page * pageSize + i + 1}`,
        sender: i % 3 === 0 ? 'me' : 'other',
        timestamp: new Date(Date.now() - (offset + i + 1) * 60000).toLocaleTimeString([], { 
          hour: '2-digit', 
          minute: '2-digit' 
        }),
        senderName: i % 3 === 0 ? 'You' : `User ${(i % 2) + 1}`,
        isEncrypted: true
      }));

      if (olderMessages.length < pageSize) {
        setHasMore(false);
      }

      setMessages(prev => [...olderMessages, ...prev]);
      loadedPages.current.add(page);
    } catch (err) {
      setError(err.message || 'Failed to load messages');
    } finally {
      setLoading(false);
    }
  }, [loading, hasMore, roomId, messages.length, pageSize]);

  const addMessage = useCallback((newMessage) => {
    setMessages(prev => [...prev, newMessage]);
  }, []);

  const updateMessage = useCallback((messageId, updates) => {
    setMessages(prev => prev.map(msg => 
      msg.id === messageId ? { ...msg, ...updates } : msg
    ));
  }, []);

  const removeMessage = useCallback((messageId) => {
    setMessages(prev => prev.filter(msg => msg.id !== messageId));
  }, []);

  return {
    messages,
    hasMore,
    loading,
    error,
    loadMoreMessages,
    addMessage,
    updateMessage,
    removeMessage
  };
};