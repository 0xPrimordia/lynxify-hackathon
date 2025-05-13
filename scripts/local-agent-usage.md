# Local Testing for HCS-10 Agent

This guide explains how to test your HCS-10 agent chat handling locally before deploying to production.

## Setup Options

### Option 1: Full Testing with Real Credentials

For actual Hedera Testnet communication:

1. Create a `.env.local` file in your project root with the following:

```bash
# Test client credentials (your account that will connect to the agent)
TEST_ACCOUNT_ID=0.0.YOUR_ACCOUNT
TEST_PRIVATE_KEY=YOUR_PRIVATE_KEY

# Agent Information (the agent you're testing)
NEXT_PUBLIC_HCS_AGENT_ID=0.0.AGENT_ACCOUNT
NEXT_PUBLIC_HCS_INBOUND_TOPIC=0.0.INBOUND_TOPIC
NEXT_PUBLIC_HCS_OUTBOUND_TOPIC=0.0.OUTBOUND_TOPIC
```

### Option 2: Mock Testing (No Real Network Connectivity)

For quick local testing without Hedera credentials:

```bash
# No configuration needed! The test client will automatically use mock values.
npm run test:local-agent
```

The mock mode simulates connection establishment and message exchange without actually connecting to the Hedera network.

## Starting Your Testing Environment

### 1. Start your local agent

First, start the agent in one terminal window:

```bash
npm run start:agent
```

This will launch the HCS-10 agent using the credentials in your `.env.local` file.

### 2. Run the test client

In a separate terminal window, run the test client:

```bash
npm run test:local-agent
```

## Using the Test Client

The test client provides an interactive command interface:

```
=== HCS-10 Agent Test Client ===
Available commands:
  connect      - Establish a connection with your agent
  send <text>  - Send a message to your agent
  status       - Show current connection status
  close        - Close the current connection
  exit         - Exit the test client
  help         - Show this help menu
```

### Testing Chat Message Handling

1. First establish a connection:
   ```
   hcs10-test> connect
   ```

2. Send test messages to verify the chat handling:
   ```
   hcs10-test> send Hello agent!
   hcs10-test> send What can you do?
   hcs10-test> send Tell me about rebalancing
   ```

3. The test client will automatically display responses from the agent.

4. When finished, close the connection:
   ```
   hcs10-test> close
   ```

## What to Verify

When testing, verify that:

1. **Connection Handling**: Connection requests are properly accepted
2. **Message Reception**: Agent correctly receives messages
3. **Content Extraction**: Agent properly extracts the message content
4. **Response Generation**: Agent generates meaningful responses
5. **HCS-10 Formatting**: All messages follow the proper HCS-10 protocol format
6. **No Duplicates**: The agent doesn't create duplicate connections

## Troubleshooting

### Connection Issues
- Verify agent ID and topic IDs in your environment variables
- Check agent logs for connection errors
- Verify your test account has enough HBAR for transactions

### Message Issues
- Check that messages follow the HCS-10 protocol format:
  ```json
  {
    "p": "hcs-10",
    "op": "message",
    "text": "Your message here",
    "timestamp": "2023-06-01T12:00:00.000Z"
  }
  ```

### Mock Mode Limitations
- Mock mode does not communicate with the actual Hedera network
- It simulates responses that match the expected format
- Use real credentials for comprehensive testing before deployment 