import { NextResponse } from 'next/server';
import { HederaService } from '@/app/services/hedera';
import { RebalanceProposal } from '@/app/types/hcs';

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
  } catch (error) {
    console.error('Error fetching proposals:', error);
    return NextResponse.json(
      { error: 'Failed to fetch proposals' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const proposal: RebalanceProposal = await request.json();
    
    await hederaService.publishMessage(
      process.env.NEXT_PUBLIC_GOVERNANCE_TOPIC_ID!,
      proposal
    );

    return NextResponse.json({ status: 'success' });
  } catch (error) {
    console.error('Error publishing proposal:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 