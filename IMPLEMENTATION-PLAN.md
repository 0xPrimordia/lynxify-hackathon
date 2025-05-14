# Implementation Plan: SDK-First HCS-10 Agent Architecture

## Background and Context

This document reconciles our original Unified Agent Architecture with critical learnings from our protocol testing and investigation. Our key findings:

1. **ConnectionsManager is Non-Negotiable:** The `ConnectionsManager` from `@hashgraphonline/standards-sdk` is the essential core of HCS-10 protocol compliance, not an optional component.

2. **Topic Configuration and Usage:** 
   - Inbound topic (no submit key): Only for receiving connection requests
   - Outbound topic (with submit key): Only for broadcasts/protocol messages
   - Connection topics: Required for all client-agent communication

3. **Transaction Patterns:**
   - Topics with submit keys: Must use freeze+sign+execute pattern
   - Topics without submit keys: Can use direct execution

4. **Current Implementation Gaps:**
   - Missing ConnectionsManager integration
   - Improper topic usage (using outbound topic for responses)
   - Incomplete transaction signing patterns

## SDK-First Implementation Approach

Instead of adapting our existing code to use the SDK, we will take an SDK-first approach where we:

1. Start with proper standards-sdk integration
2. Build around the ConnectionsManager core
3. Integrate our business logic into the standards-compliant framework

## Core Components 

```
                 +-------------------------+
                 | @hashgraphonline/      |
                 | standards-sdk          |
                 | ConnectionsManager     |
                 +------------+------------+
                              |
                              v
              +---------------+---------------+
              |                               |
              |     LynxifyAgentSdk          |
              |     (Protocol Handler)       |
              |                               |
              +---------------+---------------+
                              |
                              v
              +---------------+---------------+
              |                               |
              |     TokenizedIndexService     |
              |     (Business Logic)          |
              |                               |
              +-------------------------------+
```

### 1. ConnectionsManager (from standards-sdk)

The core component that manages all HCS-10 protocol operations:

- Topic creation and management
- Connection lifecycle (requests, creation, tracking)
- Message routing through appropriate topics
- Protocol-compliant message formatting

### 2. LynxifyAgentSdk

A thin wrapper that:

- Initializes and configures ConnectionsManager
- Translates between protocol messages and business logic
- Routes events to the business layer
- Maintains protocol compliance

### 3. TokenizedIndexService

Contains all business logic for the tokenized index:

- Rebalancing operations
- Token weight management
- Portfolio metrics
- Risk assessment

## Implementation Steps

### 1. Standards-SDK Integration (PRIORITY)

```typescript
// src/sdk/lynxify-agent-sdk.ts
import { ConnectionsManager, HCS10Client } from '@hashgraphonline/standards-sdk';
import { EventBus } from '../app/utils/event-bus';

export class LynxifyAgentSdk {
  private connectionsManager: ConnectionsManager;
  private client: HCS10Client;
  private eventBus: EventBus;
  
  constructor(client: HCS10Client, eventBus: EventBus) {
    this.client = client;
    this.eventBus = eventBus;
    
    // Initialize ConnectionsManager (CORE OF PROTOCOL COMPLIANCE)
    this.connectionsManager = new ConnectionsManager({
      client: this.client,
      logLevel: 'info',
      prettyPrint: true
    });
  }
  
  async initialize(agentAccountId: string, inboundTopicId: string, outboundTopicId: string): Promise<void> {
    // Set agent information with ConnectionsManager
    await this.connectionsManager.setAgentInfo({
      accountId: agentAccountId,
      inboundTopicId: inboundTopicId, 
      outboundTopicId: outboundTopicId
    });
    
    // Load existing connections
    await this.connectionsManager.fetchConnectionData(agentAccountId);
  }
  
  async processMessages(messages: any[]): Promise<void> {
    // Let ConnectionsManager handle all protocol messages
    await this.connectionsManager.processInboundMessages(messages);
    
    // Process connection requests that need confirmation
    await this.processConnectionRequests();
    
    // Process business messages for established connections
    for (const message of this.getBusinessMessages(messages)) {
      await this.handleBusinessMessage(message);
    }
  }
  
  private async processConnectionRequests(): Promise<void> {
    // Get connections needing confirmation
    const pendingRequests = this.connectionsManager.getPendingRequests();
    
    for (const request of pendingRequests) {
      // Accept the connection request (or implement custom approval logic)
      const connectionTopic = await this.connectionsManager.acceptConnectionRequest({
        requestId: request.id,
        memo: 'Connection accepted by Lynxify agent'
      });
      
      // Emit event for tracking
      this.eventBus.emitEvent('connection:created', {
        requestId: request.id,
        connectionTopic
      });
    }
  }
  
  async sendMessage(connectionId: string, data: any): Promise<void> {
    // Get connection topic from ConnectionsManager
    const connection = this.connectionsManager.getConnection(connectionId);
    if (!connection) {
      throw new Error(`No connection found with ID: ${connectionId}`);
    }
    
    // Send message through ConnectionsManager to proper connection topic
    await this.connectionsManager.sendMessage({
      connectionId,
      data: JSON.stringify(data)
    });
  }
  
  // Helper methods for business logic integration
  private getBusinessMessages(messages: any[]): any[] {
    // Filter business-related messages from the batch
    return messages.filter(message => {
      // Identify business messages (non-connection management)
      return message.type === 'business' || message.op === 'message';
    });
  }
  
  private async handleBusinessMessage(message: any): Promise<void> {
    // Extract business data
    const content = this.extractContentFromMessage(message);
    
    // Emit to business layer for processing
    this.eventBus.emitEvent('business:message', {
      content,
      connectionId: message.connectionId,
      sender: message.sender
    });
  }
  
  private extractContentFromMessage(message: any): any {
    // Extract meaningful content from HCS-10 formatted message
    if (typeof message.data === 'string') {
      try {
        return JSON.parse(message.data);
      } catch {
        return message.data;
      }
    }
    return message.data;
  }
}
```

### 2. Client Implementation with Proper Transaction Patterns

```typescript
// src/sdk/hedera-client.ts
import { 
  Client, 
  PrivateKey, 
  TopicCreateTransaction,
  TopicMessageSubmitTransaction,
  TopicInfoQuery,
  TopicId 
} from "@hashgraph/sdk";

export class HederaClient {
  private client: Client;
  private operatorPrivateKey: PrivateKey;
  private topicInfoCache: Map<string, {hasSubmitKey: boolean}>;
  
  constructor(client: Client, operatorPrivateKey: PrivateKey) {
    this.client = client;
    this.operatorPrivateKey = operatorPrivateKey;
    this.topicInfoCache = new Map();
  }
  
  async sendMessage(topicId: string, message: string): Promise<{success: boolean}> {
    try {
      // Check topic configuration
      const topicInfo = await this.getTopicInfo(topicId);
      
      // Create transaction
      const transaction = new TopicMessageSubmitTransaction()
        .setTopicId(TopicId.fromString(topicId))
        .setMessage(message);
      
      let response;
      
      // Use correct transaction pattern based on submit key
      if (topicInfo.hasSubmitKey) {
        // For topics with submit key (freeze+sign+execute)
        const frozenTx = await transaction.freezeWith(this.client);
        const signedTx = await frozenTx.sign(this.operatorPrivateKey);
        response = await signedTx.execute(this.client);
      } else {
        // For topics without submit key (direct execute)
        response = await transaction.execute(this.client);
      }
      
      // Get receipt
      await response.getReceipt(this.client);
      return { success: true };
    } catch (error) {
      console.error(`Error sending message to topic ${topicId}:`, error);
      return { success: false, error };
    }
  }
  
  async getTopicInfo(topicId: string): Promise<{hasSubmitKey: boolean}> {
    // Check cache first
    if (this.topicInfoCache.has(topicId)) {
      return this.topicInfoCache.get(topicId)!;
    }
    
    // Query topic info
    try {
      const topicInfo = await new TopicInfoQuery()
        .setTopicId(TopicId.fromString(topicId))
        .execute(this.client);
      
      const hasSubmitKey = topicInfo.submitKey ? true : false;
      
      // Cache result
      this.topicInfoCache.set(topicId, { hasSubmitKey });
      
      return { hasSubmitKey };
    } catch (error) {
      console.error(`Error getting topic info for ${topicId}:`, error);
      throw error;
    }
  }
  
  // Other required methods for HCS10Client interface
  async createTopic(): Promise<string> {
    // Implementation...
  }
  
  // More methods as needed...
}
```

### 3. Business Logic Integration 

```typescript
// src/app/services/tokenized-index.ts
import { EventBus } from '../utils/event-bus';
import { LynxifyAgentSdk } from '../../sdk/lynxify-agent-sdk';

export class TokenizedIndexService {
  private eventBus: EventBus;
  private agentSdk: LynxifyAgentSdk;
  
  constructor(eventBus: EventBus, agentSdk: LynxifyAgentSdk) {
    this.eventBus = eventBus;
    this.agentSdk = agentSdk;
    
    // Subscribe to business messages from the protocol layer
    this.eventBus.on('business:message', this.handleBusinessMessage.bind(this));
  }
  
  private async handleBusinessMessage(event: any): Promise<void> {
    const { content, connectionId, sender } = event;
    
    // Handle different message types
    switch (content.type) {
      case 'getPrices':
        await this.handleGetPrices(content, connectionId);
        break;
      case 'getPortfolio':
        await this.handleGetPortfolio(content, connectionId);
        break;
      case 'proposalRequest':
        await this.handleProposalRequest(content, connectionId);
        break;
      // Other business message types...
    }
  }
  
  private async handleGetPrices(content: any, connectionId: string): Promise<void> {
    // Business logic for price retrieval
    const prices = await this.getCurrentPrices();
    
    // Send response through proper connection topic
    await this.agentSdk.sendMessage(connectionId, {
      type: 'priceData',
      prices,
      timestamp: Date.now()
    });
  }
  
  // Other business logic methods...
}
```

### 4. Agent Runner 

```typescript
// src/app/scripts/run-sdk-agent.ts
import { 
  Client, 
  PrivateKey, 
  AccountId 
} from "@hashgraph/sdk";
import { EventBus } from '../utils/event-bus';
import { HederaClient } from '../../sdk/hedera-client';
import { LynxifyAgentSdk } from '../../sdk/lynxify-agent-sdk';
import { TokenizedIndexService } from '../services/tokenized-index';

async function runAgent() {
  // Initialize environment
  const operatorId = process.env.NEXT_PUBLIC_OPERATOR_ID!;
  const operatorKey = process.env.OPERATOR_KEY!;
  const inboundTopicId = process.env.NEXT_PUBLIC_HCS_INBOUND_TOPIC!;
  const outboundTopicId = process.env.NEXT_PUBLIC_HCS_OUTBOUND_TOPIC!;
  
  // Create Hedera client
  const client = Client.forTestnet();
  const privateKey = PrivateKey.fromString(operatorKey);
  client.setOperator(AccountId.fromString(operatorId), privateKey);
  
  // Create HederaClient with proper transaction patterns
  const hederaClient = new HederaClient(client, privateKey);
  
  // Create event bus for communication
  const eventBus = new EventBus();
  
  // Create agent SDK with ConnectionsManager integration
  const agentSdk = new LynxifyAgentSdk(hederaClient, eventBus);
  await agentSdk.initialize(operatorId, inboundTopicId, outboundTopicId);
  
  // Create business logic service
  const tokenizedIndexService = new TokenizedIndexService(eventBus, agentSdk);
  
  // Set up topic monitoring
  // ... (subscribe to topics, poll for messages, etc.)
  
  console.log('Agent started successfully!');
}

// Run the agent
runAgent().catch(error => {
  console.error('Fatal error running agent:', error);
  process.exit(1);
});
```

## Implementation Considerations

### 1. Dependency on standards-sdk

Ensure the correct version of `@hashgraphonline/standards-sdk` is installed and compatible with our requirements:

```
npm install @hashgraphonline/standards-sdk@0.0.95
```

Verify the ConnectionsManager API matches our expected usage pattern.

### 2. Topic Management

Our implementation must follow the correct topic usage pattern:

- **Inbound Topic:** Only receive connection requests
- **Connection Topics:** All regular client-agent communication
- **Outbound Topic:** Only broadcasts and protocol-specific messages

### 3. Transaction Handling

Ensure all transactions use the appropriate pattern based on topic submit key:

- Topics with submit keys: freeze+sign+execute
- Topics without submit keys: direct execute

### 4. Error Handling

Add robust error handling at all levels:

- Connection management errors
- Transaction signing errors
- Topic information errors
- Message parsing errors

## Migration Strategy

1. **Develop SDK-First Implementation:**
   - Create the LynxifyAgentSdk with ConnectionsManager
   - Implement proper transaction patterns
   - Build business logic integration

2. **Test Protocol Compliance:**
   - Verify connection request flow
   - Test message exchange
   - Validate transaction signing

3. **Phase Out start-live-agent.mjs:**
   - Deploy new implementation alongside existing
   - Redirect clients to new implementation
   - Retire start-live-agent.mjs

## Conclusion

This implementation plan directly addresses our learnings from protocol investigation and testing:

1. Places ConnectionsManager at the core of our architecture
2. Ensures proper topic usage following HCS-10 protocol
3. Implements correct transaction patterns for topics with submit keys
4. Maintains business logic integration from the original unified architecture

By taking this SDK-first approach, we can ensure protocol compliance while preserving our business functionality. 