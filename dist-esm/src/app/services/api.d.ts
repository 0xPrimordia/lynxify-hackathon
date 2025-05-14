export declare const useHCSMessages: () => import("@tanstack/react-query").UseQueryResult<HCSMessage[], Error>;
export declare const useProposals: () => {
    data: Proposal[];
    isLoading: boolean;
    error: Error | null;
};
export declare const useApproveProposal: () => import("@tanstack/react-query").UseMutationResult<string, Error, string, unknown>;
export declare const useExecuteRebalance: () => import("@tanstack/react-query").UseMutationResult<{
    proposalId: string;
    newWeights: Record<string, number>;
}, Error, {
    proposalId: string;
    newWeights: Record<string, number>;
}, unknown>;
export declare const useProposeRebalance: () => import("@tanstack/react-query").UseMutationResult<{
    newWeights: Record<string, number>;
    executeAfter: number;
    quorum: number;
    trigger: string | undefined;
    justification: string | undefined;
}, Error, {
    newWeights: Record<string, number>;
    executeAfter: number;
    quorum: number;
    trigger?: string;
    justification?: string;
}, unknown>;
