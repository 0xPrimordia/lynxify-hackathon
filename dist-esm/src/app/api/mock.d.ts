import type { HCSMessage } from '../types/hcs';
export declare function getMockPrices(): Promise<any>;
export declare function createTopic(): Promise<void>;
export declare function publishMessage(topicId: string, message: HCSMessage): Promise<{
    topicId?: string;
}>;
export declare function listenToMessages(topicId: string, callback: (message: HCSMessage) => void): Promise<void>;
export declare function mockAgentAction(action: string, params: any): Promise<{
    success: boolean;
}>;
export declare function getTokenizedIndex(): Promise<any>;
export declare function updateTokenComposition(newWeights: {
    [key: string]: number;
}): Promise<{
    success: boolean;
}>;
export declare function GET(): Promise<any>;
export declare function POST(request: Request): Promise<any>;
export declare const HCS10MessageSchema: {
    type: string;
    properties: {
        messageType: {
            type: string;
        };
        commandDetails: {
            type: string;
        };
        agentIdentifier: {
            type: string;
        };
        timestamp: {
            type: string;
            format: string;
        };
        context: {
            type: string;
        };
    };
    required: string[];
};
export declare function publishGovernanceSettings(topicId: string, message: HCSMessage): Promise<{
    topicId?: string;
}>;
