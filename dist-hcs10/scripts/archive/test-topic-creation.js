#!/usr/bin/env node
/**
 * Test script for topic creation with HCS10Client
 */
import { HCS10Client } from '@hashgraphonline/standards-sdk';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
// Get __dirname equivalent in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
async function testTopicCreation() {
    console.log('🧪 Testing topic creation with HCS10Client');
    try {
        // Initialize client
        console.log('📝 Initializing client...');
        const client = new HCS10Client({
            network: 'testnet',
            operatorId: process.env.NEXT_PUBLIC_OPERATOR_ID,
            operatorPrivateKey: process.env.OPERATOR_KEY,
            logLevel: 'debug'
        });
        console.log('✅ Client initialized');
        // Test topic creation with different variations
        console.log('\n📝 Testing standard topic creation...');
        try {
            const result1 = await client.createTopic();
            console.log('✅ Standard topic creation result:', result1);
        }
        catch (error) {
            console.error('❌ Standard topic creation failed:', error);
        }
        console.log('\n📝 Testing topic creation with memo...');
        try {
            const result2 = await client.createTopic({ memo: 'Test memo' });
            console.log('✅ Topic creation with memo result:', result2);
        }
        catch (error) {
            console.error('❌ Topic creation with memo failed:', error);
        }
        console.log('\n📝 Testing submitPayload for a new topic...');
        try {
            // Try using submitPayload instead
            const result3 = await client.submitPayload('0.0.0', {
                memo: 'Test topic created with submitPayload'
            });
            console.log('✅ submitPayload result:', result3);
        }
        catch (error) {
            console.error('❌ submitPayload failed:', error);
        }
        console.log('\n📝 Testing direct createInboundTopic...');
        try {
            const result4 = await client.createInboundTopic();
            console.log('✅ createInboundTopic result:', result4);
        }
        catch (error) {
            console.error('❌ createInboundTopic failed:', error);
        }
        console.log('\n✅ All topic creation tests completed');
    }
    catch (error) {
        console.error('❌ Fatal error:', error);
    }
}
// Run the test
testTopicCreation().catch(error => {
    console.error('❌ Unhandled error:', error);
    process.exit(1);
});
