import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Proposal } from '../types/hedera';
import { HCSMessage } from '../types/hcs';

// Fetch HCS messages
export const useHCSMessages = () => {
  return useQuery({
    queryKey: ['hcs-messages'],
    queryFn: async () => {
      console.log('📥 FETCH: Requesting HCS messages from API...');
      const response = await fetch('/api/hcs/messages');
      
      if (!response.ok) {
        console.error('❌ FETCH ERROR: Failed to fetch HCS messages:', response.statusText);
        throw new Error('Failed to fetch HCS messages');
      }
      
      const data = await response.json();
      
      // Ensure the response is an array
      if (!Array.isArray(data)) {
        console.error('❌ FETCH ERROR: Expected array response, got:', typeof data);
        return [];
      }
      
      // Validate each message has the expected structure
      const validMessages = data.filter(msg => {
        const isValid = msg && typeof msg === 'object' && msg.id && msg.type && msg.timestamp;
        if (!isValid) {
          console.error('❌ FETCH ERROR: Invalid message structure:', msg);
        }
        return isValid;
      });
      
      // Remove any duplicate messages by ID (just in case)
      const uniqueMessages = Array.from(
        new Map(validMessages.map(msg => [msg.id, msg])).values()
      );
      
      console.log(`✅ FETCH: Received ${uniqueMessages.length} valid unique HCS messages`);
      
      return uniqueMessages as HCSMessage[];
    },
    refetchInterval: 10000, // Reduce polling frequency to 10 seconds
    staleTime: 5000, // Consider data fresh for 5 seconds
  });
};

// Convert HCS messages to proposals
export const useProposals = () => {
  const { data: messages, isLoading, error } = useHCSMessages();

  // Track proposals and their statuses
  const proposalMap = new Map<string, Proposal>();
  
  if (messages) {
    // First pass: collect all RebalanceProposal messages
    messages.filter(msg => msg.type === 'RebalanceProposal').forEach(msg => {
      proposalMap.set(msg.id, {
        id: msg.id,
        type: 'RebalanceProposal',
        status: 'pending',
        timestamp: msg.timestamp,
        sender: msg.sender || 'Unknown',
        details: {
          newWeights: msg.details?.newWeights || {},
          trigger: msg.details?.trigger as 'price_deviation' | 'risk_threshold' | 'scheduled' | undefined,
          executedAt: undefined
        },
        votes: { for: 0, against: 0, total: 0 }
      });
    });
    
    // Second pass: update with RebalanceApproved messages
    messages.filter(msg => msg.type === 'RebalanceApproved').forEach(msg => {
      const proposalId = msg.details?.proposalId;
      if (proposalId && proposalMap.has(proposalId)) {
        const proposal = proposalMap.get(proposalId);
        if (proposal) {
          proposal.status = 'approved';
          if (msg.votes) {
            proposal.votes = msg.votes;
          }
        }
      }
    });
    
    // Third pass: update with RebalanceExecuted messages
    messages.filter(msg => msg.type === 'RebalanceExecuted').forEach(msg => {
      const proposalId = msg.details?.proposalId;
      if (proposalId && proposalMap.has(proposalId)) {
        const proposal = proposalMap.get(proposalId);
        if (proposal) {
          proposal.status = 'executed';
          proposal.details.executedAt = msg.details?.executedAt;
        }
      }
    });
  }
  
  // Convert map to array
  const proposals = Array.from(proposalMap.values());
  console.log(`✅ PROPOSALS: Processed ${proposals.length} proposals from ${messages?.length || 0} messages`);
  
  return {
    data: proposals,
    isLoading,
    error
  };
};

// Approve a rebalance proposal
export const useApproveProposal = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (proposalId: string) => {
      const response = await fetch('/api/hcs/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ proposalId }),
      });

      if (!response.ok) {
        throw new Error('Failed to approve proposal');
      }

      return proposalId;
    },
    onSuccess: () => {
      // Invalidate and refetch HCS messages
      queryClient.invalidateQueries({ queryKey: ['hcs-messages'] });
    },
  });
};

// Execute a rebalance
export const useExecuteRebalance = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ proposalId, newWeights }: { proposalId: string; newWeights: Record<string, number> }) => {
      const response = await fetch('/api/hcs/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ proposalId, newWeights, action: 'execute' }),
      });

      if (!response.ok) {
        throw new Error('Failed to execute rebalance');
      }

      return { proposalId, newWeights };
    },
    onSuccess: () => {
      // Invalidate and refetch HCS messages
      queryClient.invalidateQueries({ queryKey: ['hcs-messages'] });
    },
  });
};

// Propose a rebalance
export const useProposeRebalance = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ 
      newWeights, 
      executeAfter, 
      quorum,
      trigger, 
      justification 
    }: { 
      newWeights: Record<string, number>;
      executeAfter: number;
      quorum: number;
      trigger?: string;
      justification?: string;
    }) => {
      const response = await fetch('/api/hcs/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          action: 'propose',
          newWeights,
          executeAfter,
          quorum,
          trigger,
          justification
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to propose rebalance');
      }

      return { newWeights, executeAfter, quorum, trigger, justification };
    },
    onSuccess: () => {
      // Invalidate and refetch HCS messages
      queryClient.invalidateQueries({ queryKey: ['hcs-messages'] });
    },
  });
}; 