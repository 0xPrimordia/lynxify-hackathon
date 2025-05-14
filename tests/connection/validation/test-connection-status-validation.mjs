/**
 * Test: test-connection-status-validation
 * 
 * Purpose: Validates connection statuses in .connections.json and identifies
 * potential issues with connections that might prevent proper message handling.
 * 
 * Test procedure:
 * 1. Load the .connections.json file
 * 2. Validate each connection's format and status
 * 3. Create a detailed report of connection issues
 * 4. Optionally attempt to fix the most common issues
 * 
 * Expected results:
 * - Comprehensive report of connection statuses
 * - Identification of problematic connections
 * - Statistics on connection types and issues
 * 
 * Related components:
 * - HCS10AgentHandler
 * - ConnectionsManager
 * 
 * Author: Claude AI
 * Date: 2023-05-13
 */

import fs from 'fs/promises';
import path from 'path';
import dotenv from 'dotenv';
import { HCS10Client } from '@hashgraphonline/standards-sdk';
import { fileURLToPath } from 'url';

// Initialize environment
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.resolve(__dirname, '../../../.env.local');
dotenv.config({ path: envPath });

// Constants
const CONNECTIONS_FILE = path.resolve(process.cwd(), '.connections.json');
const REPORT_FILE = path.resolve(process.cwd(), 'connection-validation-report.json');
const HEDERA_ID_REGEX = /^0\.0\.\d+$/;
const FIX_CONNECTIONS = process.argv.includes('--fix');

// Initialize Hedera client for validation
async function initializeClient() {
  console.log('🔄 Initializing HCS10 client for validation...');
  try {
    if (!process.env.OPERATOR_KEY || !process.env.NEXT_PUBLIC_OPERATOR_ID) {
      throw new Error('Missing required environment variables: OPERATOR_KEY or NEXT_PUBLIC_OPERATOR_ID');
    }
    
    const client = new HCS10Client({
      network: process.env.NEXT_PUBLIC_NETWORK || 'testnet',
      operatorId: process.env.NEXT_PUBLIC_OPERATOR_ID,
      operatorPrivateKey: process.env.OPERATOR_KEY,
      logLevel: 'warn'
    });
    
    console.log('✅ HCS10 client initialized for validation');
    return client;
  } catch (error) {
    console.error('❌ Failed to initialize HCS10 client:', error);
    return null;
  }
}

// Load and validate connections
async function validateConnections() {
  console.log(`🔄 Loading connections from ${CONNECTIONS_FILE}...`);
  
  try {
    // Read connections file
    const data = await fs.readFile(CONNECTIONS_FILE, 'utf8');
    let connections;
    try {
      connections = JSON.parse(data);
      console.log(`✅ Loaded ${connections.length} connections`);
    } catch (error) {
      console.error('❌ Failed to parse connections file:', error);
      return null;
    }
    
    // Initialize validation statistics
    const stats = {
      total: connections.length,
      established: 0,
      pending: 0,
      invalid: 0,
      missingTopicId: 0,
      invalidTopicFormat: 0,
      duplicates: 0,
      fixed: 0
    };
    
    // Map to track duplicate connections
    const connectionMap = new Map();
    const duplicates = [];
    
    // Process each connection
    const validationResults = connections.map((conn, index) => {
      const result = {
        index,
        id: conn.id || conn.connectionId || `connection-${index}`,
        status: conn.status || 'unknown',
        connectionTopicId: conn.connectionTopicId || null,
        targetAccountId: conn.targetAccountId || null,
        issues: [],
        isValid: true
      };
      
      // Check status
      if (conn.status === 'established') {
        stats.established++;
      } else if (conn.status === 'pending') {
        stats.pending++;
        result.issues.push('Connection is in pending state');
        result.isValid = false;
      } else {
        stats.invalid++;
        result.issues.push(`Invalid status: ${conn.status}`);
        result.isValid = false;
      }
      
      // Check connection topic ID
      if (!conn.connectionTopicId) {
        stats.missingTopicId++;
        result.issues.push('Missing connectionTopicId');
        result.isValid = false;
      } else if (!HEDERA_ID_REGEX.test(conn.connectionTopicId)) {
        stats.invalidTopicFormat++;
        result.issues.push(`Invalid connectionTopicId format: ${conn.connectionTopicId}`);
        result.isValid = false;
      }
      
      // Check for duplicate connection topics
      if (conn.connectionTopicId) {
        if (connectionMap.has(conn.connectionTopicId)) {
          stats.duplicates++;
          const existingIndex = connectionMap.get(conn.connectionTopicId);
          result.issues.push(`Duplicate connection with index ${existingIndex}`);
          duplicates.push({
            topicId: conn.connectionTopicId,
            indices: [existingIndex, index]
          });
          result.isValid = false;
        } else {
          connectionMap.set(conn.connectionTopicId, index);
        }
      }
      
      return result;
    });
    
    // Generate report
    const report = {
      timestamp: new Date().toISOString(),
      statistics: stats,
      validConnections: validationResults.filter(c => c.isValid),
      invalidConnections: validationResults.filter(c => !c.isValid),
      duplicateConnections: duplicates
    };
    
    // Save report to file
    await fs.writeFile(REPORT_FILE, JSON.stringify(report, null, 2));
    console.log(`✅ Validation report saved to ${REPORT_FILE}`);
    
    // Output summary
    console.log('\n========== CONNECTION VALIDATION SUMMARY ==========');
    console.log(`Total connections: ${stats.total}`);
    console.log(`Established: ${stats.established}`);
    console.log(`Pending: ${stats.pending}`);
    console.log(`Invalid: ${stats.invalid}`);
    console.log(`Missing topic IDs: ${stats.missingTopicId}`);
    console.log(`Invalid topic formats: ${stats.invalidTopicFormat}`);
    console.log(`Duplicate connections: ${stats.duplicates}`);
    
    // Fix connections if requested
    if (FIX_CONNECTIONS && (stats.pending > 0 || stats.duplicates > 0)) {
      await fixConnections(connections, duplicates, validationResults);
      console.log(`✅ Fixed ${stats.fixed} connection issues`);
    }
    
    return report;
  } catch (error) {
    console.error('❌ Failed to validate connections:', error);
    return null;
  }
}

// Fix common connection issues
async function fixConnections(connections, duplicates, validationResults) {
  console.log('🔄 Attempting to fix connection issues...');
  
  // Create a backup of the original file
  await fs.copyFile(CONNECTIONS_FILE, `${CONNECTIONS_FILE}.backup`);
  console.log(`✅ Created backup at ${CONNECTIONS_FILE}.backup`);
  
  const fixedConnections = [...connections];
  let fixCount = 0;
  
  // Fix duplicate connections (keep the most recent one)
  for (const dup of duplicates) {
    const indices = dup.indices.sort((a, b) => b - a); // Sort in descending order
    
    // Keep the first one, remove the rest
    for (let i = 1; i < indices.length; i++) {
      fixedConnections.splice(indices[i], 1);
      fixCount++;
    }
    console.log(`✅ Removed ${indices.length - 1} duplicate connections for topic ${dup.topicId}`);
  }
  
  // Fix pending connections
  for (let i = 0; i < fixedConnections.length; i++) {
    const conn = fixedConnections[i];
    if (conn.status === 'pending' && conn.connectionTopicId) {
      conn.status = 'established';
      fixCount++;
      console.log(`✅ Changed connection ${i} status from pending to established`);
    }
  }
  
  // Write fixed connections back to file
  await fs.writeFile(CONNECTIONS_FILE, JSON.stringify(fixedConnections, null, 2));
  console.log(`✅ Saved ${fixedConnections.length} connections to ${CONNECTIONS_FILE}`);
  
  return fixCount;
}

// Verify topic existence
async function verifyTopics(client, report) {
  if (!client) return;
  
  console.log('🔄 Verifying topic existence on Hedera network...');
  const validConnections = report.validConnections;
  let verifiedCount = 0;
  let failedCount = 0;
  
  for (const conn of validConnections) {
    if (!conn.connectionTopicId) continue;
    
    try {
      console.log(`🔄 Verifying topic ${conn.connectionTopicId}...`);
      const response = await client.getMessageStream(conn.connectionTopicId, { limit: 1 });
      
      // If we get here, the topic exists
      verifiedCount++;
      console.log(`✅ Topic ${conn.connectionTopicId} exists`);
    } catch (error) {
      failedCount++;
      console.error(`❌ Failed to verify topic ${conn.connectionTopicId}:`, error.message);
      conn.issues.push(`Topic does not exist or is inaccessible: ${error.message}`);
      conn.isValid = false;
    }
  }
  
  console.log(`✅ Topic verification complete: ${verifiedCount} verified, ${failedCount} failed`);
}

// Main function
async function main() {
  console.log('========== HCS-10 CONNECTION VALIDATION ==========');
  
  try {
    // Initialize the client
    const client = await initializeClient();
    
    // Validate connections
    const report = await validateConnections();
    
    // Verify topics (optional, can be slow)
    if (client && report && process.argv.includes('--verify-topics')) {
      await verifyTopics(client, report);
    }
    
    console.log('========== VALIDATION COMPLETE ==========');
  } catch (error) {
    console.error('❌ Validation failed:', error);
  }
}

// Run the script
main().catch(console.error); 