import { BaseAgent } from './base-agent';
import { HCSMessage } from '../../types/hcs';
import { HederaService } from '../hedera';
export declare class RiskAssessmentAgent extends BaseAgent {
    private priceHistory;
    private readonly priceHistoryLength;
    private readonly riskThresholds;
    constructor(hederaService: HederaService);
    protected handleMessage(message: HCSMessage): Promise<void>;
    private handlePriceUpdate;
    private calculateVolatility;
}
