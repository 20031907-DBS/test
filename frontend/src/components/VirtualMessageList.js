"use client"
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { clsx } from 'clsx';

const ITEM_HEIGHT = 80; // Approximate height of a message
const BUFFER_SIZE = 5; // Number of items to render outside viewport

export default function VirtualMessageList({ 
  messages, 
  renderMessage, 
  onLoadMore, 
  hasMore, 
  loading,
  className = '' 
}) {
  const [scrollTop, setScrollTop] = useState(0);
  const [containerHeight, setContainerHeight] = useState(0);
  const containerRef = useRef(null);
  const isScrollingRef = useRef(false);
  const scrollTimeoutRef = useRef(null);

  // Calculate visible range
  const startIndex = Math.max(0, Math.floor(scrollTop / ITEM_HEIGHT) - BUFFER_SIZE);
  const endIndex = Math.min(
    messages.length - 1,
    Math.ceil((scrollTop + containerHeight) / ITEM_HEIGHT) + BUFFER_SIZE
  );

  const visibleMessages = messages.slice(startIndex, endIndex + 1);

  // Handle scroll events
  const handleScroll = useCallback((e) => {
    const newScrollTop = e.target.scrollTop;
    setScrollTop(newScrollTop);

    // Load more messages when scrolling to top
    if (newScrollTop < 100 && hasMore && !loading && onLoadMore) {
      onLoadMore();
    }

    // Debounce scroll end detection
    isScrollingRef.current = true;
    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current);
    }
    scrollTimeoutRef.current = setTimeout(() => {
      isScrollingRef.current = false;
    }, 150);
  }, [hasMore, loading, onLoadMore]);

  // Handle container resize
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerHeight(entry.contentRect.height);
      }
    });

    resizeObserver.observe(container);
    return () => resizeObserver.disconnect();
  }, []);

  // Auto-scroll to bottom for new messages (unless user is scrolling)
  useEffect(() => {
    const container = containerRef.current;
    if (!container || isScrollingRef.current) return;

    const isNearBottom = 
      container.scrollHeight - container.scrollTop - container.clientHeight < 100;

    if (isNearBottom) {
      container.scrollTop = container.scrollHeight;
    }
  }, [messages.length]);

  const totalHeight = messages.length * ITEM_HEIGHT;
  const offsetY = startIndex * ITEM_HEIGHT;

  return (
    <div
      ref={containerRef}
      className={clsx('overflow-y-auto', className)}
      onScroll={handleScroll}
      style={{ height: '100%' }}
    >
      {/* Loading indicator at top */}
      {loading && (
        <div className="flex justify-center py-4">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
        </div>
      )}

      {/* Virtual scrolling container */}
      <div style={{ height: totalHeight, position: 'relative' }}>
        <div
          style={{
            transform: `translateY(${offsetY}px)`,
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
          }}
        >
          {visibleMessages.map((message, index) => (
            <div
              key={message.id}
              style={{ height: ITEM_HEIGHT }}
              className="flex items-start"
            >
              {renderMessage(message, startIndex + index)}
            </div>
          ))}
        </div>
      </div>

      {/* End of messages indicator */}
      {!hasMore && messages.length > 0 && (
        <div className="text-center py-4 text-gray-500 text-sm">
          No more messages
        </div>
      )}
    </div>
  );
}