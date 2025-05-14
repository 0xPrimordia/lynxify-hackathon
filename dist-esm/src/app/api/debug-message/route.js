import { NextResponse } from 'next/server';
import messageStore from '@/app/services/message-store';
// Only run on server, not during build
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
// This is a debug endpoint to add a message directly to our in-memory store
export async function GET() {
    try {
        const governanceTopicId = process.env.NEXT_PUBLIC_HCS_GOVERNANCE_TOPIC;
        if (!governanceTopicId) {
            return NextResponse.json({ error: 'Missing governance topic ID' }, { status: 500 });
        }
        // Create a debug message
        const message = {
            id: `debug-${Date.now()}`,
            type: 'RebalanceProposal',
            timestamp: Date.now(),
            sender: 'debug-endpoint',
            details: {
                message: 'Debug message added directly to memory',
                newWeights: {
                    "HBAR": 0.3,
                    "WBTC": 0.3,
                    "WETH": 0.2,
                    "USDC": 0.2
                },
                executeAfter: Date.now() + 1000 * 60 * 60,
                quorum: 5000
            }
        };
        // Store it directly in the global MessageStore
        messageStore.addMessage(governanceTopicId, message);
        console.log('✅ DEBUG: Added debug message directly to MessageStore');
        // Return success
        return NextResponse.json({
            success: true,
            message: 'Debug message added to memory',
            messageId: message.id
        });
    }
    catch (error) {
        console.error('Error adding debug message:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
