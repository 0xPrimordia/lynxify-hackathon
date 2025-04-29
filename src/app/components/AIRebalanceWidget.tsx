import React, { useState, useEffect } from 'react';

interface AIRebalanceWidgetProps {
  className?: string;
}

// Initial treasury state
const initialTreasury = {
  totalValue: 10000000, // $10M in the treasury
  holdings: {
    'HBAR': { amount: 20000000, value: 2400000, weight: 0.24 },
    'WBTC': { amount: 25, value: 1550000, weight: 0.155 },
    'WETH': { amount: 300, value: 1020000, weight: 0.102 },
    'USDC': { amount: 1850000, value: 1850000, weight: 0.185 },
    'USDT': { amount: 1200000, value: 1200000, weight: 0.12 },
    'DAI': { amount: 480000, value: 480000, weight: 0.048 },
    'SAUCE': { amount: 8500000, value: 680000, weight: 0.068 },
    'HBARX': { amount: 5400000, value: 810000, weight: 0.081 }
  }
};

// Token colors for visual display
const tokenColors: Record<string, string> = {
  'HBAR': 'bg-blue-500',
  'WBTC': 'bg-amber-500',
  'WETH': 'bg-purple-500',
  'USDC': 'bg-green-500',
  'USDT': 'bg-green-600',
  'DAI': 'bg-yellow-500',
  'SAUCE': 'bg-pink-500',
  'HBARX': 'bg-indigo-500'
};

// Token sectors for grouping
const tokenSectors: Record<string, string> = {
  'HBAR': 'Smart Contract Platforms',
  'WBTC': 'Smart Contract Platforms',
  'WETH': 'Smart Contract Platforms',
  'USDC': 'Stablecoins',
  'USDT': 'Stablecoins',
  'DAI': 'Stablecoins',
  'SAUCE': 'DeFi & DEX Tokens',
  'HBARX': 'DeFi & DEX Tokens'
};

interface TokenHolding {
  amount: number;
  value: number;
  weight: number;
}

interface Treasury {
  totalValue: number;
  holdings: Record<string, TokenHolding>;
}

interface ProposedAllocation {
  newWeights: Record<string, number>;
  analysis: string;
  timestamp: number;
}

export default function AIRebalanceWidget({ className = '' }: AIRebalanceWidgetProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [treasury, setTreasury] = useState<Treasury>(initialTreasury);
  const [proposedAllocation, setProposedAllocation] = useState<ProposedAllocation | null>(null);
  const [status, setStatus] = useState<{
    success?: boolean;
    message?: string;
    timestamp?: number;
    hcsPublished?: boolean;
  }>({});

  const triggerAIRebalance = async () => {
    try {
      setIsLoading(true);
      setStatus({ message: 'Requesting AI analysis via OpenAI...' });

      const response = await fetch('/api/agents/ai-rebalance', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ currentTreasury: treasury }),
      });

      const data = await response.json();
      
      if (data.success && data.proposal) {
        setProposedAllocation({
          newWeights: data.proposal.newWeights,
          analysis: data.proposal.analysis,
          timestamp: Date.now()
        });
      }
      
      setStatus({
        success: data.success,
        message: data.message,
        timestamp: Date.now(),
        hcsPublished: data.success // If successful, proposal was published to HCS
      });
    } catch (error) {
      setStatus({
        success: false,
        message: error instanceof Error ? error.message : 'An unknown error occurred',
        timestamp: Date.now(),
        hcsPublished: false
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Calculate sector allocations
  const calculateSectorAllocations = (holdings: Record<string, TokenHolding>) => {
    const sectors: Record<string, number> = {};
    
    Object.entries(holdings).forEach(([token, holding]) => {
      const sector = tokenSectors[token];
      if (!sectors[sector]) sectors[sector] = 0;
      sectors[sector] += holding.weight;
    });
    
    return sectors;
  };

  const currentSectors = calculateSectorAllocations(treasury.holdings);
  
  // Calculate new sectors if we have a proposal
  const proposedSectors = proposedAllocation 
    ? Object.entries(proposedAllocation.newWeights).reduce((acc, [token, weight]) => {
        const sector = tokenSectors[token];
        if (!acc[sector]) acc[sector] = 0;
        acc[sector] += weight;
        return acc;
      }, {} as Record<string, number>)
    : null;

  return (
    <div className={`bg-gray-800 shadow-md rounded-lg p-6 ${className}`}>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-medium text-white">AI Portfolio Manager</h2>
        <div className="flex items-center">
          <div className={`h-2 w-2 rounded-full mr-2 ${isLoading ? 'bg-yellow-400 animate-pulse' : status.success ? 'bg-green-500' : status.message ? 'bg-red-500' : 'bg-gray-400'}`}></div>
          <span className="text-xs text-gray-300">
            {isLoading ? 'Processing' : status.success ? 'Active' : 'Idle'}
          </span>
        </div>
      </div>

      <div className="mb-4">
        <p className="text-sm text-gray-300 mb-2">
          The AI Portfolio Manager uses OpenAI to analyze market conditions and optimize token allocation. Proposals are automatically published to Hedera Consensus Service (HCS).
        </p>
        
        {status.message && (
          <div className={`text-sm p-3 rounded ${status.success ? 'bg-green-900 bg-opacity-40 text-green-300' : 'bg-red-900 bg-opacity-40 text-red-300'} mt-2`}>
            {status.message}
            {status.timestamp && (
              <div className="text-xs mt-1 opacity-75">
                {new Date(status.timestamp).toLocaleTimeString()}
              </div>
            )}
            {status.hcsPublished && (
              <div className="flex items-center mt-1 text-xs font-medium text-green-300">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mr-1" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                </svg>
                Published to Hedera Consensus Service
              </div>
            )}
          </div>
        )}
      </div>
      
      {/* Current Treasury Allocation */}
      <div className="mb-6">
        <h3 className="text-sm font-medium text-gray-200 mb-2">Current Treasury Allocation</h3>
        <div className="h-6 w-full flex rounded-full overflow-hidden mb-2">
          {Object.entries(treasury.holdings)
            .sort((a, b) => b[1].weight - a[1].weight)
            .map(([token, holding]) => (
              <div 
                key={token} 
                className={`${tokenColors[token]} h-full`} 
                style={{ width: `${holding.weight * 100}%` }}
                title={`${token}: ${(holding.weight * 100).toFixed(1)}%`}
              />
            ))
          }
        </div>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1">
          {Object.entries(treasury.holdings)
            .sort((a, b) => b[1].weight - a[1].weight)
            .map(([token, holding]) => (
              <div key={token} className="flex items-center justify-between text-xs">
                <div className="flex items-center">
                  <div className={`w-2 h-2 rounded-full ${tokenColors[token]} mr-1`}></div>
                  <span>{token}</span>
                </div>
                <span>{(holding.weight * 100).toFixed(1)}%</span>
              </div>
            ))
          }
        </div>
        
        {/* Sector Allocation */}
        <div className="mt-3">
          <h4 className="text-xs font-medium text-gray-300 mb-1">Sector Allocation:</h4>
          <div className="grid grid-cols-1 gap-y-1">
            {Object.entries(currentSectors).map(([sector, weight]) => (
              <div key={sector} className="flex items-center justify-between text-xs">
                <span className="text-gray-300">{sector}</span>
                <span className="font-medium text-white">{(weight * 100).toFixed(1)}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>
      
      {/* Proposed Changes (if available) */}
      {proposedAllocation && (
        <div className="border-t border-gray-700 pt-4 mb-4">
          <h3 className="text-sm font-medium text-gray-200 mb-2">AI Proposed Changes</h3>
          
          {/* Visual representation of proposed changes */}
          <div className="h-6 w-full flex rounded-full overflow-hidden mb-2">
            {Object.entries(proposedAllocation.newWeights)
              .sort((a, b) => b[1] - a[1])
              .map(([token, weight]) => (
                <div 
                  key={token} 
                  className={`${tokenColors[token]} h-full`} 
                  style={{ width: `${weight * 100}%` }}
                  title={`${token}: ${(weight * 100).toFixed(1)}%`}
                />
              ))
            }
          </div>
          
          {/* Detailed changes */}
          <div className="grid grid-cols-2 gap-x-4 gap-y-1">
            {Object.entries(proposedAllocation.newWeights)
              .sort((a, b) => b[1] - a[1])
              .map(([token, weight]) => {
                const currentWeight = treasury.holdings[token]?.weight || 0;
                const change = weight - currentWeight;
                const changeText = change > 0 
                  ? `+${(change * 100).toFixed(1)}%` 
                  : `${(change * 100).toFixed(1)}%`;
                const changeClass = change > 0 
                  ? 'text-green-600' 
                  : change < 0 
                    ? 'text-red-600' 
                    : 'text-gray-500';
                
                return (
                  <div key={token} className="flex items-center justify-between text-xs">
                    <div className="flex items-center">
                      <div className={`w-2 h-2 rounded-full ${tokenColors[token]} mr-1`}></div>
                      <span>{token}</span>
                    </div>
                    <div className="flex items-center">
                      <span>{(weight * 100).toFixed(1)}%</span>
                      <span className={`ml-1 ${changeClass}`}>({changeText})</span>
                    </div>
                  </div>
                );
              })
            }
          </div>
          
          {/* Sector Changes */}
          {proposedSectors && (
            <div className="mt-3">
              <h4 className="text-xs font-medium text-gray-300 mb-1">New Sector Allocation:</h4>
              <div className="grid grid-cols-1 gap-y-1">
                {Object.entries(proposedSectors).map(([sector, weight]) => {
                  const currentSectorWeight = currentSectors[sector] || 0;
                  const change = weight - currentSectorWeight;
                  const changeText = change > 0 
                    ? `+${(change * 100).toFixed(1)}%` 
                    : `${(change * 100).toFixed(1)}%`;
                  const changeClass = change > 0 
                    ? 'text-green-400' 
                    : change < 0 
                      ? 'text-red-400' 
                      : 'text-gray-400';
                  
                  return (
                    <div key={sector} className="flex items-center justify-between text-xs">
                      <span className="text-gray-300">{sector}</span>
                      <div className="flex items-center">
                        <span className="font-medium text-white">{(weight * 100).toFixed(1)}%</span>
                        <span className={`ml-1 ${changeClass}`}>({changeText})</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          
          {/* AI Analysis */}
          <div className="mt-3 p-3 bg-indigo-900 bg-opacity-30 border border-indigo-700 rounded-md">
            <h4 className="text-xs font-medium text-indigo-300 mb-1">AI Analysis:</h4>
            <p className="text-xs text-indigo-200 italic">{proposedAllocation.analysis}</p>
          </div>
        </div>
      )}

      <div className="flex justify-between items-center">
        <div className="text-xs text-gray-400">
          <div>Last analysis: {status.timestamp ? new Date(status.timestamp).toLocaleString() : 'Never'}</div>
          {proposedAllocation && (
            <div className="mt-1 text-xs text-indigo-400">
              Check the HCS Message Feed for the proposal record
            </div>
          )}
        </div>
        
        <button
          onClick={triggerAIRebalance}
          disabled={isLoading}
          className={`inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white 
            ${isLoading ? 'bg-indigo-300 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700'} 
            focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500`}
        >
          {isLoading ? (
            <>
              <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Analyzing with OpenAI...
            </>
          ) : (
            'Start Rebalance Agent'
          )}
        </button>
      </div>
    </div>
  );
} 