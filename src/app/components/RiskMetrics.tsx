'use client';

import { useState, useEffect } from 'react';

interface RiskMetrics {
  volatility: number;
  priceChange: number;
  riskLevel: 'low' | 'medium' | 'high';
  affectedTokens: string[];
  timestamp: number;
}

export default function RiskMetrics() {
  const [metrics, setMetrics] = useState<RiskMetrics | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchRiskMetrics = async () => {
      try {
        setIsLoading(true);
        const response = await fetch('/api/risk/metrics');
        const data = await response.json();
        setMetrics(data);
        setIsLoading(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch risk metrics');
        setIsLoading(false);
      }
    };

    fetchRiskMetrics();
    // Set up polling for updates
    const interval = setInterval(fetchRiskMetrics, 30000); // Update every 30 seconds
    return () => clearInterval(interval);
  }, []);

  if (isLoading) {
    return (
      <div className="bg-white shadow rounded-lg p-6">
        <h2 className="text-lg font-medium text-gray-900 mb-4">Risk Metrics</h2>
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
        <h2 className="text-lg font-medium text-gray-900 mb-4">Risk Metrics</h2>
        <div className="text-red-600">{error}</div>
      </div>
    );
  }

  if (!metrics) {
    return (
      <div className="bg-white shadow rounded-lg p-6">
        <h2 className="text-lg font-medium text-gray-900 mb-4">Risk Metrics</h2>
        <div className="text-gray-500">No risk metrics available</div>
      </div>
    );
  }

  const getRiskLevelColor = (level: string) => {
    switch (level) {
      case 'low':
        return 'bg-green-100 text-green-800';
      case 'medium':
        return 'bg-yellow-100 text-yellow-800';
      case 'high':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const formatRiskLevel = (level: string) => {
    return level.charAt(0).toUpperCase() + level.slice(1);
  };

  return (
    <div className="bg-white shadow rounded-lg p-6">
      <h2 className="text-lg font-medium text-gray-900 mb-4">Risk Metrics</h2>
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <span className="text-sm text-gray-600">Risk Level</span>
          <span className={`px-2 py-1 text-xs rounded-full ${getRiskLevelColor(metrics.riskLevel)}`}>
            {formatRiskLevel(metrics.riskLevel)}
          </span>
        </div>

        <div className="flex justify-between items-center">
          <span className="text-sm text-gray-600">Volatility</span>
          <span className="text-sm font-medium text-gray-900">
            {(metrics.volatility * 100).toFixed(2)}%
          </span>
        </div>

        <div className="flex justify-between items-center">
          <span className="text-sm text-gray-600">Price Change (24h)</span>
          <span className={`text-sm font-medium ${
            metrics.priceChange >= 0 ? 'text-green-600' : 'text-red-600'
          }`}>
            {metrics.priceChange >= 0 ? '+' : ''}{metrics.priceChange.toFixed(2)}%
          </span>
        </div>

        {metrics.affectedTokens.length > 0 && (
          <div>
            <span className="text-sm text-gray-600">Affected Tokens</span>
            <div className="mt-1 flex flex-wrap gap-2">
              {metrics.affectedTokens.map((tokenId) => (
                <span
                  key={tokenId}
                  className="px-2 py-1 text-xs bg-gray-100 text-gray-800 rounded-full"
                >
                  {tokenId}
                </span>
              ))}
            </div>
          </div>
        )}

        <div className="text-xs text-gray-500 mt-4">
          Last updated: {new Date(metrics.timestamp).toLocaleString()}
        </div>
      </div>
    </div>
  );
} 