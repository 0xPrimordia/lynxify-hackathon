import { HederaService } from '../services/hedera';
import dotenv from 'dotenv';
import fs from 'fs';
dotenv.config();
async function initializeHCSTopics() {
    try {
        const hederaService = new HederaService();
        // Check if topics already exist
        const existingTopics = {
            governance: process.env.NEXT_PUBLIC_HCS_GOVERNANCE_TOPIC,
            agent: process.env.NEXT_PUBLIC_HCS_AGENT_TOPIC,
            priceFeed: process.env.NEXT_PUBLIC_HCS_PRICE_FEED_TOPIC
        };
        // Create topics if they don't exist
        if (!existingTopics.governance) {
            console.log('Creating governance topic...');
            const governanceTopicId = await hederaService.createGovernanceTopic();
            console.log('Governance topic created:', governanceTopicId);
            existingTopics.governance = governanceTopicId;
        }
        if (!existingTopics.agent) {
            console.log('Creating agent topic...');
            const agentTopicId = await hederaService.createAgentTopic();
            console.log('Agent topic created:', agentTopicId);
            existingTopics.agent = agentTopicId;
        }
        if (!existingTopics.priceFeed) {
            console.log('Creating price feed topic...');
            const priceFeedTopicId = await hederaService.createPriceFeedTopic();
            console.log('Price feed topic created:', priceFeedTopicId);
            existingTopics.priceFeed = priceFeedTopicId;
        }
        // Update .env.local with topic IDs
        const envContent = `
# HCS Topics
NEXT_PUBLIC_HCS_GOVERNANCE_TOPIC=${existingTopics.governance}
NEXT_PUBLIC_HCS_AGENT_TOPIC=${existingTopics.agent}
NEXT_PUBLIC_HCS_PRICE_FEED_TOPIC=${existingTopics.priceFeed}
    `.trim();
        fs.writeFileSync('.env.local', envContent);
        console.log('✅ Saved topic IDs to .env.local');
        console.log('HCS topics initialized successfully!');
    }
    catch (error) {
        console.error('Failed to initialize HCS topics:', error);
        process.exit(1);
    }
}
// Run initialization
initializeHCSTopics();
