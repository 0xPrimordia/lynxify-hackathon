/**
 * Hedera HCS10 Client
 * A wrapper around the Hedera SDK for HCS-10 protocol
 * 
 * IMPORTANT: Inbound and outbound topics have different security requirements by design
 * - Inbound topics (no submit key): Use direct execution
 * - Outbound topics (with submit key): Use freeze+sign+execute pattern
 */

import {
  Client,
  TopicCreateTransaction,
  TopicMessageSubmitTransaction,
  TopicMessageQuery,
  TopicId,
  TopicInfoQuery,
  PrivateKey
} from "@hashgraph/sdk";
import {
  HCS10ClientConfig,
  MessageStreamResponse,
  HCSMessage
} from './types/hcs10-types';
import { HCS10Client } from './hcs10-agent';

/**
 * Implementation of the HCS10Client interface using the real Hedera SDK
 * Correctly handles different transaction patterns for inbound and outbound topics
 */
export class HederaHCS10Client implements HCS10Client {
  private client: Client;
  private config: HCS10ClientConfig;
  private operatorPrivateKey: PrivateKey;
  private topicsCache: Map<string, { inboundTopic: string; outboundTopic: string }>;
  private topicInfoCache: Map<string, { submitKey: string | null; adminKey: string | null }>;

  constructor(config: HCS10ClientConfig) {
    this.config = config;
    this.topicsCache = new Map();
    this.topicInfoCache = new Map();
    
    // Create a client instance
    if (config.network === 'testnet') {
      this.client = Client.forTestnet();
    } else {
      // For mainnet or other networks, fallback to testnet with a warning
      // since Client.forMainnet() doesn't exist in the current SDK version
      this.client = Client.forTestnet();
      console.warn('Using testnet client for non-testnet network. Set network nodes manually for mainnet.');
    }
    
    // Set the operator account
    this.operatorPrivateKey = PrivateKey.fromString(config.operatorPrivateKey);
    this.client.setOperator(config.operatorId, this.operatorPrivateKey);
    
    // Store the default topics in cache if provided
    if (config.inboundTopicId && config.outboundTopicId && config.operatorId) {
      this.topicsCache.set(config.operatorId, {
        inboundTopic: config.inboundTopicId,
        outboundTopic: config.outboundTopicId
      });
    }
    
    console.log(`🔄 Initialized HederaHCS10Client for ${config.network}`);
    console.log(`🔑 Using operator ID: ${config.operatorId}`);
  }

  /**
   * Creates a new HCS topic
   * @returns The topic ID as a string
   */
  async createTopic(): Promise<string> {
    try {
      console.log(`🆕 Creating new topic...`);
      
      // Create a new topic
      const transaction = new TopicCreateTransaction();
      
      const response = await transaction.execute(this.client);
      const receipt = await response.getReceipt(this.client);
      
      const topicId = receipt.topicId!.toString();
      console.log(`✅ Created topic: ${topicId}`);
      
      return topicId;
    } catch (error) {
      console.error('❌ Error creating topic:', error);
      throw error;
    }
  }

  /**
   * Gets information about a topic including its submit key
   * @param topicId The topic ID
   * @returns Topic information including submit key
   */
  async getTopicInfo(topicId: string): Promise<{ submitKey: string | null; adminKey: string | null }> {
    try {
      // Check cache first
      if (this.topicInfoCache.has(topicId)) {
        const cachedInfo = this.topicInfoCache.get(topicId);
        console.log(`🔄 Using cached topic info for ${topicId}`);
        return cachedInfo!;
      }

      console.log(`🔄 Fetching topic info for ${topicId}...`);
      
      // Query the topic information
      const topicInfo = await new TopicInfoQuery()
        .setTopicId(TopicId.fromString(topicId))
        .execute(this.client);
      
      // Extract keys
      const submitKey = topicInfo.submitKey ? topicInfo.submitKey.toString() : null;
      const adminKey = topicInfo.adminKey ? topicInfo.adminKey.toString() : null;
      
      // Cache the result
      const result = { submitKey, adminKey };
      this.topicInfoCache.set(topicId, result);
      
      console.log(`ℹ️ Topic ${topicId} info:
      - Submit key: ${submitKey ? 'PRESENT' : 'NONE'}
      - Admin key: ${adminKey ? 'PRESENT' : 'NONE'}`);
      
      return result;
    } catch (error) {
      console.error(`❌ Error fetching topic info for ${topicId}:`, error);
      throw error;
    }
  }

  /**
   * Sends a message to a topic
   * Follows HCS-10 protocol requirements for inbound vs outbound topics
   * @param topicId The topic ID to send the message to
   * @param message The message content
   */
  async sendMessage(topicId: string, message: string): Promise<{ success: boolean }> {
    try {
      console.log(`📤 Sending message to topic ${topicId}...`);
      console.log(`📏 Message length: ${message.length} bytes`);
      
      // Create transaction
      const transaction = new TopicMessageSubmitTransaction()
        .setTopicId(TopicId.fromString(topicId))
        .setMessage(message);
      
      // Get topic info to check for submit key requirement
      const topicInfo = await this.getTopicInfo(topicId);
      
      let response;
      
      // Use the correct transaction pattern based on topic type
      if (topicInfo.submitKey) {
        // This is a secured topic (like outbound) - needs submit key
        console.log(`🔒 Topic ${topicId} requires submit key - using freeze+sign pattern`);
        
        // Freeze the transaction
        const frozenTx = await transaction.freezeWith(this.client);
        
        // IMPORTANT: We must use our operator's private key for signing
        // The submitKey from topic info is the PUBLIC key, not the private key
        console.log(`🔑 Signing with operator's private key for submit key authorized topic`);
        
        // Sign with our operator's private key
        const signedTx = await frozenTx.sign(this.operatorPrivateKey);
        
        // Now execute the signed transaction
        console.log(`🔏 Executing signed transaction`);
        response = await signedTx.execute(this.client);
      } else {
        // This is an unsecured topic (like inbound) - direct execution
        console.log(`🔓 Topic ${topicId} does not require submit key - using direct execute pattern`);
        response = await transaction.execute(this.client);
      }
      
      // Wait for receipt
      const receipt = await response.getReceipt(this.client);
      
      console.log(`✅ Message successfully sent to topic ${topicId}`);
      console.log(`📝 Transaction ID: ${response.transactionId.toString()}`);
      
      return { success: true };
    } catch (error: any) {
      console.error(`❌ Error sending message to topic ${topicId}:`, error);
      if (error && typeof error === 'object' && 'status' in error) {
        console.error(`📊 Error status: ${error.status.toString()}`);
      }
      return { success: false };
    }
  }

  /**
   * Gets messages from a topic
   * @param topicId The topic ID to get messages from
   */
  async getMessageStream(topicId: string): Promise<MessageStreamResponse> {
    try {
      console.log(`🔄 Getting messages from topic ${topicId}...`);
      
      const messages: HCSMessage[] = [];
      
      // Create a query to get messages
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
          console.error(`❌ Error in message subscription for topic ${topicId}:`, error);
        }
      );
      
      // Wait a moment to collect messages
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      console.log(`✅ Retrieved ${messages.length} messages from topic ${topicId}`);
      
      return { messages };
    } catch (error) {
      console.error(`❌ Error getting messages from topic ${topicId}:`, error);
      throw error;
    }
  }

  /**
   * Retrieves communication topics for an account
   * Required for ConnectionsManager
   * @param accountId The account ID to get topics for
   */
  async retrieveCommunicationTopics(accountId: string): Promise<{ inboundTopic: string; outboundTopic: string }> {
    try {
      // Check if we have cached topics for this account
      if (this.topicsCache.has(accountId)) {
        console.log(`✅ Using cached topics for account ${accountId}`);
        return this.topicsCache.get(accountId)!;
      }

      // In a real implementation, this would query a registry or other source
      
      if (accountId === this.config.operatorId && this.config.inboundTopicId && this.config.outboundTopicId) {
        // If this is our own account and we have topics configured, use those
        const topicInfo = {
          inboundTopic: this.config.inboundTopicId,
          outboundTopic: this.config.outboundTopicId
        };
        this.topicsCache.set(accountId, topicInfo);
        return topicInfo;
      }
      
      // For other accounts, we'd need to look up their topics
      // This is a simplified implementation
      console.log(`⚠️ No cached topics for account ${accountId}, creating new topics`);
      const inboundTopic = await this.createTopic();
      const outboundTopic = await this.createTopic();
      
      const topicInfo = {
        inboundTopic,
        outboundTopic
      };
      
      // Cache the result
      this.topicsCache.set(accountId, topicInfo);
      
      return topicInfo;
    } catch (error) {
      console.error(`❌ Error retrieving communication topics for account ${accountId}:`, error);
      throw error;
    }
  }
  
  /**
   * Gets messages from a topic
   * Required for ConnectionsManager
   * @param topicId The topic ID to get messages from
   */
  async getMessages(topicId: string): Promise<HCSMessage[]> {
    try {
      const response = await this.getMessageStream(topicId);
      return response.messages;
    } catch (error) {
      console.error(`❌ Error getting messages from topic ${topicId}:`, error);
      // Return empty array on error to avoid breaking the ConnectionsManager
      return [];
    }
  }
} 