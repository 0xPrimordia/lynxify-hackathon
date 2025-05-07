/**
 * Hedera HCS10 Client
 * A wrapper around the Hedera SDK for HCS-10 protocol
 */

import {
  Client,
  TopicCreateTransaction,
  TopicMessageSubmitTransaction,
  TopicMessageQuery,
  TopicId
} from "@hashgraph/sdk";
import {
  HCS10ClientConfig,
  MessageStreamResponse
} from './types/hcs10-types';
import { HCS10Client } from './hcs10-agent';

/**
 * Implementation of the HCS10Client interface using the real Hedera SDK
 */
export class HederaHCS10Client implements HCS10Client {
  private client: Client;
  private config: HCS10ClientConfig;

  constructor(config: HCS10ClientConfig) {
    this.config = config;
    
    // Create a client instance
    if (config.network === 'testnet') {
      this.client = Client.forTestnet();
    } else {
      // For mainnet or other networks, we need to configure it differently
      // since forMainnet() doesn't exist
      this.client = Client.forTestnet(); // Replace with proper initialization
      console.warn('Using testnet client for non-testnet network. Please implement proper mainnet support.');
    }
    
    // Set the operator account
    this.client.setOperator(config.operatorId, config.operatorPrivateKey);
    
    console.log(`🔄 Initialized HederaHCS10Client for ${config.network}`);
  }

  /**
   * Creates a new HCS topic
   * @returns The topic ID as a string
   */
  async createTopic(): Promise<string> {
    try {
      // Create a new topic
      const transaction = new TopicCreateTransaction();
      
      const response = await transaction.execute(this.client);
      const receipt = await response.getReceipt(this.client);
      
      const topicId = receipt.topicId!.toString();
      console.log(`✅ Created topic: ${topicId}`);
      
      return topicId;
    } catch (error) {
      console.error('Error creating topic:', error);
      throw error;
    }
  }

  /**
   * Sends a message to a topic
   * @param topicId The topic ID to send the message to
   * @param message The message content
   */
  async sendMessage(topicId: string, message: string): Promise<{ success: boolean }> {
    try {
      // Submit a message to the topic
      const transaction = new TopicMessageSubmitTransaction()
        .setTopicId(TopicId.fromString(topicId))
        .setMessage(message);
      
      const response = await transaction.execute(this.client);
      await response.getReceipt(this.client);
      
      console.log(`✅ Sent message to topic ${topicId}`);
      
      return { success: true };
    } catch (error) {
      console.error(`Error sending message to topic ${topicId}:`, error);
      throw error;
    }
  }

  /**
   * Gets messages from a topic
   * @param topicId The topic ID to get messages from
   */
  async getMessageStream(topicId: string): Promise<MessageStreamResponse> {
    try {
      const messages: MessageStreamResponse['messages'] = [];
      
      // Create a query to get messages
      // Note: The SDK's TopicMessageQuery doesn't have setStartTime and setLimit
      // We'll need to adapt the query based on the actual SDK methods
      const query = new TopicMessageQuery()
        .setTopicId(TopicId.fromString(topicId));
      
      // Execute the query and collect messages
      query.subscribe(
        this.client,
        (message: any) => {
          const contents = Buffer.from(message.contents || message.content).toString();
          
          messages.push({
            contents,
            sequence_number: message.sequenceNumber?.toNumber() || Date.now(),
            timestamp: message.consensusTimestamp?.toString() || new Date().toISOString(),
            topic_id: message.topicId?.toString() || topicId
          });
        },
        (error: any) => {
          console.error(`Error in message subscription for topic ${topicId}:`, error);
        }
      );
      
      // Wait a moment to collect messages
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      console.log(`✅ Retrieved ${messages.length} messages from topic ${topicId}`);
      
      return { messages };
    } catch (error) {
      console.error(`Error getting messages from topic ${topicId}:`, error);
      throw error;
    }
  }
} 