#!/usr/bin/env node

/**
 * Key Format Helper for Hedera SDK
 * This script helps diagnose and fix private key format issues
 * when working with the Hedera SDK and standards-sdk package.
 */

import dotenv from 'dotenv';
import fs from 'fs/promises';
import path from 'path';

// Load environment variables
dotenv.config({ path: '.env.local' });

const KEY_VAR_NAME = 'OPERATOR_KEY';

async function main() {
  try {
    console.log('🔑 Hedera SDK Key Format Helper');
    console.log('===============================');
    
    // Get the key from environment
    const privateKey = process.env[KEY_VAR_NAME];
    
    if (!privateKey) {
      console.error(`❌ No private key found in environment variable ${KEY_VAR_NAME}`);
      process.exit(1);
    }
    
    // Analyze the key
    console.log('🔍 Analyzing private key format...');
    console.log(`   Length: ${privateKey.length} characters`);
    
    // Check if it has the DER prefix (302e0201...)
    const isDERFormatted = privateKey.startsWith('302e020100300506032b6570');
    console.log(`   DER Formatted: ${isDERFormatted ? 'Yes' : 'No'}`);
    
    // Check if it's a plain hex string (64 hex chars)
    const isPlainHex = /^[0-9a-fA-F]{64}$/.test(privateKey);
    console.log(`   Plain Hex Format: ${isPlainHex ? 'Yes' : 'No'}`);
    
    // Show what formats the SDK typically accepts
    console.log('\n✅ Hedera SDK typically accepts:');
    console.log('   1. DER Encoded ED25519 Private Key (starts with 302e020100300506032b6570...)');
    console.log('   2. Plain 64-character hex string');
    
    // Generate the alternative format
    if (isDERFormatted) {
      // Extract the key part from DER format 
      // DER format structure: 302e020100300506032b6570 + 22 + 04 + 20 + actual key
      const actualKey = privateKey.substring(32 + 2 + 2 + 2); // Skip prefix, tags and lengths
      console.log('\n🔄 Extracted plain hex key:');
      console.log(`   ${actualKey}`);
      console.log('\n📝 To use this format in your code:');
      console.log(`   operatorKey: '${actualKey}'`);
    } else if (isPlainHex) {
      // Generate DER format from plain hex
      const derPrefix = '302e020100300506032b657004220420';
      const derFormatted = derPrefix + privateKey;
      console.log('\n🔄 DER formatted key:');
      console.log(`   ${derFormatted}`);
      console.log('\n📝 To use this format in your code:');
      console.log(`   operatorKey: '${derFormatted}'`);
    } else {
      console.log('\n⚠️ Your key is in an unrecognized format.');
      console.log('   This may cause issues with the Hedera SDK.');
      console.log('   Please check that you have the correct key format.');
    }
    
    // Provide usage guidance
    console.log('\n🚀 Usage recommendations:');
    console.log('   - For most JS SDKs: Use either format, but plain hex is simpler');
    console.log('   - For standards-sdk: Try both formats if one doesn\'t work');
    console.log('   - For the HCS10 agent: Update the agent-handler.mjs to use the format that works');
    
    // Exit successfully
    console.log('\n✅ Analysis complete');
  } catch (error) {
    console.error('❌ Error analyzing key:', error);
    process.exit(1);
  }
}

main().catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
}); 