# Fixing Duplicate Connections in HCS-10 Agent

This document explains how to fix the issue of duplicate connections in your HCS-10 agent.

## The Problem

Your HCS-10 agent has accumulated over 700 duplicate connections due to:

1. Improper initialization of the ConnectionsManager
2. Missing proper connection request identification
3. Lack of synchronization between connection state changes
4. Not using ConnectionsManager's built-in connection handling methods

## The Solution

We've implemented two key fixes:

1. A cleanup script to properly close existing duplicate connections
2. Updated the agent implementation to correctly use ConnectionsManager for all connection handling

## How to Run the Cleanup

Follow these steps to clean up existing duplicate connections:

1. **Stop any running agent processes**

2. **Run the cleanup script**:
   ```bash
   node scripts/cleanup-connections.mjs
   ```

   This script will:
   - Connect to Hedera using your agent credentials
   - Load all existing connections via ConnectionsManager
   - Send proper `close_connection` messages following the HCS-10 protocol
   - Mark connections as closed in ConnectionsManager
   - Back up connection data in case recovery is needed

3. **Delete the current connections file**:
   ```bash
   rm .connections.json
   ```

4. **Restart the agent with the fixed implementation**:
   ```bash
   npm run start:agent
   ```

## How We Fixed Connection Handling

The agent now properly uses ConnectionsManager to prevent duplicate connections:

1. **Proper ConnectionsManager Initialization**
   - Setting agent info including account ID and topic IDs
   - Using the same client instance across all components

2. **Correct Connection Message Processing**
   - All messages are processed through `ConnectionsManager.processInboundMessages()`
   - Connection requests are identified and tracked consistently

3. **Proper Connection State Management**
   - Pending connections are handled based on their status
   - Connections are synchronized between ConnectionsManager and local state
   - All state changes are properly persisted

4. **Following the Standards Expert Example**
   - Following the pattern from the standards-expert-agent example
   - Processing both types of pending connections (needs_confirmation and isPending)
   - Correctly handling connection request IDs

## Key Code Changes

These key changes ensure proper connection handling:

1. **Setting Agent Info**
   ```javascript
   await connectionsManager.setAgentInfo({
     accountId: this.agentId,
     inboundTopicId: this.inboundTopicId,
     outboundTopicId: this.outboundTopicId
   });
   ```

2. **Processing Messages**
   ```javascript
   // This ensures proper connection handling and deduplication
   connectionsManager.processInboundMessages(messages);
   ```

3. **Handling Pending Connections**
   ```javascript
   // Get both types of pending connections
   const needsConfirmation = connectionsManager.getConnectionsNeedingConfirmation();
   const pendingRequests = connectionsManager.getPendingRequests();
   
   // Handle each properly
   for (const conn of needsConfirmation) {
     await handleNeedsConfirmation(conn);
   }
   
   for (const conn of pendingRequests) {
     await handlePendingRequest(conn);
   }
   ```

## Verification

After implementing these changes:

1. Monitor the number of connections using the agent's status output
2. Check that new connection requests are properly handled without duplication
3. Verify that the connection count stays stable over time

## Future Prevention

To prevent duplicate connections in the future:

1. Always use ConnectionsManager for all connection operations
2. Process all incoming messages through ConnectionsManager.processInboundMessages()
3. Don't implement custom connection handling logic that bypasses ConnectionsManager
4. Always update connection status in ConnectionsManager after any changes

## References

- [Standards Expert Agent Example](https://github.com/hashgraph-online/standards-agent-kit/blob/main/examples/standards-expert/standards-expert-agent.ts)
- [ConnectionsManager Documentation](https://hashgraphonline.com/docs/libraries/standards-sdk/hcs-10/connections-manager/) 