import { HCSMessage, TokenWeights } from '../types/hcs';
export declare class HederaService {
    private client;
    private subscriptions;
    private lastPrices;
    private messageHandlers;
    constructor();
    createGovernanceTopic(): Promise<string>;
    createAgentTopic(): Promise<string>;
    createPriceFeedTopic(): Promise<string>;
    getTopicMessages(topicId: string): Promise<HCSMessage[]>;
    publishHCSMessage(topicId: string, message: HCSMessage): Promise<void>;
    subscribeToTopic(topicId: string, onMessage: (message: HCSMessage) => void): Promise<void>;
    unsubscribeFromTopic(topicId: string): Promise<void>;
    initializeTopics(): Promise<void>;
    private handlePriceFeedMessage;
    private handleGovernanceMessage;
    private handleAgentMessage;
    processPriceUpdate(price: number, tokenId: string): Promise<void>;
    assessRisk(priceChange: number, tokenId: string): Promise<void>;
    proposeRebalance(newWeights: TokenWeights, executeAfter: number, quorum: number, trigger?: 'price_deviation' | 'risk_threshold' | 'scheduled', justification?: string): Promise<void>;
    approveRebalance(proposalId: string): Promise<void>;
    getCurrentPortfolioWeights(): TokenWeights;
    executeRebalance(proposalId: string, newWeights: TokenWeights): Promise<void>;
    initializeAgents(): Promise<void>;
    private getProposal;
}
export declare const hederaService: HederaService;
