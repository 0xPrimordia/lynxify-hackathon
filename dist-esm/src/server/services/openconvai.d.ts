import { HCSMessage } from '../types/hcs';
/**
 * OpenConvAI Service
 * Implements the HCS-10 standard for AI agent communication
 */
export declare class OpenConvAIService {
    private sdk;
    private messageHandlers;
    private isInitialized;
    private agentId;
    private _topicCallbacks;
    constructor();
    /**
     * Initialize the SDK with Hedera credentials
     */
    init(): Promise<void>;
    /**
     * Register the agent in the HCS-10 registry
     */
    registerAgent(): Promise<any>;
    /**
     * Subscribe to a topic for messages
     */
    subscribeToTopic(topicId: string, onMessage: (message: HCSMessage) => void): Promise<void>;
    /**
     * Send a message to a topic
     */
    sendMessage(topicId: string, message: HCSMessage): Promise<any>;
}
export declare const openConvAIService: OpenConvAIService;
