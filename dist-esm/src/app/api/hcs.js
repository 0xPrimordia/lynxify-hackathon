import { HederaService } from '@/app/services/hedera';
import { NextResponse } from 'next/server';
const hederaService = new HederaService();
export async function publishRebalanceProposal(proposal) {
    const governanceTopicId = process.env.NEXT_PUBLIC_GOVERNANCE_TOPIC_ID;
    const message = {
        ...proposal,
        timestamp: Date.now(),
        sender: 'governance'
    };
    await hederaService.publishMessage(governanceTopicId, message);
}
export async function publishRebalanceApproval(approval) {
    const governanceTopicId = process.env.NEXT_PUBLIC_GOVERNANCE_TOPIC_ID;
    const message = {
        ...approval,
        timestamp: Date.now(),
        sender: 'governance',
        approvedBy: 'governance'
    };
    await hederaService.publishMessage(governanceTopicId, message);
}
export async function getRecentMessages() {
    try {
        const governanceTopicId = process.env.NEXT_PUBLIC_GOVERNANCE_TOPIC_ID;
        const agentTopicId = process.env.NEXT_PUBLIC_AGENT_TOPIC_ID;
        if (!governanceTopicId || !agentTopicId) {
            throw new Error('Topic IDs not found in environment variables');
        }
        // TODO: Implement message history fetching from Mirror Node
        // For now, return empty arrays
        return NextResponse.json({
            governance: [],
            agent: []
        });
    }
    catch (error) {
        console.error('Failed to fetch messages:', error);
        return NextResponse.json({ error: 'Failed to fetch messages' }, { status: 500 });
    }
}
