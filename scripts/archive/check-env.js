#!/usr/bin/env node

/**
 * Environment Check Script
 * 
 * Checks if required environment variables for agent registration are properly set
 */

// Load environment variables
require('dotenv').config({ path: '.env.local' });

console.log('Environment Variables Check');
console.log('==========================');

// Check Hedera credentials
const operatorId = process.env.NEXT_PUBLIC_OPERATOR_ID;
const operatorKey = process.env.OPERATOR_KEY;
console.log(`NEXT_PUBLIC_OPERATOR_ID: ${operatorId ? '✅ Set' : '❌ Missing'}`);
console.log(`OPERATOR_KEY: ${operatorKey ? '✅ Set' : '❌ Missing'}`);

// Check HCS topics
const registryTopic = process.env.NEXT_PUBLIC_HCS_REGISTRY_TOPIC;
const governanceTopic = process.env.NEXT_PUBLIC_HCS_GOVERNANCE_TOPIC;
const agentTopic = process.env.NEXT_PUBLIC_HCS_AGENT_TOPIC;
console.log(`NEXT_PUBLIC_HCS_REGISTRY_TOPIC: ${registryTopic ? '✅ Set' : '❌ Missing'}`);
console.log(`NEXT_PUBLIC_HCS_GOVERNANCE_TOPIC: ${governanceTopic ? '✅ Set' : '❌ Missing'}`);
console.log(`NEXT_PUBLIC_HCS_AGENT_TOPIC: ${agentTopic ? '✅ Set' : '❌ Missing'}`);

// Check Moonscape URL
const moonscapeUrl = process.env.MOONSCAPE_REGISTRY_URL;
console.log(`MOONSCAPE_REGISTRY_URL: ${moonscapeUrl ? '✅ Set' : '⚠️ Not set (will use default)'}`);

console.log('\nSummary');
console.log('=======');
// Check if we can proceed with registration
const canRegister = operatorId && operatorKey && registryTopic;
if (canRegister) {
  console.log('✅ Required environment variables for agent registration are properly set.');
} else {
  console.log('❌ Missing required variables for agent registration.');
  console.log('\nRequired variables:');
  console.log('- NEXT_PUBLIC_OPERATOR_ID');
  console.log('- OPERATOR_KEY');
  console.log('- NEXT_PUBLIC_HCS_REGISTRY_TOPIC');
}

process.exit(canRegister ? 0 : 1); 