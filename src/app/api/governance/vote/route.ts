import { NextResponse } from 'next/server';
import { HederaService } from '@/app/services/hedera';
import { RebalanceApproved } from '@/app/types/hcs';

// Only run on server, not during build
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';


const hederaService = new HederaService();

export async function POST(request: Request) {
  try {
    const vote: RebalanceApproved = await request.json();
    
    await hederaService.publishMessage(
      process.env.NEXT_PUBLIC_GOVERNANCE_TOPIC_ID!,
      vote
    );

    return NextResponse.json({ status: 'success' });
  } catch (error) {
    console.error('Error publishing vote:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 