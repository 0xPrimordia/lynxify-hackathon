import { NextResponse } from 'next/server';
import { HederaService } from '@/app/services/hedera';
// Only run on server, not during build
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
const hederaService = new HederaService();
export async function GET() {
    try {
        // TODO: Replace with actual data from Hedera
        const mockData = [
            {
                id: 'P123',
                type: 'RebalanceProposal',
                timestamp: Date.now() - 3600000,
                sender: '0.0.123',
                status: 'pending',
                details: {
                    newWeights: {
                        '0.0.123': 0.5,
                        '0.0.124': 0.3,
                        '0.0.125': 0.2
                    }
                },
                votes: {
                    for: 1500,
                    against: 500,
                    total: 2000
                }
            },
            {
                id: 'P124',
                type: 'PolicyChange',
                timestamp: Date.now() - 7200000,
                sender: '0.0.124',
                status: 'approved',
                details: {
                    policyChanges: {
                        maxWeight: 0.5,
                        minLiquidity: 1000000
                    }
                },
                votes: {
                    for: 1800,
                    against: 200,
                    total: 2000
                }
            }
        ];
        return NextResponse.json(mockData);
    }
    catch (error) {
        console.error('Error fetching proposals:', error);
        return NextResponse.json({ error: 'Failed to fetch proposals' }, { status: 500 });
    }
}
export async function POST(request) {
    try {
        const proposal = await request.json();
        if (!process.env.NEXT_PUBLIC_HCS_GOVERNANCE_TOPIC) {
            throw new Error('Missing NEXT_PUBLIC_HCS_GOVERNANCE_TOPIC environment variable');
        }
        // Make sure we have a valid message format
        const hcsMessage = {
            id: `proposal-${Date.now()}`,
            type: 'RebalanceProposal',
            timestamp: Date.now(),
            sender: 'ui-user',
            ...proposal
        };
        console.log(`📨 Submitting proposal to HCS: ${JSON.stringify(hcsMessage)}`);
        // Use the correct method to publish the message to HCS
        await hederaService.publishHCSMessage(process.env.NEXT_PUBLIC_HCS_GOVERNANCE_TOPIC, hcsMessage);
        return NextResponse.json({
            success: true,
            message: "Proposal successfully submitted to HCS",
            proposalId: hcsMessage.id
        });
    }
    catch (error) {
        console.error('Error publishing proposal:', error);
        return NextResponse.json({
            success: false,
            error: 'Failed to publish proposal to HCS',
            message: error instanceof Error ? error.message : 'Internal server error'
        }, { status: 500 });
    }
}
