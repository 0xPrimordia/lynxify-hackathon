'use client';

import React, { Suspense, useEffect, useState } from 'react';
import { HCSMessage } from '../types/hcs';
import { useHCSMessages } from '../services/api';
import LoadingSkeleton from './LoadingSkeleton';
import websocketService from '../services/websocket';
import { useAgentWebSocket, AgentWebSocketMessage } from '../hooks/useAgentWebSocket';

interface HCSMessageFeedProps {
  maxMessages?: number;
}

// Helper function to convert agent websocket messages to HCS message format
function convertAgentMessageToHCS(message: AgentWebSocketMessage): HCSMessage {
  const { type, data } = message;
  
  // Generate a unique ID for the message
  const id = `agent-${type}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  
  // Basic HCS message structure
  const hcsMessage: HCSMessage = {
    id,
    type: mapAgentTypeToHCS(type),
    timestamp: data.timestamp || Date.now(),
    consensusTimestamp: data.timestamp ? new Date(data.timestamp).toISOString() : new Date().toISOString(),
    sender: 'agent',
    details: data,
    sequence: 0
  };
  
  return hcsMessage;
}

// Map agent message types to HCS message types
function mapAgentTypeToHCS(type: string): string {
  const typeMap: Record<string, string> = {
    'rebalance_proposed': 'RebalanceProposal',
    'rebalance_approved': 'RebalanceApproved',
    'rebalance_executed': 'RebalanceExecuted',
    'price_updated': 'PriceUpdate',
    'risk_alert': 'RiskAlert',
    'proposal_created': 'ProposalCreated',
    'proposal_voted': 'ProposalVoted',
    'proposal_executed': 'ProposalExecuted',
    'token_added': 'TokenAdded',
    'token_removed': 'TokenRemoved',
    'token_transaction': 'TokenTransaction',
    'agent_registered': 'AgentRegistered',
    'agent_connected': 'AgentConnected',
    'agent_disconnected': 'AgentDisconnected',
    'transaction_confirmed': 'TransactionConfirmed',
    'transaction_failed': 'TransactionFailed',
    'system_status': 'SystemStatus',
    'system_error': 'SystemError'
  };
  
  return typeMap[type] || type;
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
      case 'AgentRegistered':
      case 'AgentConnected':
      case 'AgentDisconnected':
        return 'bg-indigo-800 text-indigo-200';
      case 'TokenTransaction':
      case 'TokenAdded':
      case 'TokenRemoved':
        return 'bg-pink-800 text-pink-200';
      case 'TransactionConfirmed':
      case 'TransactionFailed':
        return 'bg-blue-900 text-blue-200';
      case 'SystemStatus':
      case 'SystemError':
        return 'bg-gray-800 text-gray-200';
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
      case 'AgentRegistered':
        return '📝';
      case 'AgentConnected':
        return '🔌';
      case 'AgentDisconnected':
        return '🔴';
      case 'TokenTransaction':
        return '💸';
      case 'TokenAdded':
        return '➕';
      case 'TokenRemoved':
        return '➖';
      case 'TransactionConfirmed':
        return '✓';
      case 'TransactionFailed':
        return '❌';
      case 'SystemStatus':
        return '🔄';
      case 'SystemError':
        return '🚨';
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
        return `Price update for ${message.details?.tokenId || 'a token'}`;
      case 'RiskAlert':
        return 'Risk threshold exceeded, triggering a proposal';
      case 'AgentRegistered':
        return `Agent ${message.details?.agentId || ''} registered with the system`;
      case 'AgentConnected':
        return `Agent ${message.details?.agentId || ''} connected`;
      case 'AgentDisconnected':
        return `Agent ${message.details?.agentId || ''} disconnected`;
      case 'TokenTransaction':
        return `Token ${message.details?.operation || 'operation'} transaction`;
      case 'TokenAdded':
        return `Token ${message.details?.tokenSymbol || ''} added to the index`;
      case 'TokenRemoved':
        return `Token ${message.details?.tokenId || ''} removed from the index`;
      case 'TransactionConfirmed':
        return `Transaction ${message.details?.type || ''} confirmed`;
      case 'TransactionFailed':
        return `Transaction ${message.details?.type || ''} failed`;
      case 'SystemStatus':
        return `System status: ${message.details?.status || ''}`;
      case 'SystemError':
        return `System error occurred`;
      default:
        return 'New message received';
    }
  };

  return (
    <div className="space-y-4">
      {messages.map((message, index) => {
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

                  {message.type === 'PriceUpdate' && message.details && (
                    <div>
                      <p className="font-medium text-gray-200">Price Update:</p>
                      <div className="mt-1 text-xs text-gray-300">
                        {message.details.tokenId}: ${typeof message.details.price === 'number' ? message.details.price.toFixed(2) : message.details.price}
                        {message.details.metrics && typeof message.details.metrics.priceChange === 'number' && (
                          <span className={`ml-2 ${message.details.metrics.priceChange >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                            {message.details.metrics.priceChange >= 0 ? '+' : ''}
                            {message.details.metrics.priceChange.toFixed(2)}%
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                  
                  {message.type === 'RiskAlert' && message.details && (
                    <div>
                      <p className="font-medium text-gray-200">Risk Alert:</p>
                      <div className="mt-1 text-xs">
                        <p className="text-gray-300">{message.details.riskDescription || message.details.message}</p>
                        <p className="text-red-400">{message.details.impact}</p>
                        {message.details.affectedTokens && (
                          <div className="mt-1">
                            <p className="font-medium text-gray-200">Affected Tokens:</p>
                            <div className="flex flex-wrap gap-1 mt-1">
                              {message.details.affectedTokens.map((token: string) => (
                                <span key={token} className="px-2 py-1 bg-red-900 text-red-200 rounded-full text-xs">
                                  {token}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Token operation events */}
                  {['TokenAdded', 'TokenRemoved', 'TokenTransaction'].includes(message.type) && message.details && (
                    <div>
                      <p className="font-medium text-gray-200">Token Operation:</p>
                      <div className="mt-1 text-xs text-gray-300">
                        {message.type === 'TokenAdded' && (
                          <>
                            <p>Symbol: {message.details.tokenSymbol}</p>
                            <p>ID: {message.details.tokenId}</p>
                            {message.details.initialWeight && (
                              <p>Initial Weight: {(message.details.initialWeight * 100).toFixed(2)}%</p>
                            )}
                          </>
                        )}
                        {message.type === 'TokenRemoved' && (
                          <p>Token ID: {message.details.tokenId}</p>
                        )}
                        {message.type === 'TokenTransaction' && (
                          <>
                            <p>Operation: {message.details.operation}</p>
                            <p>Transaction ID: {message.details.transactionId.substring(0, 10)}...</p>
                            <p>Status: {message.details.status}</p>
                          </>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Agent events */}
                  {['AgentRegistered', 'AgentConnected', 'AgentDisconnected'].includes(message.type) && message.details && (
                    <div>
                      <p className="font-medium text-gray-200">Agent Event:</p>
                      <div className="mt-1 text-xs text-gray-300">
                        <p>Agent ID: {message.details.agentId}</p>
                        {message.type === 'AgentRegistered' && message.details.registryTopicId && (
                          <p>Registry Topic: {message.details.registryTopicId}</p>
                        )}
                        {message.type === 'AgentConnected' && message.details.capabilities && (
                          <div>
                            <p>Capabilities:</p>
                            <ul className="list-disc list-inside">
                              {message.details.capabilities.map((cap: string) => (
                                <li key={cap}>{cap}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {message.type === 'AgentDisconnected' && message.details.reason && (
                          <p>Reason: {message.details.reason}</p>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Transaction events */}
                  {['TransactionConfirmed', 'TransactionFailed'].includes(message.type) && message.details && (
                    <div>
                      <p className="font-medium text-gray-200">Transaction Event:</p>
                      <div className="mt-1 text-xs text-gray-300">
                        <p>Type: {message.details.type}</p>
                        <p>ID: {message.details.transactionId.substring(0, 10)}...</p>
                        {message.type === 'TransactionFailed' && message.details.error && (
                          <p className="text-red-400">Error: {message.details.error}</p>
                        )}
                      </div>
                    </div>
                  )}

                  {/* System events */}
                  {['SystemStatus', 'SystemError'].includes(message.type) && message.details && (
                    <div>
                      <p className="font-medium text-gray-200">System Event:</p>
                      <div className="mt-1 text-xs text-gray-300">
                        {message.type === 'SystemStatus' && (
                          <p>Status: {message.details.status}</p>
                        )}
                        {message.type === 'SystemError' && (
                          <p className="text-red-400">Error: {message.details.message}</p>
                        )}
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
  const { connected, messages: agentMessages } = useAgentWebSocket();
  const [messages, setMessages] = useState<HCSMessage[]>([]);
  const [wsConnected, setWsConnected] = useState(false);

  // Process both legacy and agent WebSocket messages
  useEffect(() => {
    // First load legacy messages
    if (apiMessages?.length) {
      console.log(`🔌 CLIENT: Setting initial messages from API: ${apiMessages.length} messages`);
      setMessages(apiMessages);
    }
    
    // Subscribe to the legacy WebSocket for backward compatibility
    const unsubscribe = websocketService.subscribe((message: HCSMessage) => {
      console.log('🔌 CLIENT: Received legacy WebSocket message:', message);
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
      console.log('🔌 CLIENT: Cleaning up legacy WebSocket subscription');
      unsubscribe();
    };
  }, [apiMessages, maxMessages]);
  
  // Process agent WebSocket messages
  useEffect(() => {
    if (!agentMessages.length) return;
    
    // Convert agent messages to HCS format for display
    const convertedMessages = agentMessages.map(convertAgentMessageToHCS);
    
    // Update messages with agent websocket messages
    setMessages(prevMessages => {
      const newMessages = [...prevMessages];
      
      // Add each new agent message if it doesn't already exist
      convertedMessages.forEach(msg => {
        if (!newMessages.some(existing => existing.id === msg.id)) {
          newMessages.push(msg);
        }
      });
      
      // Sort by timestamp (newest first) and limit to maxMessages
      return newMessages
        .sort((a, b) => b.timestamp - a.timestamp)
        .slice(0, maxMessages);
    });
  }, [agentMessages, maxMessages]);

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

  // Connection status indicator
  const connectionStatus = (wsConnected || connected) ? (
    <div className="mb-4 text-xs p-2 bg-green-900 text-green-200 rounded flex items-center">
      <span className="inline-block h-2 w-2 mr-2 bg-green-400 rounded-full"></span>
      {connected ? 'Connected to Agent WebSocket' : 'Connected to Legacy WebSocket'}
    </div>
  ) : (
    <div className="mb-4 text-xs p-2 bg-red-900 text-red-200 rounded flex items-center">
      <span className="inline-block h-2 w-2 mr-2 bg-red-400 rounded-full"></span>
      Not connected to WebSocket
    </div>
  );

  return (
    <div>
      {connectionStatus}
      <MessageList messages={messages} />
    </div>
  );
} 