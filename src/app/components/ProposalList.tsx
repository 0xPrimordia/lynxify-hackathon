'use client';

import React, { useState } from 'react';
import { Proposal } from '../types/hedera';
import { useProposals, useApproveProposal } from '../services/api';
import LoadingSkeleton from './LoadingSkeleton';
import RebalanceProposalModal from './RebalanceProposalModal';

interface ProposalListProps {
  onSelectProposal: (id: string) => void;
}

export default function ProposalList({ onSelectProposal }: ProposalListProps) {
  const { data: proposals, isLoading, error } = useProposals();
  const approveProposal = useApproveProposal();
  const [isModalOpen, setIsModalOpen] = useState(false);

  const getProposalTypeIcon = (type: string) => {
    switch (type) {
      case 'RebalanceProposal':
        return '⚖️';
      case 'RiskAlert':
        return '⚠️';
      case 'PolicyChange':
        return '📋';
      default:
        return '📝';
    }
  };

  const getProposalTypeColor = (type: string) => {
    switch (type) {
      case 'RebalanceProposal':
        return 'bg-blue-800 text-blue-200';
      case 'RiskAlert':
        return 'bg-red-800 text-red-200';
      case 'PolicyChange':
        return 'bg-purple-800 text-purple-200';
      default:
        return 'bg-gray-700 text-gray-200';
    }
  };

  const getStatusColor = (status: 'pending' | 'approved' | 'executed' | 'rejected') => {
    switch (status) {
      case 'pending':
        return 'bg-yellow-800 text-yellow-200';
      case 'approved':
        return 'bg-green-800 text-green-200';
      case 'executed':
        return 'bg-blue-800 text-blue-200';
      case 'rejected':
        return 'bg-red-800 text-red-200';
      default:
        return 'bg-gray-700 text-gray-200';
    }
  };

  const getRebalanceReason = (proposal: Proposal) => {
    if (proposal.type === 'RebalanceProposal') {
      if (proposal.details.trigger === 'price_deviation') {
        return `Price deviation of ${proposal.details.deviation}% detected`;
      } else if (proposal.details.trigger === 'risk_threshold') {
        return `Risk threshold exceeded: ${proposal.details.riskLevel}`;
      } else if (proposal.details.trigger === 'scheduled') {
        return 'Scheduled quarterly rebalance';
      }
    }
    return 'Rebalance proposal';
  };

  if (isLoading) {
    return (
      <div>
        <LoadingSkeleton type="card" count={2} />
      </div>
    );
  }

  if (error) {
    return (
      <div>
        <div className="text-red-400">{error instanceof Error ? error.message : 'Failed to load proposals'}</div>
      </div>
    );
  }

  if (!proposals?.length) {
    return (
      <div>
        <div className="flex justify-between items-center mb-4">
          <button
            onClick={() => setIsModalOpen(true)}
            className="px-4 py-2 rounded-md text-white bg-indigo-600 hover:bg-indigo-700 shadow-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-gray-800 transition-colors"
          >
            <span className="flex items-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Propose Rebalance
            </span>
          </button>
        </div>
        <div className="text-gray-300 text-center py-4">No active proposals</div>
        <RebalanceProposalModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <button
          onClick={() => setIsModalOpen(true)}
          className="px-4 py-2 rounded-md text-white bg-indigo-600 hover:bg-indigo-700 shadow-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-gray-800 transition-colors"
        >
          <span className="flex items-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Propose Rebalance
          </span>
        </button>
      </div>
      <div className="space-y-4">
        {proposals.map((proposal) => (
          <div
            key={proposal.id}
            className="border border-gray-700 rounded-lg p-4 cursor-pointer hover:bg-gray-800 transition-colors"
            onClick={() => onSelectProposal(proposal.id)}
          >
            <div className="flex items-start space-x-3">
              <div className="flex-shrink-0">
                <span className="text-2xl">{getProposalTypeIcon(proposal.type)}</span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-medium text-white">
                      {proposal.type === 'RebalanceProposal' ? 'Rebalance Proposal' : 
                       proposal.type === 'RiskAlert' ? 'Risk Alert' : 
                       'Policy Change'}
                    </h3>
                    <p className="text-xs text-gray-300">
                      Proposed by {proposal.sender} • {new Date(proposal.timestamp).toLocaleString()}
                    </p>
                  </div>
                  <span className={`px-2 py-1 text-xs rounded-full ${getStatusColor(proposal.status)}`}>
                    {proposal.status.charAt(0).toUpperCase() + proposal.status.slice(1)}
                  </span>
                </div>
                
                {proposal.type === 'RebalanceProposal' && (
                  <div className="mt-2 space-y-2">
                    <div className="bg-gray-700 p-3 rounded">
                      <p className="text-xs font-medium text-gray-200">
                        {getRebalanceReason(proposal)}
                      </p>
                      <p className="text-xs text-gray-300 mt-1">
                        {proposal.details.impact}
                      </p>
                    </div>
                    
                    {proposal.details.newWeights && (
                      <div>
                        <p className="text-xs font-medium text-gray-200">Proposed Changes:</p>
                        <div className="mt-1 grid grid-cols-2 gap-2">
                          {Object.entries(proposal.details.newWeights).map(([token, weight]) => (
                            <div key={token} className="text-xs text-gray-300">
                              {token}: {(Number(weight) * 100).toFixed(2)}%
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {proposal.type === 'RiskAlert' && (
                  <div className="mt-2">
                    <div className="bg-red-900 bg-opacity-50 p-3 rounded">
                      <p className="text-xs font-medium text-red-200">Risk Alert</p>
                      <p className="text-xs text-red-300 mt-1">
                        {proposal.details.impact}
                      </p>
                    </div>
                  </div>
                )}

                <div className="mt-3 pt-3 border-t border-gray-700">
                  <div className="flex justify-between text-xs text-gray-300">
                    <span>For: {proposal.votes.for}</span>
                    <span>Against: {proposal.votes.against}</span>
                    <span>Total: {proposal.votes.total}</span>
                  </div>
                  <div className="mt-1 h-2 bg-gray-700 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-indigo-500"
                      style={{ width: `${(proposal.votes.for / proposal.votes.total) * 100}%` }}
                    ></div>
                  </div>
                </div>

                {proposal.status === 'pending' && (
                  <div className="mt-3 flex justify-end">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        approveProposal.mutate(proposal.id);
                      }}
                      disabled={approveProposal.isPending}
                      className={`px-3 py-1 text-xs rounded transition-colors ${
                        approveProposal.isPending
                          ? 'bg-gray-700 text-gray-400 cursor-not-allowed'
                          : 'bg-green-800 text-green-200 hover:bg-green-700'
                      }`}
                    >
                      {approveProposal.isPending ? 'Approving...' : 'Approve Proposal'}
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
      <RebalanceProposalModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
    </div>
  );
} 