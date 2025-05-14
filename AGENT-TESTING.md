# Lynxify Agent Testing Guide

This document provides a comprehensive overview of the agent testing framework in the Lynxify project, with a focus on testing the agent's messaging capabilities and diagnosing issues with agent responsiveness.

## 1. Overview of Agent Architecture

The Lynxify project uses an HCS-10 compliant agent architecture that consists of several key components:

### 1.1 Core Components

- **HCS10AgentHandler**: Main agent implementation that handles connections and messages
- **ConnectionsManager**: Manages connections to other agents via the HCS-10 protocol
- **Test Scripts**: Utilities for testing agent functionality

### 1.2 Key Files

| File | Purpose |
|------|---------|
| `scripts/hcs10/agent-handler.mjs` | Main agent implementation |
| `scripts/test-agent-message.mjs` | Test script for sending messages to the agent |
| `scripts/test-local-agent.mjs` | Interactive test client for local agent testing |
| `scripts/restart-agent.mjs` | Process monitoring wrapper for agent reliability |
| `.connections.json` | Stored connections for the agent |

## 2. Environment Configuration

The agent requires specific environment variables to function correctly:

```
# Hedera Account Information
OPERATOR_KEY=<private-key>
NEXT_PUBLIC_OPERATOR_ID=<account-id>

# Agent HCS Topics
NEXT_PUBLIC_HCS_AGENT_ID=<agent-account-id>
NEXT_PUBLIC_HCS_INBOUND_TOPIC=<inbound-topic-id>
NEXT_PUBLIC_HCS_OUTBOUND_TOPIC=<outbound-topic-id>
NEXT_PUBLIC_NETWORK=testnet
```

These should be stored in a `.env.local` file at the project root.

## 3. Testing Agent Messaging

### 3.1 Direct Message Testing

The `test-agent-message.mjs` script is designed to send a test message to the agent:

```bash
node scripts/test-agent-message.mjs
```

This script:
1. Reads connection information from `.connections.json`
2. Uses the first valid connection or falls back to hardcoded test topics
3. Sends a test message with the HCS-10 protocol format
4. Polls for responses for 30 seconds

### 3.2 Interactive Testing

The `test-local-agent.mjs` script provides a more interactive approach to testing:

```bash
node scripts/test-local-agent.mjs
```

This script:
1. Creates an interactive command-line interface
2. Allows establishing connections to the agent
3. Supports sending custom messages
4. Continuously polls for responses

Key commands in the interactive mode:
- `connect` - Establish connection to the agent
- `send <message>` - Send a message to the agent
- `status` - Check connection status
- `exit` - Exit the test client

### 3.3 Reference Implementation Testing

The standards-expert example in `reference-examples/standards-agent-kit/examples/standards-expert` provides a complete reference implementation of an HCS-10 agent:

```bash
cd reference-examples/standards-agent-kit
npm run standards-agent:start
```

## 4. Diagnosing Agent Response Issues

### 4.1 Common Issues

| Issue | Possible Causes | Solutions |
|-------|----------------|-----------|
| Agent not responding | Connection not established | Check the `.connections.json` file for valid connections |
| | Message format incorrect | Ensure messages follow HCS-10 protocol format |
| | Agent process inactive | Check agent logs and restart if needed |
| | Polling interval too long | Reduce polling interval in test scripts |
| Connection failures | Invalid topic IDs | Verify topic IDs are correct and accessible |
| | Network issues | Check Hedera network status |
| | Authentication issues | Verify account IDs and private keys |

### 4.2 Debugging Tools

1. **Agent Status File**: The agent writes status to `.agent_status.json`
2. **Connection Tracking**: Current connections are in `.connections.json`
3. **Process Monitoring**: The restart script monitors agent health

### 4.3 Message Handling Investigation

When the agent doesn't respond to messages, check:

1. Is the agent receiving the message?
   - Look for logging in the agent process output
   - Check if the message appears in the topic via Mirror Node Explorer

2. Is the agent processing the message?
   - Monitor the agent logs for message processing indications
   - Verify the message format matches what the agent expects

3. Is the agent sending responses?
   - Check if responses are being sent but not received
   - Verify the connection topic is being monitored correctly

## 5. Improving Test Coverage

### 5.1 Recommended Additional Tests

1. **Connection Lifecycle Tests**:
   - Test establishing connections
   - Test message exchange
   - Test closing connections

2. **Message Format Tests**:
   - Test various message formats
   - Test malformed messages
   - Test message validation

3. **Response Handling Tests**:
   - Test response generation
   - Test response delivery
   - Test response timing

### 5.2 Integration Testing

For full integration testing:

1. Run the agent in one terminal
2. Run a test client in another terminal
3. Monitor logs and message flow
4. Verify responses match expectations

## 6. Deployment Testing

The production agent runs on Render using:

1. `scripts/restart-agent.mjs` as the entry point
2. Port binding to `0.0.0.0:${PORT}` for Render compatibility
3. Health check endpoint at `/health`

Testing deployment issues requires:
1. Checking port binding functionality
2. Verifying environment variables on the deployed instance
3. Monitoring agent activity via logs

## 7. Testing the Standards Expert Agent

The Standards Expert agent provides a reference implementation for HCS-10 agent functionality. Here's how to test it locally:

### 7.1 Setting Up the Environment

Create a `.env.local` file in the standards-agent-kit directory with the correct values:

```
# Hedera Account Information
HEDERA_OPERATOR_ID=0.0.YOUR_OPERATOR_ACCOUNT_ID
HEDERA_OPERATOR_KEY=YOUR_OPERATOR_PRIVATE_KEY

# Agent HCS Topics
AGENT_ACCOUNT_ID=0.0.YOUR_AGENT_ACCOUNT_ID
AGENT_PRIVATE_KEY=YOUR_AGENT_PRIVATE_KEY
AGENT_INBOUND_TOPIC_ID=0.0.YOUR_INBOUND_TOPIC_ID
AGENT_OUTBOUND_TOPIC_ID=0.0.YOUR_OUTBOUND_TOPIC_ID

# OpenAI Configuration
OPENAI_API_KEY=YOUR_OPENAI_API_KEY
```

### 7.2 Running the Standards Expert Agent

```bash
cd reference-examples/standards-agent-kit
npm install
npm run standards-agent:start
```

The agent will:
1. Initialize the ConnectionsManager
2. Set up the vector store for knowledge
3. Begin monitoring the inbound topic for connection requests
4. Process messages on established connections

### 7.3 Interacting with the Standards Expert Agent

To test interaction with the Standards Expert agent:

1. In a separate terminal, use the CLI demo tool:
   ```bash
   cd reference-examples/standards-agent-kit
   npm run cli-demo
   ```

2. Follow these steps in the CLI:
   - Select option to initiate a connection
   - Enter the agent's information
   - After connection is established, send a test message
   - Check for responses

### 7.4 Potential Issues and Solutions

If the Standards Expert agent is not responding to messages:

| Issue | Solution |
|-------|----------|
| Agent initialization failure | Check environment variables and ensure they are correctly set in `.env.local` |
| OpenAI API key issues | Verify your OpenAI API key is valid and has sufficient quota |
| Connection establishment | Ensure the connection is properly established before sending messages |
| Message format | Verify your messages follow the HCS-10 protocol format with correct fields |
| Network connectivity | Check Hedera network status and ensure you can reach the Mirror Node |
| Vector store issues | If using document retrieval features, ensure your vector store is properly initialized |

### 7.5 Message Processing Debugging

The Standards Expert agent's message processing flow can be traced through these methods:

1. **Connection Establishment**:
   - The `connectionTool` handles creating connections
   - The `acceptConnectionTool` processes connection requests
   - The `ConnectionsManager` tracks connection states

2. **Message Polling**:
   - The `checkMessagesTool` polls for new messages
   - Messages are processed in `handleStandardMessage()`

3. **Response Generation**:
   - The agent uses OpenAI to generate responses
   - Responses are sent via `sendMessageTool`

To debug message processing:
- Add logging in the `handleStandardMessage()` function
- Monitor the ConnectionsManager's connection status
- Check if messages are actually being received by the agent
- Verify response messages are properly formatted and sent

### 7.6 Key Configuration Parameters

Review these configuration parameters for optimal operation:

1. **Polling Interval**: Reduce the polling interval for quicker responses
2. **Message Format**: Ensure strict adherence to HCS-10 protocol format
3. **OpenAI Timeout**: Increase timeout values if responses are timing out
4. **Log Level**: Set to 'debug' for more detailed logs during testing

## 8. Practical Testing Checklist

Use this step-by-step checklist to systematically debug agent message responsiveness issues:

### 8.1 Environment Setup Verification

- [ ] Confirm `.env.local` exists and has all required variables
- [ ] Verify all Hedera account IDs are in valid format (0.0.XXXXX)
- [ ] Validate private keys are correctly formatted
- [ ] Ensure topic IDs exist and are accessible to your accounts
- [ ] Verify OpenAI API key is valid (for Standards Expert agent)

### 8.2 Connection Verification

- [ ] Check `.connections.json` exists and contains valid connections
- [ ] Validate connection status is "established" not "pending"
- [ ] Verify connection topic IDs are in valid format
- [ ] Test connection with simple HCS10Client:

```javascript
// connection-test.mjs
import { HCS10Client } from '@hashgraphonline/standards-sdk';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function testConnection() {
  const client = new HCS10Client({
    network: 'testnet',
    operatorId: process.env.NEXT_PUBLIC_OPERATOR_ID,
    operatorPrivateKey: process.env.OPERATOR_KEY,
  });
  
  // Get first valid topic from connections
  const connFile = await import('./.connections.json', { assert: { type: 'json' } });
  const validConn = connFile.default.find(c => 
    c.status === 'established' && 
    c.connectionTopicId?.match(/^0\.0\.\d+$/)
  );
  
  if (!validConn) {
    console.error('No valid established connections found');
    return;
  }
  
  console.log(`Testing connection to topic: ${validConn.connectionTopicId}`);
  
  // Test message
  const message = {
    p: 'hcs-10',
    op: 'message',
    text: 'Connection test',
    timestamp: new Date().toISOString()
  };
  
  await client.sendMessage(validConn.connectionTopicId, JSON.stringify(message));
  console.log('Test message sent successfully');
}

testConnection().catch(console.error);
```

### 8.3 Agent Process Verification

- [ ] Confirm agent process is running:
  ```bash
  ps aux | grep agent
  ```
- [ ] Check agent logs for error messages
- [ ] Verify agent is actively polling for messages
- [ ] Examine `.agent_status.json` for recent activity
- [ ] Restart agent if necessary:
  ```bash
  node scripts/restart-agent.mjs
  ```

### 8.4 Message Testing with Logging

- [ ] Modify `test-agent-message.mjs` to include more debug logging
- [ ] Run agent with explicit logging:
  ```bash
  NODE_DEBUG=hcs,agent,debug node scripts/hcs10/agent-handler.mjs
  ```
- [ ] Send a test message with clear indication in content:
  ```javascript
  const testMessage = {
    p: 'hcs-10',
    op: 'message',
    text: `Test message ${Date.now()}`,
    timestamp: new Date().toISOString()
  };
  ```

### 8.5 Connection Interaction Testing

1. Test with existing connection:
   - [ ] Run `node scripts/test-local-agent.mjs`
   - [ ] Use connection test commands to verify communication

2. Create fresh connection:
   - [ ] Remove `.connections.json` temporarily
   - [ ] Restart agent
   - [ ] Establish new connection with test client
   - [ ] Test messaging on new connection

### 8.6 Standards Expert Agent Testing

- [ ] Test agent environment setup:
  ```bash
  cd reference-examples/standards-agent-kit
  npm run standards-agent:setup
  # Verify .env.local is created with correct template
  ```

- [ ] Run Standards Expert agent:
  ```bash
  npm run standards-agent:start
  ```

- [ ] Test with cli-demo:
  ```bash
  npm run cli-demo
  # Select option to initiate connection
  # Enter agent information
  # Send test message
  ```

### 8.7 Message Format Verification

Compare your messages with these known working formats:

**Standard Message**:
```json
{
  "p": "hcs-10",
  "op": "message",
  "text": "Hello, agent!",
  "timestamp": "2023-05-13T12:34:56.789Z"
}
```

**Alternative Format**:
```json
{
  "p": "hcs-10",
  "op": "message",
  "data": {
    "text": "Hello, agent!",
    "query": "test"
  },
  "timestamp": "2023-05-13T12:34:56.789Z"
}
```

### 8.8 Common Fixes for Non-responsive Agents

1. **Connection cleanup**:
   - [ ] Backup and remove `.connections.json`
   - [ ] Restart agent process
   - [ ] Re-establish connections

2. **Polling interval adjustment**:
   - [ ] Modify polling interval in `test-local-agent.mjs` to check more frequently
   - [ ] Update timeout settings in connection manager

3. **Network connectivity**:
   - [ ] Verify network access to Hedera testnet
   - [ ] Check for firewall or proxy issues

4. **Message format compliance**:
   - [ ] Ensure all required fields are present in messages
   - [ ] Verify message timestamps are properly formatted

5. **Code modifications for debugging**:
   - [ ] Add debug logging to `processApplicationMessage`
   - [ ] Add explicit error handling around message processing

## 9. Code Analysis and Current Issues

Based on a thorough examination of the existing codebase, here are the key findings and potential issues that may be affecting agent responsiveness:

### 9.1 Agent Message Processing Comparison

| Aspect | Lynxify Agent (agent-handler.mjs) | Standards Expert Agent |
|--------|-----------------------------------|------------------------|
| **Polling Interval** | 10 seconds | 10 seconds |
| **Message Filter** | Basic op/agent filtering | Comprehensive timestamp and sequence filtering |
| **Connection Tracking** | Simple Map-based | Sophisticated with connection topic monitoring |
| **State Management** | Direct management | Uses StateManager abstraction |
| **Response Format** | Simple text response | Uses sendMessageTool with proper formatting |
| **Error Handling** | Basic try/catch | Comprehensive with specific error handling |
| **Message Deduplication** | Simple string-based | Sequence number tracking per connection |

### 9.2 Identified Issues in Current Implementation

1. **Connection Management**:
   - ✅ Many "pending" connections in `.connections.json` (never approved) - FIXED
   - ✅ Some connections have invalid connectionTopicId format - FIXED
   - ✅ No proper cleanup of stale connections - FIXED
   - ❌ **Issue**: ConnectionsManager initialization fails with error: "ConnectionsManager requires a baseClient to operate" - PARTIALLY FIXED, but still seeing initialization errors

2. **Message Processing**:
   - ⚠️ The agent's `processApplicationMessage` function has basic message format handling - PARTIALLY FIXED (60% compatibility)
   - ⚠️ Message extraction logic doesn't completely match the Standards Expert's comprehensive approach
   - ✅ Sequence number tracking has been implemented to prevent duplicate processing

3. **Topic Messaging**:
   - ✅ Missing topic ID for response issue fixed by implementing fallback logic
   - ❌ **NEW ISSUE**: Rate limiting (HTTP 429) errors occur when checking too many connections at once

4. **HTTP Server**:
   - ❌ **NEW ISSUE**: Port binding conflicts due to multiple HTTP servers trying to use the same port

### 9.3 Implementation Analysis: Rate Limiting Issues

The agent processes all connection topics in a queue, but is trying to process them too quickly, which leads to HTTP 429 (Too Many Requests) errors from the Hedera Mirror Node API. Our attempted fix implemented:

1. Sequential connection checking with delays between requests
2. Batch processing (only 5 connections per cycle)
3. Exponential backoff on rate limit errors
4. Retry logic for failed requests

However, we still encounter issues:
- The ConnectionsManager initialization still has problems
- A port binding conflict occurs when trying to start the HTTP server twice

### 9.4 Reference Implementation Analysis

From analyzing the standards-expert reference implementation, we observe:

1. They use a more sophisticated connection selection strategy - not attempting to check all connections every cycle
2. The reference implementation uses a queue system with built-in delays between requests
3. Connections are prioritized based on activity and importance
4. Rate limiting is handled by backing off and retrying with increasing delays

### 9.5 Root Causes of Rate Limiting

1. **Too Many Simultaneous Connections**: With 721 valid connections, checking each one in rapid succession overwhelms the Mirror Node API.
2. **Insufficient Throttling**: Even with the 500ms delay, requests are happening too quickly.
3. **No Priority System**: All connections are treated equally, rather than prioritizing active ones.
4. **No Cache Layer**: The reference implementation may use caching to reduce redundant requests.

### 10.8 Rate Limiting Testing ❌ NEEDS FIXING

**Issue**: When starting the agent with our implemented fixes, we observe:

```
{ module: 'HCS10-BaseClient' } Error querying topic messages: Request failed with status code 429 on 0.0.5988416
{ module: 'HCS-SDK' } Error fetching messages: Error querying topic messages: Request failed with status code 429 on 0.0.5988416
```

These errors occur even after implementing:
- Batch processing (5 connections per cycle)
- Delays between connection checks (1000ms)
- Exponential backoff (2^retry * 1000ms)

**Root Cause**: Our solution is on the right track but has implementation issues: 
1. The ConnectionsManager is not initializing correctly
2. We have a port conflict with the HTTP server
3. The rate limiting solution needs further refinement

### 10.9 HTTP Server Port Conflict ❌ NEEDS FIXING

**Issue**: After fixing the ConnectionsManager initialization, we encounter:

```
Error: listen EADDRINUSE: address already in use 0.0.0.0:3000
    at Server.setupListenHandle [as _listen2] (node:net:1898:16)
```

**Root Cause**: The script is trying to create two HTTP servers on the same port:
1. One at the global script level
2. Another in the `setupHttpServer()` method of the `HCS10AgentHandler` class

### 11. Next Steps

Based on the test results, the following steps need to be taken to resolve the remaining issues:

1. ✅ Fix ConnectionsManager initialization with proper parameter name:
   ```javascript
   this.connectionsManager = new ConnectionsManager({
     baseClient: this.client,  // Change from client to baseClient
     logLevel: 'info',
     prettyPrint: true
   });
   ```
   Status: PARTIALLY FIXED - Still seeing initialization errors

2. ✅ Fix Missing Topic ID issue to allow message processing:
   ```javascript
   // Implement fallback logic for determining response topic
   let responseTopicId = message.connection_topic_id;
   if (!responseTopicId) {
     // Try to extract from origin_topic_id
     responseTopicId = message.origin_topic_id;
     
     // Try other fallback methods as described in section 9.6
   }
   ```
   Status: FIXED - The agent now properly detects and uses fallback topic IDs

3. 🔴 Fix Rate Limiting issue with improved connection processing:
   ```javascript
   // Implement batch processing and significant delays
   const connectionBatch = connections.slice(0, 5);
   // Process each connection with proper delay and backoff
   ```
   Status: PARTIALLY IMPLEMENTED - Still seeing rate limit errors

4. 🔴 Fix HTTP Server port conflict:
   ```javascript
   // Choose one approach for HTTP server creation, not both
   // Either use the global server or the class method, not both
   ```
   Status: NEEDS FIXING - Currently crashing due to port conflicts

5. 🔴 Implement a more sophisticated connection prioritization system:
   ```javascript
   // Prioritize connections based on activity
   connections.sort((a, b) => {
     // Sort by last activity time, etc.
   });
   ```
   Status: NOT STARTED - Required to fully address rate limiting

These issues will be addressed in the next implementation phase.