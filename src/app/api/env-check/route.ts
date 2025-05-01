import { NextResponse } from 'next/server';

// Only run on server, not during build
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';


export async function GET() {
  // Check the environment variables
  const envStatus = {
    hasOperatorId: !!process.env.NEXT_PUBLIC_OPERATOR_ID,
    hasOperatorKey: !!process.env.OPERATOR_KEY,
    hasGovernanceTopic: !!process.env.NEXT_PUBLIC_HCS_GOVERNANCE_TOPIC,
    hasAgentTopic: !!process.env.NEXT_PUBLIC_HCS_AGENT_TOPIC,
    hasPriceFeedTopic: !!process.env.NEXT_PUBLIC_HCS_PRICE_FEED_TOPIC,
    
    governanceTopicValue: process.env.NEXT_PUBLIC_HCS_GOVERNANCE_TOPIC,
    agentTopicValue: process.env.NEXT_PUBLIC_HCS_AGENT_TOPIC,
    priceFeedTopicValue: process.env.NEXT_PUBLIC_HCS_PRICE_FEED_TOPIC,
    
    // Only show first and last few characters of sensitive info
    operatorIdPreview: maskString(process.env.NEXT_PUBLIC_OPERATOR_ID || ''),
    operatorKeyPreview: maskString(process.env.OPERATOR_KEY || ''),
  };

  // Log for server-side debugging
  console.log(`🔍 ENV CHECK: Environment variable status:`, envStatus);

  return NextResponse.json(envStatus);
}

function maskString(str: string): string {
  if (!str || str.length <= 8) return '******';
  return `${str.substring(0, 4)}...${str.substring(str.length - 4)}`;
} 