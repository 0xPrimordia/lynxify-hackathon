import { BaseAgent } from './base-agent';
import { HCSMessage } from '../../types/hcs';
import { HederaService } from '../hedera';
export declare class RebalanceAgent extends BaseAgent {
    private tokenService;
    private isExecuting;
    private tokenDataPath;
    constructor(hederaService: HederaService);
    protected handleMessage(message: HCSMessage): Promise<void>;
    private getProposals;
    private executeRebalance;
    private logTokenOperation;
}
