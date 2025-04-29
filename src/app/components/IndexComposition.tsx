'use client';

import { useState, useEffect } from 'react';

interface TokenWeight {
  tokenId: string;
  symbol: string;
  weight: number;
  price: number;
}

interface IndexCompositionResponse {
  tokens: TokenWeight[];
  lastUpdated: number;
}

export default function IndexComposition() {
  const [tokens, setTokens] = useState<TokenWeight[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchTokenWeights = async () => {
      try {
        setIsLoading(true);
        const response = await fetch('/api/index/composition');
        const data: IndexCompositionResponse = await response.json();
        setTokens(data.tokens);
        setIsLoading(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch token weights');
        setIsLoading(false);
      }
    };

    fetchTokenWeights();
    // Set up polling for updates
    const interval = setInterval(fetchTokenWeights, 30000); // Update every 30 seconds
    return () => clearInterval(interval);
  }, []);

  if (isLoading) {
    return (
      <div className="bg-white shadow rounded-lg p-6">
        <h2 className="text-lg font-medium text-gray-900 mb-4">Index Composition</h2>
        <div className="animate-pulse space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-4 bg-gray-200 rounded w-3/4"></div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white shadow rounded-lg p-6">
        <h2 className="text-lg font-medium text-gray-900 mb-4">Index Composition</h2>
        <div className="text-red-600">{error}</div>
      </div>
    );
  }

  return (
    <div className="bg-white shadow rounded-lg p-6">
      <h2 className="text-lg font-medium text-gray-900 mb-4">Index Composition</h2>
      <div className="space-y-4">
        {tokens.map((token, index) => (
          <div key={`${token.tokenId}-${index}`} className="flex items-center justify-between">
            <div className="flex items-center">
              <span className="text-sm font-medium text-gray-900">{token.symbol}</span>
              <span className="ml-2 text-sm text-gray-500">({token.tokenId})</span>
            </div>
            <div className="flex items-center">
              <span className="text-sm text-gray-900">{token.weight.toFixed(2)}%</span>
              <span className="ml-2 text-sm text-gray-500">${token.price.toFixed(2)}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
} 