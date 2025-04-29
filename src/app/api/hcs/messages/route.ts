import { NextResponse } from 'next/server';
import { hederaService } from '@/app/services/hedera';
import { HCSMessage } from '@/app/types/hcs';
import { TopicMessageQuery, TopicId } from '@hashgraph/sdk';
import messageStore from '@/app/services/message-store';

// Track whether we've subscribed to topics
let initializedTopics = false;

// Ensures subscription is only attempted once per server instance
async function initializeSubscriptions() {
  if (initializedTopics) {
    console.log('ℹ️ API: Topics already initialized, skipping subscription');
    return;
  }

  console.log('🔄 API: Initializing HCS topic subscriptions');
  
  const governanceTopicId = process.env.NEXT_PUBLIC_HCS_GOVERNANCE_TOPIC;
  const agentTopicId = process.env.NEXT_PUBLIC_HCS_AGENT_TOPIC;
  const priceFeedTopicId = process.env.NEXT_PUBLIC_HCS_PRICE_FEED_TOPIC;
  
  if (!governanceTopicId || !agentTopicId || !priceFeedTopicId) {
    console.error('❌ API: HCS topic IDs not configured');
    throw new Error('HCS topic IDs not configured');
  }
  
  // Subscribe to governance topic
  await hederaService.subscribeToTopic(governanceTopicId, (message: HCSMessage) => {
    console.log(`✅ API: Received message from governance topic: ${message.type}`);
    messageStore.addMessage(governanceTopicId, message);
  });
  
  // Subscribe to agent topic
  await hederaService.subscribeToTopic(agentTopicId, (message: HCSMessage) => {
    console.log(`✅ API: Received message from agent topic: ${message.type}`);
    messageStore.addMessage(agentTopicId, message);
  });
  
  // Subscribe to price feed topic
  await hederaService.subscribeToTopic(priceFeedTopicId, (message: HCSMessage) => {
    console.log(`✅ API: Received message from price feed topic: ${message.type}`);
    messageStore.addMessage(priceFeedTopicId, message);
  });
  
  initializedTopics = true;
  console.log('✅ API: Successfully subscribed to all HCS topics');
}

export async function GET() {
  try {
    const governanceTopicId = process.env.NEXT_PUBLIC_HCS_GOVERNANCE_TOPIC;
    const agentTopicId = process.env.NEXT_PUBLIC_HCS_AGENT_TOPIC;
    const priceFeedTopicId = process.env.NEXT_PUBLIC_HCS_PRICE_FEED_TOPIC;

    console.log('🔍 API GET: Fetching HCS messages with topic IDs:', {
      governanceTopic: governanceTopicId,
      agentTopic: agentTopicId,
      priceFeedTopic: priceFeedTopicId
    });

    if (!governanceTopicId || !agentTopicId || !priceFeedTopicId) {
      console.error('❌ API GET ERROR: HCS topic IDs not configured');
      throw new Error('HCS topic IDs not configured');
    }

    // Initialize subscriptions in a more controlled way
    await initializeSubscriptions();

    // Get all messages from the global message store
    const allMessages = messageStore.getAllMessages();
    
    // Log summary of messages
    console.log(`📤 API GET: Returning ${allMessages.length} messages from global store`);
    
    return NextResponse.json(allMessages);
  } catch (error) {
    console.error('❌ API GET ERROR: Error fetching HCS messages:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { action, proposalId, newWeights, executeAfter, quorum, trigger, justification } = body;
    
    console.log('📩 API: Received HCS message request:', { 
      action,
      proposalId,
      newWeightsTokens: newWeights ? Object.keys(newWeights) : [],
      executeAfter: executeAfter ? new Date(executeAfter).toISOString() : null,
      quorum,
      trigger,
      justificationLength: justification?.length
    });

    if (action === 'propose') {
      if (!newWeights || !executeAfter || !quorum) {
        console.error('⚠️ API: Missing required fields for proposal');
        return NextResponse.json({ error: 'Missing required fields for proposal' }, { status: 400 });
      }
      console.log('🔄 API: Calling proposeRebalance in HederaService...');
      await hederaService.proposeRebalance(newWeights, executeAfter, quorum, trigger, justification);
      console.log('✅ API: Successfully proposed rebalance!');
    } else if (action === 'execute') {
      if (!proposalId || !newWeights) {
        console.error('⚠️ API: Missing required fields for execution');
        return NextResponse.json({ error: 'Missing required fields for execution' }, { status: 400 });
      }
      console.log('🔄 API: Calling executeRebalance in HederaService...');
      await hederaService.executeRebalance(proposalId, newWeights);
      console.log('✅ API: Successfully executed rebalance!');
    } else if (action === 'approve') {
      if (!proposalId) {
        console.error('⚠️ API: Proposal ID is required');
        return NextResponse.json({ error: 'Proposal ID is required' }, { status: 400 });
      }
      console.log('🔄 API: Calling approveRebalance in HederaService...');
      await hederaService.approveRebalance(proposalId);
      console.log('✅ API: Successfully approved rebalance!');
    } else {
      console.error('⚠️ API: Invalid action requested:', action);
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    console.log('📤 API: Returning success response');
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('❌ API ERROR: Error processing proposal:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 