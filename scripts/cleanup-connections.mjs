#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { HCS10Client } from '@hashgraphonline/standards-sdk';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Paths for files
const CONNECTIONS_FILE = path.join(process.cwd(), '.connections.json');

/**
 * Main cleanup function
 */
async function main() {
  try {
    console.log('🧹 Starting connections cleanup...');
    
    // Check if connections file exists
    if (!fs.existsSync(CONNECTIONS_FILE)) {
      console.log('ℹ️ No connections file found, nothing to clean up.');
      process.exit(0);
    }
    
    // Read connections file
    const data = fs.readFileSync(CONNECTIONS_FILE, 'utf8');
    let connections = JSON.parse(data);
    
    console.log(`Found ${connections.length} connections in file`);
    
    // Create a new HCS10Client for cleanup
    const client = new HCS10Client({
      network: process.env.HEDERA_NETWORK || 'testnet',
      operatorId: process.env.HEDERA_OPERATOR_ID,
      operatorPrivateKey: process.env.HEDERA_OPERATOR_KEY,
      logLevel: 'info',
    });
    
    // Create a backup of the connections file
    const backupFilePath = `${CONNECTIONS_FILE}.backup-${Date.now()}`;
    fs.writeFileSync(backupFilePath, data);
    console.log(`📦 Created backup of connections file at ${backupFilePath}`);
    
    // Reset connections file to empty array
    fs.writeFileSync(CONNECTIONS_FILE, '[]');
    console.log('🔄 Reset connections file to empty array');
    
    console.log('✅ Cleanup complete!');
    console.log('ℹ️ New connections will be created as needed.');
    
  } catch (error) {
    console.error('❌ Error during cleanup:', error);
    process.exit(1);
  }
}

main().catch(error => {
  console.error('❌ Unhandled error:', error);
  process.exit(1);
}); 