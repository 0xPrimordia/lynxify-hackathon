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
