import { Client, TopicMessageSubmitTransaction, TopicCreateTransaction, TopicMessageQuery, PrivateKey } from '@hashgraph/sdk';
import { NextResponse } from 'next/server';

function getClient() {
    const operatorId = process.env.NEXT_PUBLIC_OPERATOR_ID;
    const operatorPrivateKey = process.env.OPERATOR_KEY;

    if (operatorId == null || operatorPrivateKey == null) {
        throw new Error("Environment variables NEXT_PUBLIC_OPERATOR_ID and OPERATOR_KEY must be present");
    }

    const client = Client.forTestnet();
    client.setOperator(operatorId, PrivateKey.fromString(operatorPrivateKey));
    return client;
}

let proposals = [
    { id: 1, title: 'Proposal 1', votes: 0 },
    { id: 2, title: 'Proposal 2', votes: 0 },
];

let topicId = "";

const mockPrices = {
    BTC: 30000,
    ETH: 2000,
    HBAR: 0.1,
};

export async function getMockPrices() {
    return NextResponse.json(mockPrices);
}

export async function createTopic() {
    const client = getClient();
    const transaction = new TopicCreateTransaction();
    const response = await transaction.execute(client);
    const receipt = await response.getReceipt(client);
    topicId = receipt.topicId?.toString() || "";
    console.log("New topic created with ID:", topicId);
}

export async function publishMessage(message: string) {
    if (!topicId) {
        console.error("Topic ID is not set. Create a topic first.");
        return;
    }

    const client = getClient();
    const transaction = new TopicMessageSubmitTransaction({
        topicId,
        message,
    });

    const response = await transaction.execute(client);
    const receipt = await response.getReceipt(client);
    console.log("Message published with status:", receipt.status.toString());
}

export async function listenToMessages() {
    if (!topicId) {
        console.error("Topic ID is not set. Create a topic first.");
        return;
    }

    const client = getClient();
    new TopicMessageQuery()
        .setTopicId(topicId)
        .subscribe(client, null, (message) => {
            if (!message?.contents) {
                console.error("Received null or invalid message contents.");
                return;
            }
            const decodedMessage = Buffer.from(message.contents).toString('utf8');
            console.log("Received message:", decodedMessage);
            // Simulate agent action based on message
            if (decodedMessage.includes("rebalance")) {
                console.log("Agent executing rebalancing action...");
            }
        });
}

export async function mockAgentAction() {
    console.log("Mock agent listening for HCS messages...");

    const client = getClient();
    new TopicMessageQuery()
        .setTopicId(topicId)
        .subscribe(client, null, (message) => {
            const decodedMessage = Buffer.from(message.contents.buffer).toString('utf8');
            console.log("Agent received message:", decodedMessage);

            if (decodedMessage.includes("rebalance")) {
                console.log("Agent executing rebalancing action...");
                // Simulate rebalancing logic
                tokenizedIndex.composition.forEach((asset) => {
                    asset.weight = Math.max(10, asset.weight - 5); // Example adjustment
                });
                console.log("Rebalanced tokenized index:", tokenizedIndex);
            }
        });
}

let tokenizedIndex = {
    totalSupply: 1000000,
    composition: [
        { asset: 'Asset A', weight: 50 },
        { asset: 'Asset B', weight: 30 },
        { asset: 'Asset C', weight: 20 },
    ],
};

export async function getTokenizedIndex() {
    return NextResponse.json(tokenizedIndex);
}

export async function updateTokenComposition(newComposition: { asset: string; weight: number }[]) {
    tokenizedIndex.composition = newComposition;
    return NextResponse.json({ message: 'Token composition updated', tokenizedIndex });
}

export async function GET() {
    return NextResponse.json(proposals);
}

export async function POST(request: Request) {
    const { type, data } = await request.json();

    if (type === 'proposal') {
        const newProposal = { id: proposals.length + 1, title: data, votes: 0 };
        proposals.push(newProposal);
        return NextResponse.json({ message: 'Proposal added', proposals });
    }

    if (type === 'vote') {
        const proposal = proposals.find((p) => p.id === data.id);
        if (proposal) {
            proposal.votes += 1;
            return NextResponse.json({ message: 'Vote cast', proposals });
        }
        return NextResponse.json({ error: 'Proposal not found' }, { status: 404 });
    }

    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
}

export const HCS10MessageSchema = {
    type: "object",
    properties: {
        messageType: { type: "string" },
        commandDetails: { type: "object" },
        agentIdentifier: { type: "string" },
        timestamp: { type: "string", format: "date-time" },
        context: { type: "string" },
    },
    required: ["messageType", "commandDetails", "agentIdentifier", "timestamp"],
};

interface GovernanceSettings {
  sectorWeights: {
    sector: string;
    token: string;
    weight: number;
  }[];
  liquidityThreshold: number;
  stopLoss: number;
}

export async function publishGovernanceSettings(settings: GovernanceSettings) {
    if (!topicId) {
        console.error("Topic ID is not set. Create a topic first.");
        return;
    }

    const client = getClient();
    const message = {
        messageType: "governance-settings",
        commandDetails: settings,
        agentIdentifier: "lynxify-agent",
        timestamp: new Date().toISOString(),
        context: "Governance settings update",
    };

    const transaction = new TopicMessageSubmitTransaction({
        topicId,
        message: JSON.stringify(message),
    });

    const response = await transaction.execute(client);
    const receipt = await response.getReceipt(client);
    console.log("Governance settings published with status:", receipt.status.toString());
}