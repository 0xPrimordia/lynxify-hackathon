'use client';

import React, { Suspense, useEffect, useState } from 'react';
import { HCSMessage } from '../types/hcs';
import { useHCSMessages } from '../services/api';
import LoadingSkeleton from './LoadingSkeleton';
import websocketService from '../services/websocket';

interface HCSMessageFeedProps {
  maxMessages?: number;
}

function MessageList({ messages }: { messages: HCSMessage[] }) {
  const getMessageTypeColor = (type: string) => {
    switch (type) {
      case 'RebalanceProposal':
        return 'bg-blue-800 text-blue-200';
      case 'RebalanceApproved':
        return 'bg-green-800 text-green-200';
      case 'RebalanceExecuted':
        return 'bg-purple-800 text-purple-200';
      case 'PriceUpdate':
        return 'bg-yellow-800 text-yellow-200';
      case 'RiskAlert':
        return 'bg-red-800 text-red-200';
      default:
        return 'bg-gray-700 text-gray-200';
    }
  };

  const getMessageIcon = (type: string) => {
    switch (type) {
      case 'RebalanceProposal':
        return '📊';
      case 'RebalanceApproved':
        return '✅';
      case 'RebalanceExecuted':
        return '⚡';
      case 'PriceUpdate':
        return '💰';
      case 'RiskAlert':
        return '⚠️';
      default:
        return '📝';
    }
  };

  const getMessageDescription = (message: HCSMessage) => {
    switch (message.type) {
      case 'RebalanceProposal':
        return 'A new rebalance proposal has been created';
      case 'RebalanceApproved':
        return 'The rebalance proposal has been approved by the DAO';
      case 'RebalanceExecuted':
        return 'The rebalance has been executed by the agent';
      case 'PriceUpdate':
        return 'Price update received from the market';
      case 'RiskAlert':
        return 'Risk threshold exceeded, triggering a proposal';
      default:
        return 'New message received';
    }
  };

  return (
    <div className="space-y-4">
      {messages.map((message, index) => {
        // Debug each message as it's being processed
        console.log(`Processing message ${index}:`, message);
        
        return (
          <div
            key={message.id || index}
            className="border border-gray-700 rounded-lg p-4 transition-all duration-300 hover:bg-gray-800"
          >
            <div className="flex items-start space-x-3">
              <div className="flex-shrink-0">
                <span className="text-2xl">{getMessageIcon(message.type)}</span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className={`px-2 py-1 text-xs rounded-full ${getMessageTypeColor(message.type)}`}>
                    {message.type}
                  </span>
                  <span className="text-xs text-gray-400">
                    {new Date(message.timestamp).toLocaleString()}
                  </span>
                </div>
                
                <p className="mt-2 text-sm text-gray-300">
                  {getMessageDescription(message)}
                </p>
                
                <div className="mt-2 text-sm">
                  {message.type === 'RebalanceProposal' && message.details && message.details.newWeights && (
                    <div>
                      <p className="font-medium text-gray-200">Proposed Changes:</p>
                      <div className="mt-1 grid grid-cols-2 gap-2">
                        {Object.entries(message.details.newWeights).map(([token, weight]) => (
                          <div key={token} className="text-xs text-gray-300">
                            {token}: {(Number(weight) * 100).toFixed(2)}%
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {message.type === 'RebalanceApproved' && message.details && (
                    <div>
                      <p className="font-medium text-gray-200">Approval Details:</p>
                      <div className="mt-1 text-xs text-gray-300">
                        <p>Proposal ID: {message.details.proposalId || 'Unknown'}</p>
                        <p>Approved At: {message.details.approvedAt ? new Date(message.details.approvedAt).toLocaleString() : 'Unknown'}</p>
                        {message.votes && (
                          <p>Votes: {message.votes.for} for, {message.votes.against} against (total: {message.votes.total})</p>
                        )}
                      </div>
                    </div>
                  )}

                  {message.type === 'RebalanceExecuted' && message.details && (
                    <div>
                      <p className="font-medium text-gray-200">Execution Details:</p>
                      <div className="mt-1 text-xs text-gray-300">
                        <p>Proposal ID: {message.details.proposalId || 'Unknown'}</p>
                        
                        {/* AI Analysis Section - Highlight the AI reasoning */}
                        {message.details.message && (
                          <div className="mt-3 p-3 bg-gray-700 rounded-md border border-gray-600">
                            <div className="flex items-center mb-1">
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-purple-400 mr-1" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M9.4 4a.5.5 0 0 1 .2.6l-1 2a.5.5 0 0 1-.9 0l-1-2a.5.5 0 0 1 .2-.6l1-.5a.5.5 0 0 1 .5 0l1 .5zM7 8a1 1 0 0 1 1-1h4a1 1 0 0 1 0 2H8a1 1 0 0 1-1-1zm1 2a1 1 0 1 0 0 2h4a1 1 0 1 0 0-2H8zm9-5.3V15a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4.7a.7.7 0 0 1 .4-.6l6-3a.7.7 0 0 1 .7 0l6 3a.7.7 0 0 1 .4.6zM5 4.7V15h10V4.7l-5-2.5-5 2.5z" clipRule="evenodd" />
                              </svg>
                              <span className="text-purple-300 font-medium">AI Analysis</span>
                            </div>
                            <p className="text-gray-200 italic">{message.details.message}</p>
                          </div>
                        )}
                        
                        {message.details.preBalances && (
                          <div className="mt-2">
                            <p className="font-medium text-gray-200">Before:</p>
                            {Object.entries(message.details.preBalances).map(([token, value]) => (
                              <div key={token} className="text-xs text-gray-300">
                                {token}: {typeof value === 'number' ? (value * 100).toFixed(2) + '%' : value}
                              </div>
                            ))}
                          </div>
                        )}
                        {message.details.postBalances && (
                          <div className="mt-2">
                            <p className="font-medium text-gray-200">After:</p>
                            {Object.entries(message.details.postBalances).map(([token, value]) => (
                              <div key={token} className="text-xs text-gray-300">
                                {token}: {typeof value === 'number' ? (value * 100).toFixed(2) + '%' : value}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {message.type === 'PriceUpdate' && (
                    <div>
                      <p className="font-medium text-gray-200">Price Update:</p>
                      <div className="mt-1 text-xs text-gray-300">
                        {message.details?.tokenId}: ${message.details?.price?.toFixed(2)}
                        <span className={`ml-2 ${(message.details?.metrics?.priceChange || 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                          {(message.details?.metrics?.priceChange || 0) >= 0 ? '+' : ''}
                          {message.details?.metrics?.priceChange?.toFixed(2) || '0.00'}%
                        </span>
                      </div>
                    </div>
                  )}
                  
                  {message.type === 'RiskAlert' && (
                    <div>
                      <p className="font-medium text-gray-200">Risk Alert:</p>
                      <div className="mt-1 text-xs">
                        <p className="text-gray-300">{message.details?.message}</p>
                        <p className="text-red-400">{message.details?.impact}</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function HCSMessageFeed({ maxMessages = 10 }: HCSMessageFeedProps) {
  const { data: apiMessages, isLoading, error } = useHCSMessages();
  const [messages, setMessages] = useState<HCSMessage[]>([]);
  const [wsConnected, setWsConnected] = useState(false);

  // Use the WebSocket service to get real-time updates
  useEffect(() => {
    console.log('🔌 CLIENT: Initializing WebSocket connection for HCS messages...');
    
    // First, set the messages from the API when they're loaded
    if (apiMessages?.length) {
      console.log(`🔌 CLIENT: Setting initial messages from API: ${apiMessages.length} messages`);
      setMessages(apiMessages);
    }
    
    // Then, subscribe to the WebSocket for real-time updates
    const unsubscribe = websocketService.subscribe((message: HCSMessage) => {
      console.log('🔌 CLIENT: Received WebSocket message:', message);
      setWsConnected(true);
      
      // Add the message to our local state if it's not a duplicate
      setMessages(prevMessages => {
        // Check if message already exists
        const exists = prevMessages.some(msg => msg.id === message.id);
        if (exists) {
          console.log(`🔌 CLIENT: Skipping duplicate message: ${message.id}`);
          return prevMessages;
        }
        
        console.log(`🔌 CLIENT: Adding new WebSocket message: ${message.id} (${message.type})`);
        // Add the new message and sort by timestamp (newest first)
        return [message, ...prevMessages]
          .sort((a, b) => b.timestamp - a.timestamp)
          .slice(0, maxMessages);
      });
    });
    
    // Clean up WebSocket subscription when component unmounts
    return () => {
      console.log('🔌 CLIENT: Cleaning up WebSocket subscription');
      unsubscribe();
    };
  }, [apiMessages, maxMessages]);

  if (isLoading && messages.length === 0) {
    return <LoadingSkeleton type="list" count={3} />;
  }

  if (error && messages.length === 0) {
    return (
      <div className="text-red-400">
        {error instanceof Error ? error.message : 'Failed to load messages'}
      </div>
    );
  }

  if (!messages?.length) {
    return (
      <div className="text-gray-400 text-center py-4">
        {wsConnected ? 'Connected to WebSocket, waiting for messages...' : 'No messages'}
      </div>
    );
  }

  console.log(`HCSMessageFeed: Displaying ${messages.length} messages`);

  return (
    <Suspense fallback={<LoadingSkeleton type="list" count={3} />}>
      <div className="relative">
        {wsConnected && (
          <div className="absolute top-0 right-0 flex items-center text-xs text-green-400">
            <span className="h-2 w-2 rounded-full bg-green-400 mr-1 animate-pulse"></span>
            WebSocket Connected
          </div>
        )}
        <MessageList messages={messages} />
      </div>
    </Suspense>
  );
} 