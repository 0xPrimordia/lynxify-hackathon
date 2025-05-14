#!/usr/bin/env node

/**
 * HCS-10 Protocol Transaction Pattern Validator
 * 
 * This script focuses on testing whether different transaction patterns
 * (direct execute vs freeze+sign) are required for topics with and without submit keys.
 */

import dotenv from 'dotenv';
import fs from 'node:fs';
import { Client, PrivateKey, TopicMessageSubmitTransaction, TopicId, TopicInfoQuery } from '@hashgraph/sdk';

// Load environment variables
try {
  if (fs.existsSync('./.env.local')) {
    dotenv.config({ path: './.env.local' });
    console.log('✅ Loaded environment variables from .env.local');
  } else {
    dotenv.config();
    console.log('⚠️ No .env.local file found, using default .env');
  }
} catch (error) {
  console.error('Error loading environment variables:', error);
  process.exit(1);
}

// Environment Variables
const operatorId = process.env.NEXT_PUBLIC_OPERATOR_ID;
const operatorKey = process.env.OPERATOR_KEY;
const inboundTopicId = process.env.NEXT_PUBLIC_HCS_INBOUND_TOPIC; 
const outboundTopicId = process.env.NEXT_PUBLIC_HCS_OUTBOUND_TOPIC;

if (!operatorId || !operatorKey || !inboundTopicId || !outboundTopicId) {
  console.error('Missing required environment variables. Check your .env file.');
  process.exit(1);
}

// Create the Hedera client with the ED25519 key
const client = Client.forTestnet();
const privateKey = PrivateKey.fromStringED25519(operatorKey);
client.setOperator(operatorId, privateKey);

/**
 * Gets topic information, particularly whether it has a submit key
 */
async function getTopicInfo(topicId) {
  console.log(`\nExamining topic ${topicId}...`);
  
  try {
    const info = await new TopicInfoQuery()
      .setTopicId(TopicId.fromString(topicId))
      .execute(client);
    
    const hasSubmitKey = info.submitKey ? true : false;
    
    console.log(`Topic ${topicId}:`);
    console.log(`- Submit Key: ${hasSubmitKey ? 'PRESENT' : 'NONE'}`);
    
    return { hasSubmitKey, info };
  } catch (error) {
    console.error(`Error getting topic info: ${error}`);
    return { hasSubmitKey: null, error };
  }
}

/**
 * Test direct execute pattern on a topic
 */
async function testDirectExecute(topicId) {
  console.log(`\nTesting DIRECT EXECUTE pattern on topic ${topicId}...`);
  
  try {
    const transaction = new TopicMessageSubmitTransaction()
      .setTopicId(TopicId.fromString(topicId))
      .setMessage(`Direct execute test: ${Date.now()}`);
    
    const response = await transaction.execute(client);
    await response.getReceipt(client);
    
    console.log(`✅ SUCCEEDED: Direct execute pattern worked on topic ${topicId}`);
    return { success: true };
  } catch (error) {
    const errorMessage = error.toString();
    const isInvalidSignature = errorMessage.includes('INVALID_SIGNATURE');
    
    console.error(`❌ FAILED: Direct execute pattern failed on topic ${topicId}`);
    console.error(`   Error: ${isInvalidSignature ? 'INVALID_SIGNATURE' : errorMessage}`);
    
    return { success: false, error: errorMessage, isInvalidSignature };
  }
}

/**
 * Test freeze+sign pattern on a topic
 */
async function testFreezeSign(topicId) {
  console.log(`\nTesting FREEZE+SIGN pattern on topic ${topicId}...`);
  
  try {
    const transaction = new TopicMessageSubmitTransaction()
      .setTopicId(TopicId.fromString(topicId))
      .setMessage(`Freeze+sign test: ${Date.now()}`);
    
    const frozenTx = await transaction.freezeWith(client);
    const signedTx = await frozenTx.sign(privateKey);
    const response = await signedTx.execute(client);
    await response.getReceipt(client);
    
    console.log(`✅ SUCCEEDED: Freeze+sign pattern worked on topic ${topicId}`);
    return { success: true };
  } catch (error) {
    console.error(`❌ FAILED: Freeze+sign pattern failed on topic ${topicId}`);
    console.error(`   Error: ${error}`);
    
    return { success: false, error: error.toString() };
  }
}

/**
 * Run all tests for a topic
 */
async function testTopic(topicId, description) {
  console.log(`\n============== Testing ${description} Topic (${topicId}) ==============`);
  
  // Get topic info
  const { hasSubmitKey } = await getTopicInfo(topicId);
  
  if (hasSubmitKey === null) {
    console.error(`Cannot run tests for ${description} topic - failed to get topic info`);
    return null;
  }
  
  // Run pattern tests
  const directResult = await testDirectExecute(topicId);
  const freezeSignResult = await testFreezeSign(topicId);
  
  return {
    topicId,
    description,
    hasSubmitKey,
    directExecute: directResult,
    freezeSign: freezeSignResult
  };
}

/**
 * Evaluate test results
 */
function evaluateResults(inboundResults, outboundResults) {
  console.log('\n============== EVALUATION ==============');
  
  if (!inboundResults || !outboundResults) {
    console.error('Cannot evaluate results - missing test data');
    return;
  }
  
  console.log('\nTopic Configuration:');
  console.log(`- Inbound Topic: ${inboundResults.hasSubmitKey ? 'HAS submit key' : 'NO submit key'}`);
  console.log(`- Outbound Topic: ${outboundResults.hasSubmitKey ? 'HAS submit key' : 'NO submit key'}`);
  
  console.log('\nTransaction Pattern Results:');
  console.log('- Inbound Topic:');
  console.log(`  * Direct Execute: ${inboundResults.directExecute.success ? '✅ WORKS' : '❌ FAILS'}`);
  console.log(`  * Freeze+Sign: ${inboundResults.freezeSign.success ? '✅ WORKS' : '❌ FAILS'}`);
  
  console.log('- Outbound Topic:');
  console.log(`  * Direct Execute: ${outboundResults.directExecute.success ? '✅ WORKS' : '❌ FAILS'}`);
  if (!outboundResults.directExecute.success && outboundResults.directExecute.isInvalidSignature) {
    console.log('    > Failed with INVALID_SIGNATURE (expected for topics WITH submit key)');
  }
  console.log(`  * Freeze+Sign: ${outboundResults.freezeSign.success ? '✅ WORKS' : '❌ FAILS'}`);
  
  // Verify our hypothesis
  const expectedPattern = {
    inbound: {
      // Topics without submit keys should work with either pattern
      noSubmitKey: !inboundResults.hasSubmitKey,
      directWorks: inboundResults.directExecute.success,
      freezeSignWorks: inboundResults.freezeSign.success
    },
    outbound: {
      // Topics with submit keys should require freeze+sign
      hasSubmitKey: outboundResults.hasSubmitKey,
      directFails: !outboundResults.directExecute.success,
      freezeSignWorks: outboundResults.freezeSign.success
    }
  };
  
  const hypothesisConfirmed = 
    expectedPattern.inbound.noSubmitKey && 
    expectedPattern.inbound.directWorks &&
    expectedPattern.outbound.hasSubmitKey && 
    expectedPattern.outbound.directFails && 
    expectedPattern.outbound.freezeSignWorks;
  
  console.log('\n============== CONCLUSION ==============');
  console.log(`Hypothesis ${hypothesisConfirmed ? '✅ CONFIRMED' : '❌ REJECTED'}:`);
  
  if (hypothesisConfirmed) {
    console.log('\n1. Topics WITHOUT submit keys (inbound):');
    console.log('   - Can use direct execution pattern ✓');
    console.log('   - Can also use freeze+sign pattern ✓');
    
    console.log('\n2. Topics WITH submit keys (outbound):');
    console.log('   - Cannot use direct execution (fails with INVALID_SIGNATURE) ✓');
    console.log('   - Must use freeze+sign pattern ✓');
    
    console.log('\nIMPLICATION: Our implementation must check for submit key presence and:');
    console.log('- Use direct execution for topics without submit key (simple, efficient)');
    console.log('- Use freeze+sign for topics with submit key (required for security)');
  } else {
    console.log('Results do not match our expectations. Review the specific test outcomes.');
  }
  
  // Save results to file
  try {
    const results = {
      inboundTopic: inboundResults,
      outboundTopic: outboundResults,
      hypothesisConfirmed
    };
    
    fs.writeFileSync(
      './protocol-validation-results.json', 
      JSON.stringify(results, null, 2)
    );
    
    console.log('\nDetailed results saved to protocol-validation-results.json');
  } catch (error) {
    console.error('Error saving results:', error);
  }
}

/**
 * Main function
 */
async function main() {
  console.log('======================================');
  console.log(' HCS-10 TRANSACTION PATTERN VALIDATOR');
  console.log('======================================\n');
  
  try {
    console.log(`Using operator account: ${operatorId}`);
    
    // Test both topics
    const inboundResults = await testTopic(inboundTopicId, 'Inbound');
    const outboundResults = await testTopic(outboundTopicId, 'Outbound');
    
    // Evaluate results
    evaluateResults(inboundResults, outboundResults);
    
  } catch (error) {
    console.error('Error running validation:', error);
  }
}

// Run the main function
main().catch(console.error); 