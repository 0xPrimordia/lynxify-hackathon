'use client';

import { useState } from 'react';

interface VotingInterfaceProps {
  proposalId: string;
  onVote: (proposalId: string, vote: 'for' | 'against') => Promise<void>;
}

export default function VotingInterface({ proposalId, onVote }: VotingInterfaceProps) {
  const [isVoting, setIsVoting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleVote = async (vote: 'for' | 'against') => {
    try {
      setIsVoting(true);
      setError(null);
      await onVote(proposalId, vote);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit vote');
    } finally {
      setIsVoting(false);
    }
  };

  return (
    <div className="bg-white shadow rounded-lg p-6">
      <h2 className="text-lg font-medium text-gray-900 mb-4">Vote on Proposal</h2>
      
      {error && (
        <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
          {error}
        </div>
      )}

      <div className="flex space-x-4">
        <button
          onClick={() => handleVote('for')}
          disabled={isVoting}
          className={`flex-1 py-2 px-4 rounded-md text-white font-medium ${
            isVoting
              ? 'bg-green-300 cursor-not-allowed'
              : 'bg-green-600 hover:bg-green-700'
          }`}
        >
          {isVoting ? 'Voting...' : 'Vote For'}
        </button>

        <button
          onClick={() => handleVote('against')}
          disabled={isVoting}
          className={`flex-1 py-2 px-4 rounded-md text-white font-medium ${
            isVoting
              ? 'bg-red-300 cursor-not-allowed'
              : 'bg-red-600 hover:bg-red-700'
          }`}
        >
          {isVoting ? 'Voting...' : 'Vote Against'}
        </button>
      </div>

      <p className="mt-4 text-sm text-gray-500">
        Your vote will be recorded on the Hedera network and cannot be changed.
      </p>
    </div>
  );
} 