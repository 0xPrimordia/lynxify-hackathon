import { NextResponse } from 'next/server';
import { HederaService } from '@/app/services/hedera';

// Only run on server, not during build
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';


const hederaService = new HederaService();

export async function GET() {
  try {
    // TODO: Implement actual price history fetching from Hedera
    const mockHistory = {
      '0.0.123': [
        { timestamp: Date.now() - 3600000, price: 59000 },
        { timestamp: Date.now() - 1800000, price: 59500 },
        { timestamp: Date.now(), price: 60000 }
      ],
      '0.0.124': [
        { timestamp: Date.now() - 3600000, price: 2900 },
        { timestamp: Date.now() - 1800000, price: 2950 },
        { timestamp: Date.now(), price: 3000 }
      ]
    };

    return NextResponse.json(mockHistory);
  } catch (error) {
    console.error('Error fetching price history:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 