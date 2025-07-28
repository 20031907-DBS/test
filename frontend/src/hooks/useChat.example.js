// Simple example of using the useChat hook
import React, { useState } from 'react';
import { useChat } from './useChat';

const ChatExample = () => {
  const [messageInput, setMessageInput] = useState('');
  
  // Use the chat hook
  const { messages, isConnected, sendMessage } = useChat(
    'general', // room id
    'user123', // user id
    'token123' // token
  );

  const handleSendMessage = () => {
    if (messageInput.trim()) {
      sendMessage(messageInput);
      setMessageInput('');
    }
  };

  return (
    <div>
      <h2>Simple Chat</h2>
      
      <div>Status: {isConnected ? 'Connected' : 'Disconnected'}</div>
      
      <div style={{ height: '300px', border: '1px solid #ccc', padding: '10px' }}>
        {messages.map(message => (
          <div key={message.id}>
            <strong>{message.sender}:</strong> {message.text} ({message.timestamp})
          </div>
        ))}
      </div>

      <div>
        <input
          value={messageInput}
          onChange={(e) => setMessageInput(e.target.value)}
          placeholder="Type message..."
        />
        <button onClick={handleSendMessage}>Send</button>
      </div>
    </div>
  );
};

export default ChatExample;