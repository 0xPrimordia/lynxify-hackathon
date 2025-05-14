import { NextResponse } from 'next/server';
import { hederaService } from '@/app/services/hedera';
import messageStore from '@/app/services/message-store';
// Only run on server, not during build
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export async function GET() {
    try {
        console.log('🔍 HCS TEST: Starting HCS test...');
        // Get the topic IDs from environment variables
        const governanceTopicId = process.env.NEXT_PUBLIC_HCS_GOVERNANCE_TOPIC;
        const agentTopicId = process.env.NEXT_PUBLIC_HCS_AGENT_TOPIC;
        if (!governanceTopicId || !agentTopicId) {
            console.error('❌ HCS TEST ERROR: HCS topic IDs not configured');
            return NextResponse.json({ error: 'HCS topic IDs not configured' }, { status: 500 });
        }
        console.log('🔄 HCS TEST: Publishing test message to governance topic...');
        const testMessage = {
            id: `test-${Date.now()}`,
            type: 'RebalanceProposal',
            timestamp: Date.now(),
            sender: 'hcs-test',
            details: {
                message: 'This is a test message from the HCS test endpoint',
                newWeights: {
                    "HBAR": 0.25,
                    "WBTC": 0.25,
                    "WETH": 0.25,
                    "USDC": 0.25
                },
                executeAfter: Date.now() + 1000 * 60 * 60, // 1 hour from now
                quorum: 5000
            }
        };
        try {
            await hederaService.publishHCSMessage(governanceTopicId, testMessage);
            console.log('✅ HCS TEST: Test message published successfully');
        }
        catch (error) {
            console.error('❌ HCS TEST ERROR: Failed to publish test message', error);
            return NextResponse.json({
                error: 'Failed to publish test message',
                details: error instanceof Error ? error.message : String(error)
            }, { status: 500 });
        }
        // Wait a moment for the message to propagate
        console.log('⏱️ HCS TEST: Waiting for message to propagate...');
        await new Promise(resolve => setTimeout(resolve, 2000));
        // Try to read messages from the governance topic
        console.log('🔄 HCS TEST: Fetching messages from governance topic...');
        let governanceMessages;
        try {
            governanceMessages = messageStore.getMessages(governanceTopicId);
            console.log(`✅ HCS TEST: Received ${governanceMessages.length} messages from governance topic`);
        }
        catch (error) {
            console.error('❌ HCS TEST ERROR: Failed to fetch messages from governance topic', error);
            return NextResponse.json({
                error: 'Failed to fetch messages from governance topic',
                details: error instanceof Error ? error.message : String(error)
            }, { status: 500 });
        }
        // Return the test result
        return NextResponse.json({
            success: true,
            testMessageId: testMessage.id,
            governanceMessages: governanceMessages.map(msg => ({
                id: msg.id,
                type: msg.type,
                timestamp: new Date(msg.timestamp).toISOString(),
                sender: msg.sender
            })),
            governanceMessagesCount: governanceMessages.length,
            testMessageFound: governanceMessages.some(msg => msg.id === testMessage.id)
        });
    }
    catch (error) {
        console.error('❌ HCS TEST ERROR: Unexpected error', error);
        return NextResponse.json({
            error: 'Unexpected error',
            details: error instanceof Error ? error.message : String(error)
        }, { status: 500 });
    }
}
