"use client"
import { use } from 'react';
import ChatInterface from '../../../components/ChatInterface';

export default function ChatRoomPage({ params }) {
  const { roomId } = use(params);
  
  return <ChatInterface roomId={roomId} />;
}