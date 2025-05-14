import { BaseAgent } from './base-agent';
import { HCSMessage } from '../../types/hcs';
import { HederaService } from '../hedera';
export declare class PriceFeedAgent extends BaseAgent {
    private updateInterval;
    private readonly updateFrequency;
    private readonly tokens;
    constructor(hederaService: HederaService);
    start(): Promise<void>;
    stop(): Promise<void>;
    private startPriceUpdates;
    private stopPriceUpdates;
    protected handleMessage(message: HCSMessage): Promise<void>;
}
