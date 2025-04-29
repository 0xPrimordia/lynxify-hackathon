require('dotenv').config({ path: '.env.local' });
// Temporarily modify environment variable check behavior
process.env.BYPASS_TOPIC_CHECK = 'true';
const { HederaService } = require('../services/hedera');

async function initializeHCSTopics() {
  try {
    const hederaService = new HederaService();
    
    console.log('Creating governance topic...');
    const governanceTopicId = await hederaService.createGovernanceTopic();
    console.log('Governance topic created:', governanceTopicId);
    
    console.log('Creating agent topic...');
    const agentTopicId = await hederaService.createAgentTopic();
    console.log('Agent topic created:', agentTopicId);
    
    console.log('Creating price feed topic...');
    const priceFeedTopicId = await hederaService.createPriceFeedTopic();
    console.log('Price feed topic created:', priceFeedTopicId);
    
    console.log('HCS topics initialized successfully!');
    console.log('Please save these topic IDs in your .env.local file:');
    console.log(`NEXT_PUBLIC_HCS_GOVERNANCE_TOPIC=${governanceTopicId}`);
    console.log(`NEXT_PUBLIC_HCS_AGENT_TOPIC=${agentTopicId}`);
    console.log(`NEXT_PUBLIC_HCS_PRICE_FEED_TOPIC=${priceFeedTopicId}`);
  } catch (error) {
    console.error('Failed to initialize HCS topics:', error);
    process.exit(1);
  }
}

initializeHCSTopics(); 