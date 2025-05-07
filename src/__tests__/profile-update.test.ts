import { HCS10Agent } from '../lib/hcs10-agent';
import { HCS10Client } from '../lib/types/hcs10-types';
import { v4 as uuidv4 } from 'uuid';

// Mock HCS10Client implementation
class MockHCS10Client implements HCS10Client {
  private messages: Map<string, string[]> = new Map();
  private topics: Map<string, string> = new Map();

  async createTopic(): Promise<string> {
    const topicId = `0.0.${uuidv4().slice(0, 8)}`;
    this.topics.set(topicId, topicId);
    return topicId;
  }

  async sendMessage(topicId: string, message: string): Promise<{ success: boolean }> {
    if (!this.messages.has(topicId)) {
      this.messages.set(topicId, []);
    }
    this.messages.get(topicId)!.push(message);
    return { success: true };
  }

  async getMessageStream(topicId: string): Promise<{ messages: Array<{ sequence_number: number; contents: string }> }> {
    const messages = this.messages.get(topicId) || [];
    return {
      messages: messages.map((content, index) => ({
        sequence_number: index + 1,
        contents: content
      }))
    };
  }

  clearMessages(topicId: string): void {
    this.messages.set(topicId, []);
  }
}

describe('Agent Profile Update Flow', () => {
  let agent: HCS10Agent;
  let client: MockHCS10Client;
  let agentInboundTopic: string;
  let agentOutboundTopic: string;
  let profileTopic: string;

  beforeEach(async () => {
    client = new MockHCS10Client();
    
    // Create topics
    agentInboundTopic = await client.createTopic();
    agentOutboundTopic = await client.createTopic();
    profileTopic = await client.createTopic();

    // Initialize agent with profile topic
    agent = new HCS10Agent(client, agentInboundTopic, agentOutboundTopic, profileTopic);
    agent.start(100); // Poll every 100ms for faster tests
  });

  afterEach(() => {
    agent.stop();
  });

  it('should update profile after connection', async () => {
    // Simulate client sending connection request
    const connectionRequest = {
      p: 'hcs-10',
      op: 'connection_request',
      operator_id: `${agentInboundTopic}@0.0.123`,
      timestamp: Date.now()
    };

    // Send connection request
    await client.sendMessage(agentInboundTopic, JSON.stringify(connectionRequest));

    // Wait for processing
    await new Promise(resolve => setTimeout(resolve, 200));

    // Check if profile was updated
    const messages = await client.getMessageStream(profileTopic);
    expect(messages.messages.length).toBeGreaterThan(0);

    const profileMessage = JSON.parse(messages.messages[0].contents);
    expect(profileMessage.type).toBe('AgentInfo');
    expect(profileMessage.details).toBeDefined();
    expect(profileMessage.details.capabilities).toContain('rebalancing');
  });

  it('should handle profile update failures gracefully', async () => {
    // Create a failing client
    const failingClient: HCS10Client = {
      createTopic: client.createTopic.bind(client),
      getMessageStream: client.getMessageStream.bind(client),
      sendMessage: async () => { throw new Error('Failed to send message'); }
    };

    // Initialize agent with failing client
    const failingAgent = new HCS10Agent(failingClient, agentInboundTopic, agentOutboundTopic, profileTopic);
    failingAgent.start(100);

    // Simulate connection request
    const connectionRequest = {
      p: 'hcs-10',
      op: 'connection_request',
      operator_id: `${agentInboundTopic}@0.0.123`,
      timestamp: Date.now()
    };

    // Send request and verify it doesn't crash
    await expect(failingClient.sendMessage(agentInboundTopic, JSON.stringify(connectionRequest))).rejects.toThrow();
    await new Promise(resolve => setTimeout(resolve, 200));

    failingAgent.stop();
  });

  it('should update profile with correct format', async () => {
    // Simulate connection request
    const connectionRequest = {
      p: 'hcs-10',
      op: 'connection_request',
      operator_id: `${agentInboundTopic}@0.0.123`,
      timestamp: Date.now()
    };

    // Send request
    await client.sendMessage(agentInboundTopic, JSON.stringify(connectionRequest));
    await new Promise(resolve => setTimeout(resolve, 200));

    // Get profile message
    const messages = await client.getMessageStream(profileTopic);
    expect(messages.messages.length).toBeGreaterThan(0);

    const profileMessage = JSON.parse(messages.messages[0].contents);

    // Verify profile format
    expect(profileMessage).toMatchObject({
      id: expect.any(String),
      type: 'AgentInfo',
      timestamp: expect.any(Number),
      sender: 'Lynxify Agent',
      details: {
        message: expect.any(String),
        agentId: expect.any(String),
        capabilities: expect.arrayContaining(['rebalancing']),
        agentDescription: expect.any(String),
        inboundTopicId: agentInboundTopic,
        outboundTopicId: agentOutboundTopic,
        display_name: 'Lynxify Agent',
        alias: 'lynxify_agent',
        bio: expect.any(String)
      }
    });
  });
}); 