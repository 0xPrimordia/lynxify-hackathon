# Lynxify WebSocket Server

This is the WebSocket server and agent backend for the Lynxify Tokenized Index Demo.

## Setup

1. Create a `.env` file in this directory based on the `.env.example` template.

2. Install dependencies:
```bash
npm install
```

3. Build the server:
```bash
npm run build
```

4. Start the server:
```bash
npm run start
```

## Environment Variables

- `OPERATOR_ID`: Your Hedera account ID
- `OPERATOR_KEY`: Your Hedera private key
- `NEXT_PUBLIC_HCS_GOVERNANCE_TOPIC`: HCS topic ID for governance messages
- `NEXT_PUBLIC_HCS_AGENT_TOPIC`: HCS topic ID for agent messages
- `NEXT_PUBLIC_HCS_PRICE_FEED_TOPIC`: HCS topic ID for price feed messages
- `WS_PORT`: WebSocket server port (default: 3001)
- `OPENAI_API_KEY`: (Optional) OpenAI API key for AI-powered rebalance agent

## Deployment

This server is designed to be deployed to Render.com. The configuration is specified in the `render.yaml` file at the root of the project. 