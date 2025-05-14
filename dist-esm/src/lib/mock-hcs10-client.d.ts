import { HCS10ClientConfig, MessageStreamResponse, HCS10ConnectionRequest, HCSMessage } from './types/hcs10-types.js';
import { HCS10Client } from './hcs10-agent.js';
/**
 * Mock implementation of HCS10Client for testing purposes
 * Simulates the behavior of the SDK without actual Hedera network calls
 */
export declare class MockHCS10Client implements HCS10Client {
    private config;
    private topics;
    private messages;
    private accountTopics;
    constructor(config: HCS10ClientConfig);
    /**
     * Creates a mock topic and returns its ID
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
     * Auto-responds to a connection request
     * @param requesterTopic The topic ID to respond to
     * @param requestMessage The original request message
     */
    autoRespondToConnectionRequest(requesterTopic: string, requestMessage: HCS10ConnectionRequest): Promise<void>;
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
     * This is an alias for getMessageStream adapted to the format ConnectionsManager expects
     * @param topicId The topic ID to get messages from
     */
    getMessages(topicId: string): Promise<HCSMessage[]>;
}
