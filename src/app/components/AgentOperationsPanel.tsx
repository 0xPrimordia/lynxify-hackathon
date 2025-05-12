'use client';

import React, { useState, useEffect } from 'react';
import { useAgentWebSocket } from '../hooks/useAgentWebSocket';

interface AgentStatus {
  agent?: {
    id: string;
    initialized: boolean;
    network: string;
  };
  hcs10?: {
    registered: boolean;
    registryTopicId: string;
    agentTopicId: string;
    capabilities: string[];
  };
  tokens?: {
    balances: Record<string, number>;
  };
  timestamp?: number;
}

/**
 * Component for triggering agent operations through the WebSocket connection
 */
export default function AgentOperationsPanel() {
  const { connected, sendMessage, getLatestMessageByType } = useAgentWebSocket();
  const [operationResult, setOperationResult] = useState<{ success: boolean; message: string } | null>(null);
  const [agentStatus, setAgentStatus] = useState<AgentStatus | null>(null);
  
  // Rebalance form state
  const [rebalanceWeights, setRebalanceWeights] = useState<{ [key: string]: number }>({
    BTC: 0.40,
    ETH: 0.30,
    SOL: 0.20,
    LYNX: 0.10
  });
  
  // Token operations form state
  const [tokenOperation, setTokenOperation] = useState<{
    operation: 'mint' | 'burn';
    token: string;
    amount: number;
  }>({
    operation: 'mint',
    token: 'LYNX',
    amount: 100
  });
  
  // Check for status updates whenever WebSocket messages change
  useEffect(() => {
    // Check for status messages
    const statusMessage = getLatestMessageByType('agent_status');
    if (statusMessage) {
      setAgentStatus(statusMessage.data);
    }
    
    // Also listen for status updates
    const statusUpdateMessage = getLatestMessageByType('agent_status_update');
    if (statusUpdateMessage) {
      setAgentStatus(statusUpdateMessage.data);
    }
  }, [getLatestMessageByType]);
  
  // Request agent status when connected
  useEffect(() => {
    if (connected) {
      handleRequestAgentStatus();
    }
  }, [connected]);
  
  /**
   * Handle submitting a rebalance proposal
   */
  const handleRebalanceSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate weights add up to 1.0
    const totalWeight = Object.values(rebalanceWeights).reduce((sum, weight) => sum + weight, 0);
    if (Math.abs(totalWeight - 1.0) > 0.001) {
      setOperationResult({
        success: false,
        message: `Weights must add up to 100% (current: ${(totalWeight * 100).toFixed(2)}%)`
      });
      return;
    }
    
    // Send rebalance proposal to the agent
    const success = sendMessage('rebalance_proposal', {
      weights: rebalanceWeights,
      timestamp: Date.now()
    });
    
    setOperationResult({
      success,
      message: success 
        ? 'Rebalance proposal submitted successfully' 
        : 'Failed to submit rebalance proposal - WebSocket disconnected'
    });
  };
  
  /**
   * Handle submitting a token operation
   */
  const handleTokenOperationSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate amount
    if (tokenOperation.amount <= 0) {
      setOperationResult({
        success: false,
        message: 'Amount must be greater than 0'
      });
      return;
    }
    
    // Send token operation to the agent
    const success = sendMessage('token_operation', {
      operation: tokenOperation.operation,
      token: tokenOperation.token,
      amount: tokenOperation.amount,
      timestamp: Date.now()
    });
    
    setOperationResult({
      success,
      message: success 
        ? `Token ${tokenOperation.operation} operation submitted successfully` 
        : 'Failed to submit token operation - WebSocket disconnected'
    });
  };
  
  /**
   * Handle requesting the agent status
   */
  const handleRequestAgentStatus = () => {
    const success = sendMessage('get_agent_status', {
      timestamp: Date.now()
    });
    
    setOperationResult({
      success,
      message: success 
        ? 'Agent status request sent successfully' 
        : 'Failed to request agent status - WebSocket disconnected'
    });
  };
  
  /**
   * Handle testing the agent connection
   */
  const handleTestConnection = () => {
    const success = sendMessage('ping', {
      timestamp: Date.now()
    });
    
    setOperationResult({
      success,
      message: success 
        ? 'Ping sent successfully' 
        : 'Failed to send ping - WebSocket disconnected'
    });
  };
  
  /**
   * Handle updating a token weight
   */
  const handleWeightChange = (token: string, value: string) => {
    const numValue = parseFloat(value);
    if (isNaN(numValue)) return;
    
    setRebalanceWeights(prev => ({
      ...prev,
      [token]: numValue
    }));
  };
  
  /**
   * Handle updating token operation fields
   */
  const handleTokenOpChange = (field: keyof typeof tokenOperation, value: any) => {
    setTokenOperation(prev => ({
      ...prev,
      [field]: field === 'amount' ? parseFloat(value) : value
    }));
  };
  
  // If not connected, show connection status
  if (!connected) {
    return (
      <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
        <h2 className="text-lg font-medium text-white mb-4">Agent Operations</h2>
        <div className="bg-red-900 text-red-200 p-4 rounded-md">
          <p>Not connected to agent WebSocket. Operations are unavailable.</p>
          <button 
            onClick={handleTestConnection}
            className="mt-2 px-4 py-2 bg-red-700 hover:bg-red-600 text-white rounded-md font-medium"
          >
            Attempt Connection
          </button>
        </div>
      </div>
    );
  }
  
  return (
    <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
      <h2 className="text-lg font-medium text-white mb-4">Agent Operations</h2>
      
      {/* Operation result message */}
      {operationResult && (
        <div className={`mb-4 p-3 rounded-md ${
          operationResult.success ? 'bg-green-900 text-green-200' : 'bg-red-900 text-red-200'
        }`}>
          <p>{operationResult.message}</p>
        </div>
      )}
      
      {/* Agent Status Panel */}
      <div className="mb-6">
        <h3 className="text-sm font-medium text-white mb-2 flex justify-between">
          Agent Status
          <span className="text-xs bg-blue-600 text-white px-2 py-1 rounded">
            {agentStatus?.agent?.initialized ? 'Running' : 'Initializing'}
          </span>
        </h3>
        
        {agentStatus ? (
          <div className="bg-gray-700 p-3 rounded-md text-sm">
            <div className="grid grid-cols-2 gap-2">
              <div className="text-gray-400">Agent ID:</div>
              <div className="text-white font-mono truncate">{agentStatus.agent?.id || 'Unknown'}</div>
              
              <div className="text-gray-400">Network:</div>
              <div className="text-white">{agentStatus.agent?.network || 'Unknown'}</div>
              
              <div className="text-gray-400">Registry:</div>
              <div className="text-white font-mono truncate">{agentStatus.hcs10?.registryTopicId || 'N/A'}</div>
              
              {agentStatus.tokens?.balances && (
                <>
                  <div className="text-gray-400">Token Balances:</div>
                  <div className="text-white">
                    {Object.entries(agentStatus.tokens.balances).map(([token, balance]) => (
                      <div key={token} className="flex justify-between">
                        <span>{token}:</span>
                        <span className="ml-2">{balance}</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
              
              <div className="text-gray-400">Last Update:</div>
              <div className="text-white">
                {agentStatus.timestamp 
                  ? new Date(agentStatus.timestamp).toLocaleTimeString() 
                  : 'Unknown'
                }
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-gray-700 p-3 rounded-md text-sm text-gray-400">
            No status information available
          </div>
        )}
      </div>
      
      {/* Quick Actions */}
      <div className="mb-6">
        <h3 className="text-sm font-medium text-white mb-2">Quick Actions</h3>
        <div className="flex space-x-2">
          <button 
            onClick={handleRequestAgentStatus}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md font-medium"
          >
            Request Status
          </button>
          <button 
            onClick={handleTestConnection}
            className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-md font-medium"
          >
            Test Connection
          </button>
        </div>
      </div>
      
      {/* Rebalance Controls */}
      <div className="mb-6">
        <h3 className="text-sm font-medium text-white mb-2">Rebalance Index</h3>
        <form onSubmit={handleRebalanceSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            {Object.entries(rebalanceWeights).map(([token, weight]) => (
              <div key={token} className="flex items-center">
                <label className="block text-sm font-medium text-gray-300 w-14">
                  {token}:
                </label>
                <input
                  type="number"
                  min="0"
                  max="1"
                  step="0.01"
                  value={weight}
                  onChange={(e) => handleWeightChange(token, e.target.value)}
                  className="mt-1 block w-full rounded-md bg-gray-700 border-gray-600 text-white focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                />
                <span className="ml-2 text-gray-300 text-sm w-14">
                  {(weight * 100).toFixed(0)}%
                </span>
              </div>
            ))}
          </div>
          
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-300">
              Total: {(Object.values(rebalanceWeights).reduce((sum, w) => sum + w, 0) * 100).toFixed(0)}%
            </div>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md font-medium"
            >
              Propose Rebalance
            </button>
          </div>
        </form>
      </div>
      
      {/* Token Operations */}
      <div>
        <h3 className="text-sm font-medium text-white mb-2">Token Operations</h3>
        <form onSubmit={handleTokenOperationSubmit} className="space-y-4">
          <div className="grid grid-cols-1 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300">
                Operation
              </label>
              <select
                value={tokenOperation.operation}
                onChange={(e) => handleTokenOpChange('operation', e.target.value)}
                className="mt-1 block w-full rounded-md bg-gray-700 border-gray-600 text-white focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
              >
                <option value="mint">Mint</option>
                <option value="burn">Burn</option>
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-300">
                Token
              </label>
              <select
                value={tokenOperation.token}
                onChange={(e) => handleTokenOpChange('token', e.target.value)}
                className="mt-1 block w-full rounded-md bg-gray-700 border-gray-600 text-white focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
              >
                <option value="BTC">BTC</option>
                <option value="ETH">ETH</option>
                <option value="SOL">SOL</option>
                <option value="LYNX">LYNX</option>
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-300">
                Amount
              </label>
              <input
                type="number"
                min="1"
                value={tokenOperation.amount}
                onChange={(e) => handleTokenOpChange('amount', e.target.value)}
                className="mt-1 block w-full rounded-md bg-gray-700 border-gray-600 text-white focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
              />
            </div>
          </div>
          
          <div className="flex justify-end">
            <button
              type="submit"
              className="px-4 py-2 bg-pink-600 hover:bg-pink-700 text-white rounded-md font-medium"
            >
              Execute Operation
            </button>
          </div>
        </form>
      </div>
    </div>
  );
} 