"use client"
import ChatInterface from '../../../components/ChatInterface';

export default function ChatRoomPage({ params }) {
  const { roomId } = params;
  
  return <ChatInterface roomId={roomId} />;
}