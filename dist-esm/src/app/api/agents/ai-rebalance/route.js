import { NextResponse } from 'next/server';
import { aiRebalanceAgent } from '@/app/services/agents/ai-rebalance-agent';
import { hederaService } from '@/app/services/hedera';
import { TokenService } from '@/app/services/token-service';
// Mock market data for demo purposes - UPDATED with correct token symbols
const marketData = {
    prices: {
        BTC: 65000,
        ETH: 3000,
        SOL: 150,
        'Lynxify-Index': 10
    },
    priceChanges: {
        BTC: 2.5,
        ETH: -1.2,
        SOL: 5.8,
        'Lynxify-Index': 1.5
    },
    volumes: {
        BTC: 50000000,
        ETH: 30000000,
        SOL: 10000000,
        'Lynxify-Index': 1000000
    },
    volatility: {
        BTC: 0.05,
        ETH: 0.07,
        SOL: 0.09,
        'Lynxify-Index': 0.03
    }
};
export async function POST(request) {
    try {
        // Parse request body
        const body = await request.json();
        // Generate rebalance proposal using AI
        const proposal = await aiRebalanceAgent.generateRebalanceProposal();
        if (!proposal.success || !proposal.newWeights) {
            return NextResponse.json({
                success: false,
                message: proposal.message || 'Failed to generate rebalance proposal'
            }, { status: 400 });
        }
        // Get token service and valid tokens
        const tokenService = new TokenService();
        const validTokens = Object.keys(tokenService.getAllTokenIds());
        // Filter weights to only include valid tokens that exist in token-data.json
        const filteredWeights = {};
        // First pass: get only valid tokens
        let totalWeight = 0;
        for (const [token, weight] of Object.entries(proposal.newWeights)) {
            if (validTokens.includes(token)) {
                filteredWeights[token] = weight;
                totalWeight += weight;
            }
        }
        // Second pass: normalize weights to sum to 1.0
        for (const token of Object.keys(filteredWeights)) {
            filteredWeights[token] = filteredWeights[token] / totalWeight;
        }
        console.log('Filtered weights to include only valid tokens:', filteredWeights);
        // Default values if not provided
        const executeAfter = body.executeAfter || Date.now() + (24 * 60 * 60 * 1000); // Default 24h from now
        const quorum = body.quorum || 5000; // Default quorum value
        const trigger = body.trigger || 'scheduled'; // Default trigger type
        // Submit proposal to HCS
        await hederaService.proposeRebalance(filteredWeights, executeAfter, quorum, trigger, proposal.analysis || 'AI-generated rebalance proposal for optimal asset allocation');
        return NextResponse.json({
            success: true,
            message: 'Proposal submitted to HCS',
            proposal: {
                newWeights: filteredWeights,
                executeAfter,
                quorum,
                trigger,
                analysis: proposal.analysis
            }
        });
    }
    catch (error) {
        console.error('Error in AI rebalance proposal:', error);
        return NextResponse.json({
            success: false,
            message: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 });
    }
}
// Helper function to submit proposal to HCS
async function proposeRebalanceToHCS(newWeights, analysis) {
    try {
        // Set execution parameters
        const executeAfter = Date.now() + (24 * 60 * 60 * 1000); // 24 hours from now
        const quorum = 5000; // Required voting power
        // Submit proposal to HCS using proposeRebalance
        const result = await hederaService.proposeRebalance(newWeights, executeAfter, quorum, 'scheduled', analysis);
        console.log('Proposal submitted to HCS');
        return result;
    }
    catch (error) {
        console.error('Error submitting proposal to HCS:', error);
        throw error;
    }
}
