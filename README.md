# Lynxify Tokenized Index Demo

This project demonstrates a tokenized index platform using Hedera's HCS-10 standard for AI agent communication. The platform leverages community governance to determine index composition, token ratios, and operational policies, while automated agents act on governance directives and market conditions.

## Features

- **Community Governance**: Propose and vote on index composition and token ratios
- **Automated Agent Operations**: AI agents listen to HCS-10 messages to autonomously execute rebalancing
- **Real-time Monitoring**: View price updates, risk metrics, and agent status
- **Transparent Logging**: All events are recorded immutably on Hedera via HCS

## Prerequisites

- Node.js 18 or later
- npm 9 or later
- Hedera testnet account with operator ID and private key

## Setup

1. Clone the repository:
```bash
git clone https://github.com/your-username/lynxify-hackathon.git
cd lynxify-hackathon
```

2. Install dependencies:
```bash
npm install
```

3. Create a `.env.local` file in the root directory with the following variables:
```
# Hedera account configuration
NEXT_PUBLIC_OPERATOR_ID=your_operator_id
OPERATOR_KEY=your_private_key

# HCS Topic IDs
NEXT_PUBLIC_HCS_GOVERNANCE_TOPIC=your_governance_topic_id
NEXT_PUBLIC_HCS_AGENT_TOPIC=your_agent_topic_id
NEXT_PUBLIC_HCS_PRICE_FEED_TOPIC=your_price_feed_topic_id

# WebSocket configuration
NEXT_PUBLIC_WS_URL=ws://localhost:3001

# Server port configurations
PORT=3000
WS_PORT=3001

# Optional: OpenAI API key for AI rebalance agent
# OPENAI_API_KEY=your_openai_api_key
```

4. Initialize HCS topics (if not already done):
```bash
npm run init-hcs
```

## Running the Demo

### All-in-one Demo Mode

Run the combined server that starts both the WebSocket server and Next.js application:
```bash
npm run demo
```

Then open your browser and navigate to:
```
http://localhost:3000
```

### Running Services Separately

1. First, build and start the WebSocket server:
```bash
npm run build-server && npm run ws
```

2. In a new terminal, start the Next.js development server:
```bash
npm run dev
```

3. Start the rebalance agent (optional):
```bash
npm run rebalance-agent
```

## Demo Walkthrough

1. **View Current Index Composition**
   - The left panel shows current token weights and prices
   - Updates every 30 seconds

2. **Monitor Active Proposals**
   - View and vote on active proposals
   - See real-time vote counts and status

3. **Control Agents**
   - Start/stop price feed, risk assessment, and rebalance agents
   - Monitor agent status and last messages

4. **Track Market Data**
   - View price history charts
   - Monitor risk metrics and alerts

5. **Watch HCS Messages**
   - Real-time feed of all HCS messages
   - Filter by message type

## Hedera Integration Details

This project demonstrates extensive use of Hedera's technology stack, particularly focusing on Hedera Consensus Service (HCS) for secure, ordered messaging between components.

### Client Connection

We initialize the Hedera client in `src/app/services/hedera.ts`:

```typescript
// src/app/services/hedera.ts (lines 20-36)
private initClient(): Client {
  console.log('Initializing Hedera client...');
  
  // Set the testnet configuration
  const network = { 
    '0.testnet.hedera.com:50211': '0.0.3' 
  };
  
  if (!process.env.NEXT_PUBLIC_OPERATOR_ID || !process.env.OPERATOR_KEY) {
    throw new Error('Environment variables for Hedera operator not configured');
  }
  
  // Create and initialize the client
  return Client.forNetwork(network)
    .setOperator(process.env.NEXT_PUBLIC_OPERATOR_ID, process.env.OPERATOR_KEY)
    .setMaxQueryPayment(new Hbar(2));
}
```

### HCS Topic Creation

Topics are created during initialization to separate different types of messages:

```typescript
// src/app/scripts/init-hcs.ts (lines 12-30)
async function initializeTopics() {
  // Create governance topic
  const governanceTopic = await new TopicCreateTransaction()
    .setTopicMemo("Lynxify Governance Topic")
    .execute(client);
  const governanceTopicId = (await governanceTopic.getReceipt(client)).topicId;
  
  // Create agent topic
  const agentTopic = await new TopicCreateTransaction()
    .setTopicMemo("Lynxify Agent Topic")
    .execute(client);
  const agentTopicId = (await agentTopic.getReceipt(client)).topicId;
  
  // Create price feed topic
  const priceFeedTopic = await new TopicCreateTransaction()
    .setTopicMemo("Lynxify Price Feed Topic")
    .execute(client);
  const priceFeedTopicId = (await priceFeedTopic.getReceipt(client)).topicId;
  
  console.log(`Generated topic IDs: Governance=${governanceTopicId}, Agent=${agentTopicId}, PriceFeed=${priceFeedTopicId}`);
}
```

### Subscribing to HCS Messages

We subscribe to HCS topics to receive real-time messages:

```typescript
// src/app/services/hedera.ts (lines 124-148)
public async subscribeToTopic(topicId: string, onMessage: (message: any) => void): Promise<void> {
  try {
    console.log(`Subscribing to topic: ${topicId}`);
    
    new TopicMessageQuery()
      .setTopicId(TopicId.fromString(topicId))
      .subscribe(
        this.client,
        (message) => {
          try {
            const messageAsString = Buffer.from(message.contents).toString();
            const parsedMessage = JSON.parse(messageAsString);
            console.log(`Received message from topic ${topicId}:`, parsedMessage.type);
            
            onMessage({
              id: v4(),
              ...parsedMessage,
              timestamp: message.consensusTimestamp.toDate().getTime()
            });
          } catch (err) {
            console.error(`Error processing message from topic ${topicId}:`, err);
          }
        }
      );
    
    console.log(`Successfully subscribed to topic: ${topicId}`);
  } catch (error) {
    console.error(`Failed to subscribe to topic ${topicId}:`, error);
    throw error;
  }
}
```

### Publishing Messages to HCS

Messages are published to HCS topics from various parts of the application:

```typescript
// src/app/services/hedera.ts (lines 180-198)
public async submitMessageToTopic(topicId: string, message: any): Promise<TransactionResponse> {
  try {
    if (!topicId) {
      throw new Error('Topic ID is required');
    }
    
    const messageString = JSON.stringify(message);
    
    console.log(`Submitting message to topic ${topicId}:`, message.type);
    
    const transaction = new TopicMessageSubmitTransaction()
      .setTopicId(TopicId.fromString(topicId))
      .setMessage(messageString);
    
    const response = await transaction.execute(this.client);
    console.log(`Message submitted to topic ${topicId}, transaction: ${response.transactionId}`);
    
    return response;
  } catch (error) {
    console.error(`Failed to submit message to topic ${topicId}:`, error);
    throw error;
  }
}
```

## HCS-10 Implementation

Our implementation follows the HCS-10 standard for agent communication, which enables rich, structured messaging that AI agents can reliably interpret and act upon.

### Message Structure

We implement HCS-10 message formats in our type definitions:

```typescript
// src/app/types/hcs.ts (lines 1-32)
export interface HCSMessage {
  id: string;
  type: string;
  timestamp: number;
  sender?: string;
  details?: any;
  message?: string;
  votes?: {
    for: number;
    against: number;
    total: number;
  };
}

export interface RebalanceProposal extends HCSMessage {
  type: 'RebalanceProposal';
  proposalId: string;
  details: {
    newWeights: Record<string, number>;
    executeAfter: number;
    quorum: number;
    trigger?: string;
    justification?: string;
    deviation?: number;
    riskLevel?: string;
    impact?: string;
  };
}

export interface RebalanceApproval extends HCSMessage {
  type: 'RebalanceApproved';
  details: {
    proposalId: string;
    approvedAt: number;
  };
}
```

### Creating HCS-10 Messages

When proposing a rebalance, we create an HCS-10 compliant message:

```typescript
// src/app/api/agents/ai-rebalance/route.ts (lines 58-78)
// Format the proposal message according to HCS-10 standard
const proposalMessage = {
  type: 'RebalanceProposal',
  proposalId: `P${Date.now()}`,
  sender: 'AI-Rebalance-Agent',
  details: {
    newWeights: newAllocations,
    executeAfter: executeAfter,
    quorum: 0.51, // Require 51% of votes
    trigger: proposal.trigger,
    justification: proposal.justification,
    deviation: proposal.deviationPercentage,
    impact: proposal.impact
  }
};

// Submit the proposal to the governance topic
await hederaService.submitMessageToTopic(
  process.env.NEXT_PUBLIC_HCS_GOVERNANCE_TOPIC!,
  proposalMessage
);
```

### Consuming and Processing HCS-10 Messages

Our rebalance agent listens for and processes HCS-10 messages:

```typescript
// src/app/services/agents/ai-rebalance-agent.ts (lines 93-112)
// This method processes messages from the HCS governance topic
private async processMessage(message: HCSMessage): Promise<void> {
  console.log(`AI Rebalance Agent processing message: ${message.type}`);
  
  if (message.type === 'RebalanceApproved') {
    const proposalId = message.details?.proposalId;
    
    if (proposalId) {
      // Find the original proposal
      const proposal = await this.proposalService.getProposal(proposalId);
      
      if (proposal && proposal.type === 'RebalanceProposal' && proposal.status === 'approved') {
        console.log(`Executing approved rebalance proposal: ${proposalId}`);
        
        try {
          // Execute the rebalance based on the proposal
          await this.hederaService.executeRebalance(proposalId, proposal.details.newWeights);
        } catch (error) {
          console.error(`Failed to execute rebalance for proposal ${proposalId}:`, error);
        }
      }
    }
  }
}
```

## HCS-10 Messaging Flow

Our application demonstrates the complete HCS-10 communication flow between users, governance, and AI agents.

### Proposal Submission Flow

1. **User initiates a rebalance proposal** through the UI:

```typescript
// src/app/components/RebalanceProposalModal.tsx (lines 72-90)
const handleSubmit = (e: React.FormEvent) => {
  e.preventDefault();
  setError(null);
  
  // [...validation code...]
  
  const executeAfter = calculateExecutionTime(executionTimeframe);
  
  try {
    const payload: ApiProposalPayload = {
      newWeights: weights,
      executeAfter,
      quorum: quorum / 100, // Convert to decimal
      trigger: triggerType,
      justification
    };

    proposeRebalance(payload);
    
    if (!isPending && !isError) {
      onClose();
    }
  } catch (err) {
    console.error('Error submitting proposal:', err);
    setError('Failed to submit proposal. Please try again.');
  }
};
```

2. **The proposal is published to the HCS governance topic**:

```typescript
// src/app/api/hcs/messages/route.ts (lines 81-90)
if (action === 'propose') {
  if (!newWeights || !executeAfter || !quorum) {
    console.error('⚠️ API: Missing required fields for proposal');
    return NextResponse.json({ error: 'Missing required fields for proposal' }, { status: 400 });
  }
  console.log('🔄 API: Calling proposeRebalance in HederaService...');
  await hederaService.proposeRebalance(newWeights, executeAfter, quorum, trigger, justification);
  console.log('✅ API: Successfully proposed rebalance!');
}
```

3. **AI agent listens for approved proposals**:

```typescript
// src/app/services/hedera.ts (lines 468-486)
public async approveRebalance(proposalId: string): Promise<TransactionResponse> {
  try {
    console.log(`Approving rebalance proposal: ${proposalId}`);
    
    // Create the approval message in HCS-10 format
    const approvalMessage = {
      type: 'RebalanceApproved',
      sender: process.env.NEXT_PUBLIC_OPERATOR_ID,
      details: {
        proposalId: proposalId,
        approvedAt: Date.now()
      }
    };
    
    // Submit the approval to the governance topic
    const response = await this.submitMessageToTopic(
      process.env.NEXT_PUBLIC_HCS_GOVERNANCE_TOPIC!,
      approvalMessage
    );
    
    return response;
  } catch (error) {
    console.error(`Failed to approve rebalance proposal ${proposalId}:`, error);
    throw error;
  }
}
```

4. **Agent executes the rebalance and logs completion**:

```typescript
// src/app/services/hedera.ts (lines 512-542)
public async executeRebalance(proposalId: string, newWeights: Record<string, number>): Promise<TransactionResponse> {
  try {
    console.log(`Executing rebalance for proposal: ${proposalId}`, newWeights);
    
    // In a production environment, this would interact with token services
    // For this demo, we simulate execution
    
    // Get current weights (simulated)
    const currentWeights = this.getCurrentPortfolioWeights();
    
    // Create execution message in HCS-10 format
    const executionMessage = {
      type: 'RebalanceExecuted',
      sender: process.env.NEXT_PUBLIC_OPERATOR_ID,
      details: {
        proposalId: proposalId,
        preBalances: currentWeights,
        postBalances: newWeights,
        executedAt: Date.now(),
        // AI analysis could be included here
        message: "Rebalance executed based on approval from governance process. Portfolio now better aligned with current market conditions."
      }
    };
    
    // Publish execution confirmation to agent topic
    const response = await this.submitMessageToTopic(
      process.env.NEXT_PUBLIC_HCS_AGENT_TOPIC!,
      executionMessage
    );
    
    return response;
  } catch (error) {
    console.error(`Failed to execute rebalance for proposal ${proposalId}:`, error);
    throw error;
  }
}
```

### AI-Generated Proposals

Our platform also features an AI agent that can autonomously generate rebalance proposals:

```typescript
// src/app/services/agents/ai-rebalance-agent.ts (lines 38-65)
public async generateRebalanceProposal(): Promise<RebalanceProposal | null> {
  try {
    console.log('Generating AI rebalance proposal...');
    
    // Get current market data and portfolio
    const marketData = await this.marketDataService.getMarketData();
    const currentPortfolio = this.hederaService.getCurrentPortfolioWeights();
    
    // Analyze market conditions with AI
    const analysis = await this.analyzeMarketConditions(marketData, currentPortfolio);
    
    if (!analysis.shouldRebalance) {
      console.log('AI determined no rebalance is needed at this time');
      return null;
    }
    
    // Generate new allocations based on AI recommendations
    const newAllocations = this.calculateNewAllocations(
      currentPortfolio,
      analysis.recommendations,
      analysis.marketTrends
    );
    
    // Create the proposal structure following HCS-10 format
    const proposal: RebalanceProposal = {
      id: uuidv4(),
      type: 'RebalanceProposal',
      timestamp: Date.now(),
      proposalId: `AI-${Date.now()}`,
      sender: 'AI-Rebalance-Agent',
      details: {
        newWeights: newAllocations,
        executeAfter: this.calculateExecuteAfterTime(),
        quorum: 0.51,
        trigger: analysis.trigger,
        justification: analysis.justification,
        impact: analysis.impact
      }
    };
    
    return proposal;
  } catch (error) {
    console.error('Error generating rebalance proposal:', error);
    return null;
  }
}
```

## Architecture

- **Frontend**: Next.js with React and Tailwind CSS
- **Backend**: Node.js with Hedera SDK
- **Real-time Updates**: WebSocket server
- **Data Storage**: Hedera HCS topics
- **Agent System**: TypeScript-based autonomous agents

## Testing

Run the test suite:
```bash
npm test
```

## Contributing

1. Fork the repository
2. Create your feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.