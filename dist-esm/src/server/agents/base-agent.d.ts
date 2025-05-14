import { HCSMessage } from '../../types/hcs';
import { HederaService } from '../hedera';
export interface AgentConfig {
    id: string;
    type: 'price-feed' | 'risk-assessment' | 'rebalance';
    hederaService: HederaService;
    topics: {
        input: string;
        output: string;
    };
}
export declare abstract class BaseAgent {
    protected id: string;
    protected type: string;
    protected hederaService: HederaService;
    protected inputTopic: string;
    protected outputTopic: string;
    protected isRunning: boolean;
    constructor(config: AgentConfig);
    start(): Promise<void>;
    stop(): Promise<void>;
    protected publishHCSMessage(message: HCSMessage): Promise<void>;
    protected abstract handleMessage(message: HCSMessage): Promise<void>;
}
