'use client';

import React, { useEffect, useState } from 'react';
import { useHCSMessages } from '../services/api';
import { useAgentWebSocket } from '../hooks/useAgentWebSocket';
import LoadingSkeleton from './LoadingSkeleton';

const AGENT_TYPES = {
  'rebalance-agent': {
    name: 'Rebalance Agent',
    description: 'Monitors approved proposals and executes rebalances',
    icon: '⚖️',
    color: 'blue',
    eventTypes: ['rebalance_proposed', 'rebalance_approved', 'rebalance_executed']
  },
  'price-feed-agent': {
    name: 'Price Feed Agent',
    description: 'Tracks token prices and detects deviations',
    icon: '📈',
    color: 'yellow',
    eventTypes: ['price_updated']
  },
  'risk-assessment-agent': {
    name: 'Risk Assessment Agent',
    description: 'Analyzes market conditions and triggers alerts',
    icon: '⚠️',
    color: 'red',
    eventTypes: ['risk_alert']
  },
  'hcs10-agent': {
    name: 'HCS-10 Agent',
    description: 'Handles HCS-10 protocol messages and agent communication',
    icon: '🔄',
    color: 'purple',
    eventTypes: ['agent_registered', 'agent_connected', 'agent_disconnected', 'agent_request_received', 'agent_response_sent']
  }
} as const;

export default function AgentStatus() {
  const { data: messages, isLoading: isLoadingHCS } = useHCSMessages();
  const { connected, messages: wsMessages, error } = useAgentWebSocket();
  const [agentStatuses, setAgentStatuses] = useState<Record<string, { status: string; lastEventTime?: number; lastEventType?: string }>>({});
  
  // Process WebSocket messages to update agent statuses
  useEffect(() => {
    if (!wsMessages.length) return;
    
    const newStatuses = { ...agentStatuses };
    
    // Filter only agent-related messages
    const agentMessages = wsMessages.filter(msg => {
      const msgType = msg.type;
      return Object.values(AGENT_TYPES).some(agent => 
        agent.eventTypes.includes(msgType as any)
      );
    });
    
    // Update statuses based on messages
    agentMessages.forEach(msg => {
      // Find which agent this message belongs to
      for (const [agentId, agentInfo] of Object.entries(AGENT_TYPES)) {
        if (agentInfo.eventTypes.includes(msg.type as any)) {
          // Update status for this agent
          newStatuses[agentId] = {
            status: 'active',
            lastEventTime: msg.data.timestamp || Date.now(),
            lastEventType: msg.type
          };
          break;
        }
      }
    });
    
    // Set any agent as inactive if no events in the last 5 minutes
    const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
    Object.keys(newStatuses).forEach(agentId => {
      if (newStatuses[agentId].lastEventTime && newStatuses[agentId].lastEventTime < fiveMinutesAgo) {
        newStatuses[agentId].status = 'inactive';
      }
    });
    
    setAgentStatuses(newStatuses);
  }, [wsMessages]);
  
  // Also check HCS messages for backward compatibility
  useEffect(() => {
    if (!messages) return;
    
    const newStatuses = { ...agentStatuses };
    
    // Check if any HCS messages match agent types
    messages.forEach(msg => {
      if (msg.type === 'PriceUpdate') {
        newStatuses['price-feed-agent'] = {
          status: 'active',
          lastEventTime: msg.timestamp,
          lastEventType: 'PriceUpdate'
        };
      } else if (msg.type === 'RiskAlert') {
        newStatuses['risk-assessment-agent'] = {
          status: 'active',
          lastEventTime: msg.timestamp,
          lastEventType: 'RiskAlert'
        };
      } else if (msg.type === 'RebalanceExecuted') {
        newStatuses['rebalance-agent'] = {
          status: 'active',
          lastEventTime: msg.timestamp,
          lastEventType: 'RebalanceExecuted'
        };
      }
    });
    
    setAgentStatuses(prev => ({ ...prev, ...newStatuses }));
  }, [messages]);
  
  // Mark WebSocket connection status
  const wsStatus = connected ? (
    <div className="text-sm mb-4 p-2 bg-green-900 text-green-200 rounded">
      <span className="inline-block h-2 w-2 bg-green-400 rounded-full mr-2"></span>
      Agent WebSocket Connected
    </div>
  ) : (
    <div className="text-sm mb-4 p-2 bg-red-900 text-red-200 rounded">
      <span className="inline-block h-2 w-2 bg-red-400 rounded-full mr-2"></span>
      Agent WebSocket Disconnected
      {error && <span className="ml-2">({error.message})</span>}
    </div>
  );

  if (isLoadingHCS && !Object.keys(agentStatuses).length) {
    return <LoadingSkeleton type="card" count={Object.keys(AGENT_TYPES).length} />;
  }

  return (
    <div>
      {wsStatus}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {Object.entries(AGENT_TYPES).map(([id, agent]) => {
          const agentStatus = agentStatuses[id] || { status: 'unknown' };
          
          return (
            <div 
              key={id} 
              className="border border-gray-700 rounded-lg p-4 transition-all duration-300 hover:shadow-md bg-gray-800"
            >
              <div className="flex items-start">
                <div className="flex-shrink-0 mr-3">
                  <span className="text-2xl">{agent.icon}</span>
                </div>
                <div className="flex-1 min-w-0">
                  {/* Title, status badge, and description in separate rows */}
                  <div>
                    <h3 className="text-sm font-medium text-white mb-1">{agent.name}</h3>
                    <div className="mb-2">
                      <span className={`inline-block px-2 py-1 text-xs rounded-full ${
                        agentStatus.status === 'active' 
                          ? 'bg-green-800 text-green-200'
                          : agentStatus.status === 'unknown'
                            ? 'bg-yellow-800 text-yellow-200'
                            : 'bg-gray-700 text-gray-300'
                      }`}>
                        {agentStatus.status === 'active' ? 'Active' : 
                         agentStatus.status === 'unknown' ? 'Unknown' : 'Inactive'}
                      </span>
                    </div>
                    <p className="text-xs text-gray-300 mb-2">{agent.description}</p>
                  </div>

                  {agentStatus.lastEventType && (
                    <div className="mt-2">
                      <p className="text-xs text-gray-300">
                        Last Event: {agentStatus.lastEventType}
                      </p>
                      {agentStatus.lastEventTime && (
                        <p className="text-xs text-gray-300">
                          {new Date(agentStatus.lastEventTime).toLocaleString()}
                        </p>
                      )}
                    </div>
                  )}

                  <div className="mt-2">
                    <p className="text-xs text-gray-300">
                      Monitoring: {
                        id === 'price-feed-agent' ? 'Token prices and deviations' :
                        id === 'risk-assessment-agent' ? 'Market conditions and risk thresholds' :
                        id === 'hcs10-agent' ? 'Protocol messages and agent communication' :
                        'Approved rebalance proposals'
                      }
                    </p>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
} 