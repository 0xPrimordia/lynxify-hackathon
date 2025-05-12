import { useState, useEffect, useCallback } from 'react';

// Define message types that can be received from the WebSocket
export interface AgentWebSocketMessage {
  type: string;
  data: any;
}

/**
 * React hook for connecting to the unified agent WebSocket service
 * and handling agent events in real-time
 * 
 * @param url WebSocket URL to connect to (defaults to ws://localhost:3001)
 * @returns Object containing WebSocket state and message handlers
 */
export function useAgentWebSocket(url: string = 'ws://localhost:3001') {
  const [socket, setSocket] = useState<WebSocket | null>(null);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [messages, setMessages] = useState<AgentWebSocketMessage[]>([]);
  
  // Initialize WebSocket connection
  useEffect(() => {
    console.log('🔌 Connecting to agent WebSocket:', url);
    
    const ws = new WebSocket(url);
    
    // Connection opened
    ws.onopen = () => {
      console.log('🔌 Connected to agent WebSocket');
      setConnected(true);
      setError(null);
    };
    
    // Connection closed
    ws.onclose = (event) => {
      console.log('🔌 Disconnected from agent WebSocket:', event.code, event.reason);
      setConnected(false);
      
      // Attempt to reconnect after 3 seconds if not closed cleanly
      if (event.code !== 1000) {
        setTimeout(() => {
          console.log('🔌 Attempting to reconnect...');
          // Component will re-run this effect
        }, 3000);
      }
    };
    
    // Connection error
    ws.onerror = (event) => {
      console.error('🔌 WebSocket error:', event);
      setError(new Error('WebSocket connection error'));
    };
    
    // Message received
    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data) as AgentWebSocketMessage;
        console.log('🔌 Received agent message:', message.type);
        
        // Add the message to our state
        setMessages(prev => [message, ...prev].slice(0, 100)); // Keep last 100 messages
        
      } catch (err) {
        console.error('🔌 Error parsing WebSocket message:', err, event.data);
      }
    };
    
    // Set the WebSocket instance
    setSocket(ws);
    
    // Clean up WebSocket on unmount
    return () => {
      console.log('🔌 Closing agent WebSocket connection');
      ws.close();
    };
  }, [url]);
  
  // Send a message to the WebSocket
  const sendMessage = useCallback((type: string, data: any) => {
    if (socket && connected) {
      const message = { type, data };
      socket.send(JSON.stringify(message));
      return true;
    }
    return false;
  }, [socket, connected]);
  
  // Get all messages of a specific type
  const getMessagesByType = useCallback((type: string) => {
    return messages.filter(msg => msg.type === type);
  }, [messages]);
  
  // Get the latest message of a specific type
  const getLatestMessageByType = useCallback((type: string) => {
    return messages.find(msg => msg.type === type) || null;
  }, [messages]);
  
  // Clear messages
  const clearMessages = useCallback(() => {
    setMessages([]);
  }, []);
  
  return {
    connected,
    error,
    messages,
    sendMessage,
    getMessagesByType,
    getLatestMessageByType,
    clearMessages
  };
} 