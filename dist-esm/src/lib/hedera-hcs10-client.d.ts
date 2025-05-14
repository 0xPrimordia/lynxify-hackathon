/**
 * Hedera HCS10 Client
 * A wrapper around the Hedera SDK for HCS-10 protocol
 */
import { HCS10ClientConfig, MessageStreamResponse, HCSMessage } from './types/hcs10-types';
import { HCS10Client } from './hcs10-agent';
/**
 * Implementation of the HCS10Client interface using the real Hedera SDK
 */
export declare class HederaHCS10Client implements HCS10Client {
    private client;
    private config;
    private topicsCache;
    constructor(config: HCS10ClientConfig);
    /**
     * Creates a new HCS topic
     * @returns The topic ID as a string
     */
    createTopic(): Promise<string>;
    /**
     * Sends a message to a topic
     * @param topicId The topic ID to send the message to
     * @param message The message content
     */
    sendMessage(topicId: string, message: string): Promise<{
        success: boolean;
    }>;
    /**
     * Gets messages from a topic
     * @param topicId The topic ID to get messages from
     */
    getMessageStream(topicId: string): Promise<MessageStreamResponse>;
    /**
     * Retrieves communication topics for an account
     * Required for ConnectionsManager
     * @param accountId The account ID to get topics for
     */
    retrieveCommunicationTopics(accountId: string): Promise<{
        inboundTopic: string;
        outboundTopic: string;
    }>;
    /**
     * Gets messages from a topic
     * Required for ConnectionsManager
     * @param topicId The topic ID to get messages from
     */
    getMessages(topicId: string): Promise<HCSMessage[]>;
}
