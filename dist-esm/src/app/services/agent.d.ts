import { HederaService } from './hedera';
import type { HCSMessage } from '../types/hcs';
export declare abstract class Agent {
    protected hederaService: HederaService;
    protected isRunning: boolean;
    constructor(hederaService: HederaService);
    start(): Promise<void>;
    stop(): Promise<void>;
    protected abstract handleMessage(message: HCSMessage): Promise<void>;
    protected publishMessage(message: HCSMessage): Promise<void>;
    protected publishRebalanceExecuted(proposalId: string, preBalances: Record<string, number>, postBalances: Record<string, number>): Promise<void>;
}
export declare class RebalanceAgent extends Agent {
    private aiService;
    private currentBalances;
    constructor(hederaService: HederaService);
    protected handleMessage(message: HCSMessage): Promise<void>;
    private executeRebalance;
    private fetchMarketData;
    private fetchTokenBalances;
    private calculateWeights;
    private executeTrades;
}
