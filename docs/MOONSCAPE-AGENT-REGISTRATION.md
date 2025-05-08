# Moonscape HCS-10 Agent Registration Guide

This document provides a comprehensive guide to the HCS-10 agent implementation for the Lynxify project, specifically focusing on agent registration with Moonscape.

## Current Agent Status

| Component | Status | Details |
|-----------|--------|---------|
| Agent Account ID | ✅ Created | 0.0.5966030 |
| Inbound Topic | ✅ Created | 0.0.5966032 |
| Outbound Topic | ✅ Created | 0.0.5966031 |
| Profile Topic | ✅ Created | 0.0.5966035 |

## Available Scripts

The following scripts are available in the `scripts/hcs10/` directory:

1. **register-agent.mjs**: Registers a new HCS-10 agent with Moonscape
   ```bash
   node scripts/hcs10/register-agent.mjs
   ```

2. **update-env.mjs**: Updates environment variables based on registration data
   ```bash
   node scripts/hcs10/update-env.mjs
   ```

3. **verify-agent.mjs**: Verifies the agent's registration and topic access
   ```bash
   node scripts/hcs10/verify-agent.mjs
   ```

4. **monitor-agent.mjs**: Monitors the agent's inbound topic for messages
   ```bash
   node scripts/hcs10/monitor-agent.mjs
   ```

## Implementation Details

### Agent Registration

The agent registration process creates:

1. A Hedera account for the agent (if not using an existing one)
2. An inbound topic for receiving connection requests
3. An outbound topic for sending messages
4. A profile topic for storing agent metadata

The agent is registered with Moonscape's registry using the `createAndRegisterAgent` method of the `HCS10Client` from the `@hashgraphonline/standards-sdk` package.

```javascript
const client = new HCS10Client({
  network: 'testnet',
  operatorId: operatorId,
  operatorPrivateKey: operatorKey,
  logLevel: 'debug'
});

const agentBuilder = new AgentBuilder()
  .setName('Lynxify Agent')
  .setAlias('lynxify_agent')
  .setBio('Tokenized Index Agent for Lynxify')
  .setCapabilities([
    AIAgentCapability.TEXT_GENERATION,
    AIAgentCapability.KNOWLEDGE_RETRIEVAL,
    AIAgentCapability.DATA_INTEGRATION
  ])
  .setCreator('Lynxify')
  .setModel('gpt-3.5-turbo')
  .setNetwork('testnet');

const result = await client.createAndRegisterAgent(agentBuilder, {
  initialBalance: 5 // Fund with 5 HBAR
});
```

### Environment Variables

The registration process updates the `.env.local` file with the following variables:

- `NEXT_PUBLIC_HCS_AGENT_ID`: The agent's account ID
- `NEXT_PUBLIC_HCS_INBOUND_TOPIC`: The agent's inbound topic ID
- `NEXT_PUBLIC_HCS_OUTBOUND_TOPIC`: The agent's outbound topic ID
- `NEXT_PUBLIC_HCS_PROFILE_TOPIC`: The agent's profile topic ID
- `NEXT_PUBLIC_HCS_REGISTRY_TOPIC`: The Moonscape registry topic ID (if available)

### Registration Data Storage

The registration data is stored in a `.registration_status.json` file, which includes:

- `accountId`: The agent's account ID
- `privateKey`: The private key of the agent's account (protect this!)
- `operatorId`: The operator ID used in HCS-10 messages
- `inboundTopicId`: The agent's inbound topic ID
- `outboundTopicId`: The agent's outbound topic ID
- `profileTopicId`: The agent's profile topic ID

## Using the Agent

Once registered, the agent can:

1. Accept connection requests from other agents
2. Send and receive messages on connection topics
3. Execute business logic based on received messages

To use the agent in your application:

```javascript
import { HCS10Client } from '@hashgraphonline/standards-sdk';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Create HCS10 client
const client = new HCS10Client({
  network: 'testnet',
  operatorId: process.env.NEXT_PUBLIC_OPERATOR_ID,
  operatorPrivateKey: process.env.OPERATOR_KEY,
  logLevel: 'debug'
});

// Set up event handlers for the agent
const inboundTopicId = process.env.NEXT_PUBLIC_HCS_INBOUND_TOPIC;
const messageStream = await client.getMessageStream(inboundTopicId);

// Process messages
messageStream.forEach(message => {
  console.log('Received message:', message);
  // Process the message according to your business logic
});
```

## Common Issues and Troubleshooting

### "Failed to parse entity id" Error

This error typically occurs when passing an object instead of a string to methods that expect an entity ID. Ensure you're passing string IDs directly.

**Incorrect:**
```javascript
await client.registerAgent({
  id: topicId,  // Object instead of string
  // Other properties
});
```

**Correct:**
```javascript
await client.registerAgent({
  id: topicId.toString(),  // Convert to string
  // Other properties
});
```

### Topic Not Found

If you're unable to access topics, check:

1. The topic IDs in `.env.local` are correct
2. You're using the right network (testnet vs mainnet)
3. The operator account has sufficient HBAR for transaction fees

## Next Steps

To complete the HCS-10 agent implementation:

1. Implement connection handling to accept connection requests
2. Implement message processing logic for the agent's business functions
3. Integrate with the Lynxify tokenized index to execute rebalancing operations
4. Set up monitoring and health checks for the agent

## References

- [HCS-10 Standard Specification](https://github.com/hashgraph/hedera-improvement-proposal/blob/master/HIP/hip-206.md)
- [Standards SDK Documentation](https://docs.hashgraph.com/standards-sdk/)
- [Agent Builder Documentation](https://docs.hashgraph.com/standards-sdk/agent-builder) 