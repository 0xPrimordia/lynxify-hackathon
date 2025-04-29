"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.useExecuteRebalance = exports.useApproveProposal = exports.useHCSMessages = exports.useProposals = void 0;
const react_query_1 = require("@tanstack/react-query");
const mockData_1 = require("./mockData");
const hedera_1 = require("./hedera");
// Simulated API delay
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));
// Proposals
const useProposals = () => {
    return (0, react_query_1.useQuery)({
        queryKey: ['proposals'],
        queryFn: async () => {
            await delay(500); // Simulate network delay
            return mockData_1.mockProposals;
        },
        staleTime: 30000, // Consider data fresh for 30 seconds
    });
};
exports.useProposals = useProposals;
// Fetch HCS messages
const useHCSMessages = () => {
    return (0, react_query_1.useQuery)({
        queryKey: ['hcs-messages'],
        queryFn: async () => {
            const response = await fetch('/api/hcs/messages');
            if (!response.ok) {
                throw new Error('Failed to fetch HCS messages');
            }
            return response.json();
        },
        refetchInterval: 5000, // Refetch every 5 seconds
    });
};
exports.useHCSMessages = useHCSMessages;
// Approve a rebalance proposal
const useApproveProposal = () => {
    const queryClient = (0, react_query_1.useQueryClient)();
    return (0, react_query_1.useMutation)({
        mutationFn: async (proposalId) => {
            await hedera_1.hederaService.approveRebalance(proposalId);
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
            await hedera_1.hederaService.executeRebalance(proposalId, newWeights);
            return { proposalId, newWeights };
        },
        onSuccess: () => {
            // Invalidate and refetch HCS messages
            queryClient.invalidateQueries({ queryKey: ['hcs-messages'] });
        },
    });
};
exports.useExecuteRebalance = useExecuteRebalance;
