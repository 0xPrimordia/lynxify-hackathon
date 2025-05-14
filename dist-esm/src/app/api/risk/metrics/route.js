import { NextResponse } from 'next/server';
import { HederaService } from '@/app/services/hedera';
// Only run on server, not during build
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
const hederaService = new HederaService();
export async function GET() {
    try {
        // TODO: Implement actual risk metrics fetching from Hedera
        const mockMetrics = {
            volatility: 0.1,
            priceChange: 0.05,
            riskLevel: 'medium',
            affectedTokens: ['0.0.123', '0.0.124'],
            timestamp: Date.now()
        };
        return NextResponse.json(mockMetrics);
    }
    catch (error) {
        console.error('Error fetching risk metrics:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
