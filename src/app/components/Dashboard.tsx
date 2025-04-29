'use client';

import { useState, Suspense } from 'react';
import ProposalList from './ProposalList';
import VotingInterface from './VotingInterface';
import AgentStatus from './AgentStatus';
import HCSMessageFeed from './HCSMessageFeed';
import LoadingSkeleton from './LoadingSkeleton';
import AIRebalanceWidget from './AIRebalanceWidget';
import Link from 'next/link';

export default function Dashboard() {
  const [selectedProposal, setSelectedProposal] = useState<string | null>(null);

  const handleVote = async (proposalId: string, vote: 'for' | 'against') => {
    try {
      const response = await fetch('/api/governance/vote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ proposalId, vote }),
      });

      if (!response.ok) {
        throw new Error('Failed to submit vote');
      }

      // Refresh proposals after voting
      const proposalsResponse = await fetch('/api/governance/proposals');
      if (!proposalsResponse.ok) {
        throw new Error('Failed to refresh proposals');
      }
    } catch (err) {
      console.error('Error voting:', err);
      throw err;
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <header className="bg-gray-800 shadow-md">
        <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center">
            <h1 className="text-3xl font-bold text-white">Lynxify Index DAO</h1>
            <div className="flex items-center space-x-4">
              <div className="text-sm text-gray-300">
                Total Value Locked: $1,234,567
              </div>
              <div className="text-sm text-gray-300">
                Active Members: 42
              </div>
              <Link href="/token-operations" className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md font-medium">
                Token Operations
              </Link>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="grid grid-cols-12 gap-6">
          {/* Left Column - Agent Activity, AI Portfolio Manager & Proposals */}
          <div className="col-span-8 space-y-6">
            {/* Agent Activity moved to top of left column */}
            <div className="bg-gray-800 shadow-md rounded-lg p-6">
              <h2 className="text-lg font-medium text-white mb-4">Agent Activity</h2>
              <AgentStatus />
            </div>
            
            {/* AI Portfolio Manager */}
            <AIRebalanceWidget className="w-full bg-gray-800 shadow-md rounded-lg" />
            
            {/* Proposals List */}
            <div className="bg-gray-800 shadow-md rounded-lg p-6">
              <h2 className="text-lg font-medium text-white mb-4">Governance Proposals</h2>
              <ProposalList onSelectProposal={setSelectedProposal} />
            </div>
          </div>

          {/* Right Column - HCS Feed */}
          <div className="col-span-4 space-y-6">
            <div className="bg-gray-800 shadow-md rounded-lg p-6">
              <h2 className="text-lg font-medium text-white mb-4">HCS Message Feed</h2>
              <HCSMessageFeed />
            </div>
          </div>
        </div>

        {/* Bottom Section - Voting Interface */}
        {selectedProposal && (
          <div className="mt-6">
            <div className="bg-gray-800 shadow-md rounded-lg p-6">
              <VotingInterface
                proposalId={selectedProposal}
                onVote={handleVote}
              />
            </div>
          </div>
        )}
      </main>
    </div>
  );
} 