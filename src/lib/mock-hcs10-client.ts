import { v4 as uuidv4 } from 'uuid';
import {
  HCS10ClientConfig,
  MessageStreamResponse,
  HCS10ConnectionRequest,
  HCSMessage
} from './types/hcs10-types.js';
import { HCS10Client } from './hcs10-agent.js';

/**
 * Mock implementation of HCS10Client for testing purposes
 * Simulates the behavior of the SDK without actual Hedera network calls
 */
export class MockHCS10Client implements HCS10Client {
  private config: HCS10ClientConfig;
  private topics: Map<string, any>;
  private messages: Map<string, HCSMessage[]>;
  private accountTopics: Map<string, { inboundTopic: string; outboundTopic: string }>;

  constructor(config: HCS10ClientConfig) {
    this.config = config;
    this.topics = new Map();
    this.messages = new Map();
    this.accountTopics = new Map();
    
    // Set up default inbound/outbound topics
    const inboundTopicId = config.inboundTopicId || '0.0.5956431';
    const outboundTopicId = config.outboundTopicId || '0.0.5956432';
    
    this.topics.set('inbound', inboundTopicId);
    this.topics.set('outbound', outboundTopicId);
    
    // Store the mapping for this account
    if (config.operatorId) {
      this.accountTopics.set(config.operatorId, {
        inboundTopic: inboundTopicId,
        outboundTopic: outboundTopicId
      });
    }
    
    console.log('🔄 Initialized MockHCS10Client');
  }

  /**
   * Creates a mock topic and returns its ID
   */
  async createTopic(): Promise<string> {
    // Create a fake topic ID
    const topicId = `0.0.${Math.floor(Math.random() * 1000000 + 5000000)}`;
    this.topics.set(topicId, []);
    this.messages.set(topicId, []);
    console.log(`🔄 Created mock topic: ${topicId}`);
    return topicId;
  }

  /**
   * Sends a message to a topic
   * @param topicId The topic ID to send the message to
   * @param message The message content
   */
  async sendMessage(topicId: string, message: string): Promise<{ success: boolean }> {
    // Add the message to our stored messages
    if (!this.messages.has(topicId)) {
      this.messages.set(topicId, []);
    }
    
    // Generate a sequence number
    const sequenceNumber = Date.now();
    
    // Store the message with metadata
    this.messages.get(topicId)?.push({
      contents: message,
      sequence_number: sequenceNumber,
      timestamp: new Date().toISOString(),
      topic_id: topicId
    });
    
    console.log(`🔄 Sent message to topic ${topicId}`);
    
    // If this is a connection request, auto-respond
    try {
      const content = JSON.parse(message);
      if (content.p === 'hcs-10' && content.op === 'connection_request') {
        // Auto-respond on the requester's topic
        const parts = content.operator_id.split('@');
        if (parts.length === 2) {
          const requesterTopic = parts[0];
          setTimeout(() => {
            this.autoRespondToConnectionRequest(requesterTopic, content);
          }, 1000);
        }
      }
    } catch (error) {
      // Not a JSON message or not a connection request
    }
    
    return { success: true };
  }

  /**
   * Gets messages from a topic
   * @param topicId The topic ID to get messages from
   */
  async getMessageStream(topicId: string): Promise<MessageStreamResponse> {
    // Return stored messages for this topic
    if (!this.messages.has(topicId)) {
      this.messages.set(topicId, []);
    }
    
    console.log(`🔄 Getting messages from topic ${topicId}`);
    return { messages: this.messages.get(topicId) || [] };
  }
  
  /**
   * Auto-responds to a connection request
   * @param requesterTopic The topic ID to respond to
   * @param requestMessage The original request message
   */
  public async autoRespondToConnectionRequest(requesterTopic: string, requestMessage: HCS10ConnectionRequest): Promise<void> {
    // Create a connection response
    const response = {
      p: 'hcs-10' as const,
      op: 'connection_created',
      requesterId: this.config.operatorId,
      timestamp: Date.now()
    };
    
    // Send it to the requester's topic
    await this.sendMessage(requesterTopic, JSON.stringify(response));
    console.log(`🔄 Auto-responded to connection request on topic ${requesterTopic}`);
  }
  
  /**
   * Retrieves communication topics for an account
   * Required for ConnectionsManager
   * @param accountId The account ID to get topics for
   */
  async retrieveCommunicationTopics(accountId: string): Promise<{ inboundTopic: string; outboundTopic: string }> {
    // Check if we have stored topics for this account
    if (this.accountTopics.has(accountId)) {
      return this.accountTopics.get(accountId)!;
    }
    
    // If not, create and store them
    const inboundTopicId = await this.createTopic();
    const outboundTopicId = await this.createTopic();
    
    const topicInfo = {
      inboundTopic: inboundTopicId,
      outboundTopic: outboundTopicId
    };
    
    this.accountTopics.set(accountId, topicInfo);
    console.log(`🔄 Created communication topics for account ${accountId}`);
    return topicInfo;
  }
  
  /**
   * Gets messages from a topic
   * Required for ConnectionsManager
   * This is an alias for getMessageStream adapted to the format ConnectionsManager expects
   * @param topicId The topic ID to get messages from
   */
  async getMessages(topicId: string): Promise<HCSMessage[]> {
    const response = await this.getMessageStream(topicId);
    return response.messages;
  }
} 