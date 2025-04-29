"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.useProposeRebalance = exports.useExecuteRebalance = exports.useApproveProposal = exports.useProposals = exports.useHCSMessages = void 0;
const react_query_1 = require("@tanstack/react-query");
// Fetch HCS messages
const useHCSMessages = () => {
    return (0, react_query_1.useQuery)({
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
            const uniqueMessages = Array.from(new Map(validMessages.map(msg => [msg.id, msg])).values());
            console.log(`✅ FETCH: Received ${uniqueMessages.length} valid unique HCS messages`);
            return uniqueMessages;
        },
        refetchInterval: 10000, // Reduce polling frequency to 10 seconds
        staleTime: 5000, // Consider data fresh for 5 seconds
    });
};
exports.useHCSMessages = useHCSMessages;
// Convert HCS messages to proposals
const useProposals = () => {
    const { data: messages, isLoading, error } = (0, exports.useHCSMessages)();
    // Track proposals and their statuses
    const proposalMap = new Map();
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
                    trigger: msg.details?.trigger,
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
exports.useProposals = useProposals;
// Approve a rebalance proposal
const useApproveProposal = () => {
    const queryClient = (0, react_query_1.useQueryClient)();
    return (0, react_query_1.useMutation)({
        mutationFn: async (proposalId) => {
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
exports.useApproveProposal = useApproveProposal;
// Execute a rebalance
const useExecuteRebalance = () => {
    const queryClient = (0, react_query_1.useQueryClient)();
    return (0, react_query_1.useMutation)({
        mutationFn: async ({ proposalId, newWeights }) => {
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
exports.useExecuteRebalance = useExecuteRebalance;
// Propose a rebalance
const useProposeRebalance = () => {
    const queryClient = (0, react_query_1.useQueryClient)();
    return (0, react_query_1.useMutation)({
        mutationFn: async ({ newWeights, executeAfter, quorum, trigger, justification }) => {
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
exports.useProposeRebalance = useProposeRebalance;
