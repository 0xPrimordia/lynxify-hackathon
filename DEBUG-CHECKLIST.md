# Debugging Checklist Based on Reference Implementations

## 1. Connection Manager Issues

### Current Problems:
1. Not using ConnectionsManager consistently across codebase
2. Missing proper connection state tracking
3. Duplicate connections being created
4. Not cleaning up old connections

### Required Fixes:
1. Implement proper ConnectionsManager initialization:
```typescript
const connectionsManager = new ConnectionsManager({
  client: hcs10Client,
  logLevel: 'info',
  prettyPrint: true
});

await connectionsManager.setAgentInfo({
  accountId: agentId,
  inboundTopicId: inboundTopicId,
  outboundTopicId: outboundTopicId
});

// Load existing connections at startup
await connectionsManager.fetchConnectionData(agentId);
```

2. Fix connection handling pipeline:
```typescript
// 1. Process all incoming messages through ConnectionsManager first
await connectionsManager.processInboundMessages(messages);

// 2. Handle any pending connection requests
await processConnectionRequests();

// 3. Only then process standard messages
for (const message of messages) {
  if (isStandardMessage(message)) {
    await processStandardMessage(message);
  }
}
```

3. Implement proper connection cleanup:
```typescript
// Monitor connection timeouts
setInterval(() => {
  connectionsManager.cleanupStaleConnections();
}, 300000); // Every 5 minutes

// Handle connection closures properly
connectionsManager.onConnectionClosed((connection) => {
  // Cleanup any associated resources
});
```

## 2. Message Handling Issues

### Current Problems:
1. Messages being processed before connections are established
2. Missing message sequence tracking
3. No proper response handling

### Required Fixes:
1. Implement proper message sequence tracking:
```typescript
private lastSequence: Record<string, number> = {};

async processMessages(messages: HCSMessage[]) {
  for (const message of messages) {
    if (message.sequence_number <= (this.lastSequence[message.topicId] || 0)) {
      continue;
    }
    this.lastSequence[message.topicId] = message.sequence_number;
    await this.processMessage(message);
  }
}
```

2. Fix message validation:
```typescript
function validateMessage(message: HCSMessage): boolean {
  if (!message.p || message.p !== 'hcs-10') return false;
  if (!message.op) return false;
  if (!message.operator_id) return false;
  return true;
}
```

3. Implement proper response handling:
```typescript
async function sendResponse(topicId: string, message: any) {
  const response = {
    p: 'hcs-10',
    op: 'message',
    data: JSON.stringify(message),
    timestamp: new Date().toISOString()
  };
  await this.client.sendMessage(topicId, JSON.stringify(response));
}
```

## 3. Testing Approach

### Local Testing:
1. Use the official test client from examples:
```bash
npm run test:local-agent
```

2. Test connection flow:
```
connect       # Test connection establishment
send <text>   # Test message sending
status        # Verify connection state
close         # Test proper connection closure
```

3. Verify in logs:
- Proper sequence number tracking
- Messages processed in order
- No duplicate connections
- Proper connection state transitions

### Production Testing:
1. Monitor connection states:
- Check ConnectionsManager state
- Verify no duplicate connections
- Monitor connection timeouts

2. Monitor message processing:
- Verify sequence numbers
- Check message routing
- Validate responses

## 4. Required Code Changes

1. Update HCS10Agent class to properly use ConnectionsManager
2. Fix message processing pipeline
3. Implement proper connection cleanup
4. Add sequence number tracking
5. Fix response handling
6. Add proper logging for debugging

## 5. Immediate Action Items

1. [ ] Fix ConnectionsManager initialization
2. [ ] Implement proper message sequence tracking
3. [ ] Fix connection handling pipeline
4. [ ] Add connection cleanup
5. [ ] Update test client implementation
6. [ ] Add comprehensive logging
