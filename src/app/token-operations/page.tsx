'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface TokenOperation {
  type: string;
  txId: string;
  timestamp: string;
  amount?: number;
  hashscanUrl: string;
}

interface Token {
  tokenId: string;
  name: string;
  symbol: string;
  transactionId: string;
  transactions?: TokenOperation[];
}

export default function TokenOperationsPage() {
  const [tokens, setTokens] = useState<Token[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  async function fetchTokenData() {
    try {
      setIsRefreshing(true);
      const response = await fetch('/api/token-operations');
      if (!response.ok) {
        throw new Error('Failed to fetch token data');
      }
      const data = await response.json();
      setTokens(data.tokens);
      setLastUpdated(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unknown error occurred');
      console.error('Error fetching token data:', err);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }

  useEffect(() => {
    fetchTokenData();
    
    // Set up an interval to refresh data every 10 seconds
    const interval = setInterval(fetchTokenData, 10000);
    
    // Clean up the interval on component unmount
    return () => clearInterval(interval);
  }, []);

  // Get all transactions from all tokens, sorted by timestamp (newest first)
  const allTransactions = tokens
    .flatMap(token => 
      (token.transactions || []).map(tx => ({
        ...tx,
        tokenName: token.name,
        tokenSymbol: token.symbol,
        tokenId: token.tokenId
      }))
    )
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-900 text-white p-8">
        <h1 className="text-3xl font-bold mb-6">Loading token operations...</h1>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-900 text-white p-8">
        <h1 className="text-3xl font-bold mb-6">Error Loading Token Operations</h1>
        <div className="bg-red-900 p-4 rounded-lg">
          <p>{error}</p>
        </div>
        <div className="mt-4">
          <Link href="/" className="text-blue-400 hover:underline">
            Return to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold">Lynxify Token Operations</h1>
          <div className="flex items-center gap-4">
            <button 
              onClick={fetchTokenData}
              disabled={isRefreshing}
              className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 disabled:opacity-70 text-white px-4 py-2 rounded-md flex items-center gap-2"
            >
              {isRefreshing ? (
                <>
                  <span className="animate-spin inline-block h-4 w-4 border-2 border-white border-t-transparent rounded-full"></span>
                  Refreshing...
                </>
              ) : (
                'Refresh Data'
              )}
            </button>
            <Link href="/" className="text-blue-400 hover:underline">
              Return to Dashboard
            </Link>
          </div>
        </div>
        
        <div className="bg-gray-800 p-6 rounded-lg shadow-lg mb-8">
          <h2 className="text-xl font-semibold mb-4">Token Summary</h2>
          <div className="overflow-x-auto">
            <table className="w-full table-auto">
              <thead>
                <tr className="bg-gray-700">
                  <th className="px-4 py-2 text-left">Token</th>
                  <th className="px-4 py-2 text-left">Symbol</th>
                  <th className="px-4 py-2 text-left">Token ID</th>
                  <th className="px-4 py-2 text-left">Transaction ID</th>
                  <th className="px-4 py-2 text-left">Actions</th>
                </tr>
              </thead>
              <tbody>
                {tokens.map((token) => (
                  <tr key={token.tokenId} className="border-t border-gray-700">
                    <td className="px-4 py-3">{token.name}</td>
                    <td className="px-4 py-3">{token.symbol}</td>
                    <td className="px-4 py-3">{token.tokenId}</td>
                    <td className="px-4 py-3 text-sm">{token.transactionId}</td>
                    <td className="px-4 py-3">
                      <a 
                        href={`https://hashscan.io/testnet/token/${token.tokenId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-400 hover:underline"
                      >
                        View on Hashscan
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        
        <div className="bg-gray-800 p-6 rounded-lg shadow-lg">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">All Token Operations</h2>
            {isRefreshing && (
              <div className="text-blue-400 flex items-center gap-2">
                <span className="animate-spin inline-block h-4 w-4 border-2 border-blue-400 border-t-transparent rounded-full"></span>
                Refreshing data...
              </div>
            )}
          </div>
          
          {allTransactions.length === 0 ? (
            <div className="text-center py-10 text-gray-400">
              <p>No token operations found. Operations will appear here when transactions occur.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full table-auto">
                <thead>
                  <tr className="bg-gray-700">
                    <th className="px-4 py-2 text-left">Timestamp</th>
                    <th className="px-4 py-2 text-left">Token</th>
                    <th className="px-4 py-2 text-left">Type</th>
                    <th className="px-4 py-2 text-left">Amount</th>
                    <th className="px-4 py-2 text-left">Transaction</th>
                  </tr>
                </thead>
                <tbody>
                  {allTransactions.map((tx, index) => (
                    <tr key={index} className="border-t border-gray-700 hover:bg-gray-750">
                      <td className="px-4 py-3">
                        {new Date(tx.timestamp).toLocaleString()}
                      </td>
                      <td className="px-4 py-3">
                        {tx.tokenSymbol} ({tx.tokenId})
                      </td>
                      <td className={`px-4 py-3 ${
                        tx.type === 'MINT' ? 'text-green-500' : 
                        tx.type === 'BURN' ? 'text-red-500' : 
                        'text-blue-500'
                      }`}>
                        {tx.type}
                      </td>
                      <td className="px-4 py-3">
                        {tx.amount !== undefined ? tx.amount : '-'}
                      </td>
                      <td className="px-4 py-3">
                        <a 
                          href={tx.hashscanUrl}
                          target="_blank"
                          rel="noopener noreferrer" 
                          className="text-blue-400 hover:underline"
                        >
                          View on Hashscan
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="mt-8 text-gray-400 text-sm">
          <p>
            Last updated: {lastUpdated ? lastUpdated.toLocaleString() : 'Never'} 
            {isRefreshing && ' (refreshing...)'}
          </p>
          <p className="mt-2">
            Note: This page shows only verifiable on-chain transactions. All transactions are 
            recorded on the Hedera Testnet and can be verified using Hashscan.
          </p>
          <p className="mt-2">
            Auto-refreshing every 10 seconds. New transactions will appear automatically.
          </p>
        </div>
      </div>
    </div>
  );
} 