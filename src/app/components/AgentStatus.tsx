'use client';

import React from 'react';
import { Agent } from '../types/hedera';
import { useHCSMessages } from '../services/api';
import LoadingSkeleton from './LoadingSkeleton';

const AGENT_TYPES = {
  'rebalance-agent': {
    name: 'Rebalance Agent',
    description: 'Monitors approved proposals and executes rebalances',
    icon: '⚖️',
    color: 'blue'
  },
  'price-feed-agent': {
    name: 'Price Feed Agent',
    description: 'Tracks token prices and detects deviations',
    icon: '📈',
    color: 'yellow'
  },
  'risk-assessment-agent': {
    name: 'Risk Assessment Agent',
    description: 'Analyzes market conditions and triggers alerts',
    icon: '⚠️',
    color: 'red'
  }
} as const;

export default function AgentStatus() {
  const { data: messages, isLoading } = useHCSMessages();

  const getAgentStatus = (agentId: string) => {
    if (!messages) return 'inactive';
    
    // Check if agent has processed any messages in the last 5 minutes
    const recentMessages = messages.filter(msg => 
      msg.timestamp > Date.now() - 300000 && // 5 minutes
      (
        (agentId === 'price-feed-agent' && msg.type === 'PriceUpdate') ||
        (agentId === 'risk-assessment-agent' && msg.type === 'RiskAlert') ||
        (agentId === 'rebalance-agent' && msg.type === 'RebalanceExecuted')
      )
    );

    return recentMessages.length > 0 ? 'active' : 'inactive';
  };

  const getLastAction = (agentId: string) => {
    if (!messages) return null;
    
    const lastMessage = messages.find(msg => 
      (agentId === 'price-feed-agent' && msg.type === 'PriceUpdate') ||
      (agentId === 'risk-assessment-agent' && msg.type === 'RiskAlert') ||
      (agentId === 'rebalance-agent' && msg.type === 'RebalanceExecuted')
    );

    return lastMessage;
  };

  if (isLoading) {
    return <LoadingSkeleton type="card" count={3} />;
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {Object.entries(AGENT_TYPES).map(([id, agent]) => {
        const status = getAgentStatus(id);
        const lastAction = getLastAction(id);
        
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
                      status === 'active' 
                        ? 'bg-green-800 text-green-200'
                        : 'bg-gray-700 text-gray-300'
                    }`}>
                      {status === 'active' ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                  <p className="text-xs text-gray-300 mb-2">{agent.description}</p>
                </div>

                {lastAction && (
                  <div className="mt-2">
                    <p className="text-xs text-gray-300">
                      Last Action: {lastAction.type}
                    </p>
                    <p className="text-xs text-gray-300">
                      {new Date(lastAction.timestamp).toLocaleString()}
                    </p>
                  </div>
                )}

                <div className="mt-2">
                  <p className="text-xs text-gray-300">
                    Monitoring: {
                      id === 'price-feed-agent' ? 'Token prices and deviations' :
                      id === 'risk-assessment-agent' ? 'Market conditions and risk thresholds' :
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
  );
} 