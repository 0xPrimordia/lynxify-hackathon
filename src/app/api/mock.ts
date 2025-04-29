import { Client, TopicMessageSubmitTransaction, TopicCreateTransaction, TopicMessageQuery, PrivateKey, TopicId } from '@hashgraph/sdk';
import { NextResponse } from 'next/server';
import type { HCSMessage } from '../types/hcs';

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

export async function publishMessage(topicId: string, message: HCSMessage) {
    const client = getClient();
    const transaction = new TopicMessageSubmitTransaction()
        .setTopicId(TopicId.fromString(topicId))
        .setMessage(JSON.stringify(message));

    const response = await transaction.execute(client);
    const receipt = await response.getReceipt(client);
    console.log("Message published successfully");
    return receipt;
}

export async function listenToMessages(topicId: string, callback: (message: HCSMessage) => void) {
    const client = getClient();
    const query = new TopicMessageQuery()
        .setTopicId(TopicId.fromString(topicId));

    query.subscribe(
        client,
        (error) => {
            console.error("Error in subscription:", error);
        },
        (message) => {
            try {
                const parsedMessage = JSON.parse(message.contents.toString());
                callback(parsedMessage);
            } catch (error) {
                console.error("Error parsing message:", error);
            }
        }
    );
}

export async function mockAgentAction(action: string, params: any) {
    console.log("Mock agent action:", action, params);
    return { success: true };
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

export async function updateTokenComposition(newWeights: { [key: string]: number }) {
    console.log("Updating token composition with weights:", newWeights);
    return { success: true };
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

export async function publishGovernanceSettings(topicId: string, message: HCSMessage) {
    const client = getClient();
    const transaction = new TopicMessageSubmitTransaction()
        .setTopicId(TopicId.fromString(topicId))
        .setMessage(JSON.stringify(message));

    const response = await transaction.execute(client);
    const receipt = await response.getReceipt(client);
    console.log("Governance settings published successfully");
    return receipt;
}