import { Client, TopicCreateTransaction, TopicId } from "@hashgraph/sdk";
import { HCS10Agent } from "../src/lib/hcs10-agent";
import { HCS10Client } from "../src/lib/types/hcs10-types";
import dotenv from "dotenv";

dotenv.config();

// Initialize Hedera client
const client = Client.forTestnet();
client.setOperator(
  process.env.HEDERA_ACCOUNT_ID!,
  process.env.HEDERA_PRIVATE_KEY!
);

// HCS10Client implementation using Hedera SDK
class HederaHCS10Client implements HCS10Client {
  private client: Client;

  constructor(client: Client) {
    this.client = client;
  }

  async createTopic(): Promise<string> {
    const transaction = new TopicCreateTransaction();
    const response = await transaction.execute(this.client);
    const receipt = await response.getReceipt(this.client);
    return receipt.topicId!.toString();
  }

  async sendMessage(topicId: string, message: string): Promise<{ success: boolean }> {
    try {
      const transaction = new TopicMessageSubmitTransaction()
        .setTopicId(TopicId.fromString(topicId))
        .setMessage(message);
      
      const response = await transaction.execute(this.client);
      await response.getReceipt(this.client);
      return { success: true };
    } catch (error) {
      console.error('Error sending message:', error);
      return { success: false };
    }
  }

  async getMessageStream(topicId: string): Promise<{ messages: Array<{ sequence_number: number; contents: string }> }> {
    // In a real implementation, this would use the Hedera SDK's message query
    // For now, we'll return an empty array as this is handled by the agent's polling
    return { messages: [] };
  }
}

async function deployAgent() {
  try {
    console.log('🚀 Deploying Lynxify Agent...');

    // Create HCS10Client instance
    const hcs10Client = new HederaHCS10Client(client);

    // Create required topics
    console.log('Creating agent topics...');
    const inboundTopic = await hcs10Client.createTopic();
    const outboundTopic = await hcs10Client.createTopic();
    const profileTopic = await hcs10Client.createTopic();

    console.log('📝 Created topics:');
    console.log(`Inbound Topic: ${inboundTopic}`);
    console.log(`Outbound Topic: ${outboundTopic}`);
    console.log(`Profile Topic: ${profileTopic}`);

    // Initialize agent
    console.log('Initializing agent...');
    const agent = new HCS10Agent(
      hcs10Client,
      inboundTopic,
      outboundTopic,
      profileTopic
    );

    // Start agent
    console.log('Starting agent...');
    agent.start(5000); // Poll every 5 seconds

    // Save topic IDs to environment file
    const envContent = `
# Agent Topics
NEXT_PUBLIC_HCS_INBOUND_TOPIC=${inboundTopic}
NEXT_PUBLIC_HCS_OUTBOUND_TOPIC=${outboundTopic}
NEXT_PUBLIC_HCS_PROFILE_TOPIC=${profileTopic}
    `.trim();

    require('fs').writeFileSync('.env.local', envContent);
    console.log('✅ Saved topic IDs to .env.local');

    // Keep the process running
    console.log('🤖 Agent is running. Press Ctrl+C to stop.');
    process.on('SIGINT', () => {
      console.log('Stopping agent...');
      agent.stop();
      process.exit(0);
    });

  } catch (error) {
    console.error('❌ Deployment failed:', error);
    process.exit(1);
  }
}

// Run deployment
deployAgent(); 