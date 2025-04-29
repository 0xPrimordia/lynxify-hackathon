import { NextResponse } from 'next/server';
import { HederaService } from '@/app/services/hedera';

const hederaService = new HederaService();

export async function GET() {
  try {
    // TODO: Implement actual composition fetching from Hedera
    const mockComposition = {
      tokens: [
        {
          id: '0.0.123',
          symbol: 'BTC',
          weight: 0.5,
          price: 60000
        },
        {
          id: '0.0.124',
          symbol: 'ETH',
          weight: 0.3,
          price: 3000
        },
        {
          id: '0.0.125',
          symbol: 'USDC',
          weight: 0.2,
          price: 1
        }
      ],
      lastUpdated: Date.now()
    };

    return NextResponse.json(mockComposition);
  } catch (error) {
    console.error('Error fetching index composition:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 