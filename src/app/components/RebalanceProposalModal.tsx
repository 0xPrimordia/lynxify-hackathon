'use client';

import React, { useState, useEffect } from 'react';
import { useProposeRebalance } from '../services/api';
import { sectors } from '../data/tokens';

interface RebalanceProposalModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type TokenWeights = Record<string, number>;
type SectorWeights = Record<string, number>;
type TriggerType = 'manual' | 'price_deviation' | 'risk_threshold' | 'scheduled';
type ExecutionTimeframe = 'immediate' | '24h' | '48h' | '72h' | 'next_consensus';

// This interface matches the expected API payload format
interface ApiProposalPayload {
  newWeights: Record<string, number>;
  executeAfter: number;
  quorum: number;
  trigger?: string;
  justification?: string;
}

// Define the shape of the sectors data
interface Token {
  symbol: string;
  name?: string;
  // Add other token properties as needed
}

interface Sector {
  tokens: Token[];
  // Add other sector properties as needed
}

export default function RebalanceProposalModal({ isOpen, onClose }: RebalanceProposalModalProps) {
  const [weights, setWeights] = useState<TokenWeights>({});
  const [triggerType, setTriggerType] = useState<TriggerType>('manual');
  const [quorum, setQuorum] = useState<number>(51);
  const [sectorWeights, setSectorWeights] = useState<SectorWeights>({});
  const [executionTimeframe, setExecutionTimeframe] = useState<ExecutionTimeframe>('24h');
  const [justification, setJustification] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [showAdvanced, setShowAdvanced] = useState<boolean>(false);
  
  const { mutate: proposeRebalance, isPending, isError, error: apiError } = useProposeRebalance();

  const calculateExecutionTime = (timeframe: ExecutionTimeframe): number => {
    const now = new Date();
    
    switch (timeframe) {
      case 'immediate':
        return now.getTime();
      case '24h':
        now.setHours(now.getHours() + 24);
        return now.getTime();
      case '48h':
        now.setHours(now.getHours() + 48);
        return now.getTime();
      case '72h':
        now.setHours(now.getHours() + 72);
        return now.getTime();
      case 'next_consensus':
        // Assume next consensus is the nearest upcoming Monday
        const daysUntilMonday = (1 + 7 - now.getDay()) % 7;
        now.setDate(now.getDate() + daysUntilMonday);
        now.setHours(10, 0, 0, 0); // 10am on Monday
        return now.getTime();
      default:
        return now.getTime();
    }
  };

  const getTokensFromSectors = (): string[] => {
    const tokens: string[] = [];
    Object.keys(sectors as Record<string, Sector>).forEach((sectorKey: string) => {
      const sector = (sectors as Record<string, Sector>)[sectorKey];
      sector.tokens.forEach((token: Token) => {
        if (!tokens.includes(token.symbol)) {
          tokens.push(token.symbol);
        }
      });
    });
    return tokens;
  };

  useEffect(() => {
    // Initialize sector weights based on sector data
    const initialSectorWeights: SectorWeights = {};
    Object.keys(sectors as Record<string, Sector>).forEach((sectorKey: string) => {
      initialSectorWeights[sectorKey] = 0;
    });
    setSectorWeights(initialSectorWeights);
    
    // Initialize token weights based on all available tokens
    const initialWeights: TokenWeights = {};
    getTokensFromSectors().forEach((token: string) => {
      initialWeights[token] = 0;
    });
    setWeights(initialWeights);
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    
    // Check if weights add up to 100%
    const totalWeight = Object.values(weights).reduce((sum, weight) => sum + weight, 0);
    
    if (Math.abs(totalWeight - 1) > 0.01) { // Allow for small rounding errors
      setError(`Total allocation should be 100%. Current total: ${(totalWeight * 100).toFixed(2)}%`);
      return;
    }
    
    const executeAfter = calculateExecutionTime(executionTimeframe);
    
    try {
      const payload: ApiProposalPayload = {
        newWeights: weights,
        executeAfter,
        quorum: quorum / 100, // Convert to decimal
        trigger: triggerType,
        justification
      };

      proposeRebalance(payload);
      
      if (!isPending && !isError) {
        onClose();
      }
    } catch (err) {
      console.error('Error submitting proposal:', err);
      setError('Failed to submit proposal. Please try again.');
    }
  };
  
  if (!isOpen) return null;
  
  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50">
      <div className="bg-gray-900 rounded-lg shadow-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold text-white">Propose Portfolio Rebalance</h2>
            <button 
              onClick={onClose}
              className="text-gray-300 hover:text-white"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          
          <form onSubmit={handleSubmit}>
            <div className="mb-6">
              <h3 className="text-lg font-medium text-white mb-3">Token Allocation</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {Object.keys(weights).map(token => (
                  <div key={token} className="flex flex-col">
                    <label htmlFor={`token-${token}`} className="block text-sm font-medium text-gray-300 mb-2">
                      {token}
                    </label>
                    <div className="relative rounded-md shadow-sm">
                      <input
                        type="number"
                        id={`token-${token}`}
                        name={`token-${token}`}
                        min="0"
                        max="100"
                        step="0.1"
                        value={weights[token] * 100}
                        onChange={(e) => {
                          const newWeights = { ...weights };
                          newWeights[token] = parseFloat(e.target.value) / 100;
                          setWeights(newWeights);
                        }}
                        className="bg-gray-800 text-gray-100 rounded-md border border-gray-700 focus:border-indigo-500 focus:ring focus:ring-indigo-500 focus:ring-opacity-50 block w-full py-2 px-3 placeholder-gray-500"
                      />
                      <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                        <span className="text-gray-400">%</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              
              <div className="mt-4 bg-gray-800 rounded-md p-3 flex justify-between items-center">
                <span className="text-sm font-medium text-white">Total Allocation:</span>
                <span className={`font-semibold ${
                  Math.abs(Object.values(weights).reduce((sum, w) => sum + w, 0) - 1) < 0.01 
                    ? 'text-green-400' 
                    : 'text-red-400'
                }`}>
                  {(Object.values(weights).reduce((sum, weight) => sum + weight, 0) * 100).toFixed(2)}%
                </span>
              </div>
            </div>
            
            <div className="mb-6">
              <h3 className="text-lg font-medium text-white mb-3">Execution Timeframe</h3>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                {(['immediate', '24h', '48h', '72h', 'next_consensus'] as ExecutionTimeframe[]).map((timeframe) => (
                  <div key={timeframe} className="flex items-center">
                    <input
                      type="radio"
                      id={`timeframe-${timeframe}`}
                      name="timeframe"
                      value={timeframe}
                      checked={executionTimeframe === timeframe}
                      onChange={() => setExecutionTimeframe(timeframe)}
                      className="h-4 w-4 text-indigo-600 border-gray-700 focus:ring-indigo-500 focus:ring-opacity-50 bg-gray-800"
                    />
                    <label htmlFor={`timeframe-${timeframe}`} className="ml-2 block text-sm text-gray-300">
                      {timeframe === 'immediate' ? 'Immediate' :
                       timeframe === 'next_consensus' ? 'Next Consensus' :
                       timeframe}
                    </label>
                  </div>
                ))}
              </div>
              <p className="text-sm text-gray-400 mt-2">
                Estimated execution: {new Date(calculateExecutionTime(executionTimeframe)).toLocaleString()}
              </p>
            </div>
            
            <div className="mb-6">
              <label htmlFor="justification" className="block text-lg font-medium text-white mb-3">
                Justification
              </label>
              <textarea
                id="justification"
                name="justification"
                rows={4}
                value={justification}
                onChange={(e) => setJustification(e.target.value)}
                placeholder="Explain the rationale for this rebalance proposal..."
                className="bg-gray-800 text-gray-100 rounded-md border border-gray-700 focus:border-indigo-500 focus:ring focus:ring-indigo-500 focus:ring-opacity-50 block w-full py-2 px-3 placeholder-gray-500"
                required
              />
            </div>
            
            <div className="mb-6">
              <button
                type="button"
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="flex items-center text-gray-300 hover:text-gray-100"
              >
                <svg 
                  className={`w-4 h-4 mr-2 transition-transform ${showAdvanced ? 'rotate-90' : ''}`} 
                  fill="none" 
                  stroke="currentColor" 
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                </svg>
                Advanced Options
              </button>
              
              {showAdvanced && (
                <div className="mt-4 space-y-4 bg-gray-800 p-4 rounded-md">
                  <div>
                    <label htmlFor="trigger-type" className="block text-sm font-medium text-gray-300 mb-2">
                      Trigger Type
                    </label>
                    <select
                      id="trigger-type"
                      name="trigger-type"
                      value={triggerType}
                      onChange={(e) => setTriggerType(e.target.value as TriggerType)}
                      className="bg-gray-700 text-gray-100 rounded-md border border-gray-600 focus:border-indigo-500 focus:ring focus:ring-indigo-500 focus:ring-opacity-50 block w-full py-2 px-3"
                    >
                      <option value="manual">Manual</option>
                      <option value="price_deviation">Price Deviation</option>
                      <option value="risk_threshold">Risk Threshold</option>
                      <option value="scheduled">Scheduled</option>
                    </select>
                  </div>
                  
                  <div>
                    <label htmlFor="quorum" className="block text-sm font-medium text-gray-300 mb-2">
                      Required Quorum (%)
                    </label>
                    <input
                      type="range"
                      id="quorum"
                      name="quorum"
                      min="1"
                      max="100"
                      value={quorum}
                      onChange={(e) => setQuorum(parseInt(e.target.value))}
                      className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                    />
                    <div className="flex justify-between text-xs text-gray-400 mt-1">
                      <span>1%</span>
                      <span>{quorum}%</span>
                      <span>100%</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
            
            {(error || isError) && (
              <div className="mb-4 p-3 bg-red-900 bg-opacity-50 text-red-200 rounded-md">
                {error || (apiError instanceof Error ? apiError.message : 'An error occurred')}
              </div>
            )}
            
            <div className="flex justify-end space-x-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 focus:ring-offset-gray-900"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isPending}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-gray-900 disabled:opacity-70 disabled:cursor-not-allowed"
              >
                {isPending ? 'Submitting...' : 'Submit Proposal'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}