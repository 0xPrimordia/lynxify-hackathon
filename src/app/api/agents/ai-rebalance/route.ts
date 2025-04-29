import { NextRequest, NextResponse } from 'next/server';
import { AIRebalanceAgent } from '@/app/services/agents/ai-rebalance-agent';
import { hederaService } from '@/app/services/hedera';

// Mock market data for demo purposes
const marketData = {
  prices: {
    HBAR: 0.12,
    WBTC: 60000,
    WETH: 3500,
    USDC: 1.0,
    USDT: 1.0,
    DAI: 1.0,
    SAUCE: 0.5,
    HBARX: 0.15
  },
  priceChanges: {
    HBAR: 2.5,
    WBTC: -1.2,
    WETH: 0.8,
    USDC: 0.01,
    USDT: 0.0,
    DAI: -0.02,
    SAUCE: 5.0,
    HBARX: 3.2
  },
  volumes: {
    HBAR: 50000000,
    WBTC: 150000000,
    WETH: 75000000,
    USDC: 100000000,
    USDT: 95000000,
    DAI: 40000000,
    SAUCE: 5000000,
    HBARX: 8000000
  },
  volatility: {
    HBAR: 0.05,
    WBTC: 0.04,
    WETH: 0.05,
    USDC: 0.001,
    USDT: 0.001,
    DAI: 0.002,
    SAUCE: 0.08,
    HBARX: 0.06
  }
};

export async function POST(req: NextRequest) {
  try {
    // Parse the request body
    const body = await req.json();
    
    // Get current treasury state if provided
    const currentTreasury = body.currentTreasury;
    
    // Create an AI rebalance agent instance
    const aiAgent = new AIRebalanceAgent();
    
    // Update with market data
    aiAgent.updateMarketData(marketData);
    
    // Update treasury state if provided
    if (currentTreasury) {
      aiAgent.updateTreasuryState(currentTreasury);
    }
    
    try {
      // Generate a rebalance proposal
      const { newWeights, analysis } = await aiAgent.generateRebalanceProposal();
      
      if (!newWeights) {
        throw new Error('Failed to generate weights for rebalance proposal');
      }
      
      // Submit to HCS using Hedera service
      const proposalId = await proposeRebalanceToHCS(newWeights, analysis || '');
      
      return NextResponse.json({
        success: true,
        message: 'Rebalance proposal generated and submitted to Hedera Consensus Service',
        proposal: {
          newWeights,
          analysis,
          proposalId
        }
      });
    } catch (error) {
      console.error('Error generating rebalance proposal:', error);
      
      return NextResponse.json({
        success: false,
        message: error instanceof Error 
          ? `Failed to generate rebalance proposal: ${error.message}` 
          : 'Failed to generate rebalance proposal',
      });
    }
  } catch (error) {
    console.error('Error processing rebalance request:', error);
    
    return NextResponse.json({
      success: false,
      message: 'An error occurred processing the rebalance request',
    }, { status: 500 });
  }
}

// Helper function to submit proposal to HCS
async function proposeRebalanceToHCS(newWeights: Record<string, number>, analysis: string) {
  try {
    // Set execution parameters
    const executeAfter = Date.now() + (24 * 60 * 60 * 1000); // 24 hours from now
    const quorum = 5000; // Required voting power
    
    // Submit proposal to HCS using proposeRebalance
    const result = await hederaService.proposeRebalance(
      newWeights,
      executeAfter,
      quorum,
      'scheduled',
      analysis
    );
    
    console.log('Proposal submitted to HCS');
    return result;
  } catch (error) {
    console.error('Error submitting proposal to HCS:', error);
    throw error;
  }
} 