# Lynxify Rebalancing Agent

## Refactored Architecture

The server has been refactored to improve maintainability, separation of concerns, and testability. The changes focus on:

1. **Modular Design**: Each component has a clear responsibility
2. **Clean Separation of Concerns**: Services handle specific functionality
3. **Improved Error Handling**: Consistent error handling patterns
4. **HCS-10 Compliance**: Proper integration with Moonscape via the OpenConvAI standard

## Key Components

### Services

- **WebSocketService**: Manages client connections and broadcasts
- **HCSMessagingService**: Formats and publishes HCS messages using the HCS-10 standard
- **AgentRegistryService**: Handles registration with Moonscape registry
- **AIAnalysisService**: Uses OpenAI to analyze proposals and generate insights
- **ProposalHandlerService**: Manages proposal workflows and execution
- **HederaService**: Core Hedera operations (topics, tokens, etc.)

### Server Structure

- **start-server.ts**: Main entry point (replaces combined-server.ts)
- **server/index.ts**: Basic server initialization
- **server/server-init.ts**: Modular server component initialization

## Running the Server

Use the following command to run the refactored server:

```bash
npm run demo:refactored
```

This will initialize the server with all components and establish connections to:
- Governance topic (for proposals)
- Agent topic (for execution reports)
- Moonscape registry (for agent registration)
- Moonscape messaging (for agent communication)

## Environment Variables

The server requires the following environment variables:

```
# Hedera Configuration
NEXT_PUBLIC_HEDERA_NETWORK=testnet
NEXT_PUBLIC_OPERATOR_ID=0.0.xxxx
OPERATOR_KEY=302xxx

# HCS Topic IDs
NEXT_PUBLIC_HCS_GOVERNANCE_TOPIC=0.0.xxxx
NEXT_PUBLIC_HCS_AGENT_TOPIC=0.0.xxxx
NEXT_PUBLIC_HCS_REGISTRY_TOPIC=0.0.xxxx

# Moonscape Configuration (optional)
NEXT_PUBLIC_HCS_REGISTRY_URL=https://moonscape.tech
NEXT_PUBLIC_HCS_INBOUND_TOPIC=0.0.xxxx
NEXT_PUBLIC_HCS_OUTBOUND_TOPIC=0.0.xxxx

# OpenAI Configuration (optional)
OPENAI_API_KEY=sk-xxxx
``` 