#!/usr/bin/env node
/**
 * Connection Data Dump Script
 * 
 * This script extracts and displays detailed information about connections
 * from both local files and the ConnectionsManager to help diagnose
 * connection synchronization issues.
 */

import fs from 'fs/promises';
import path from 'path';
import dotenv from 'dotenv';
import { HCS10Client, ConnectionsManager } from '@hashgraphonline/standards-sdk';

// Load environment variables
dotenv.config({ path: '.env.local' });

// Paths for files
const CONNECTIONS_FILE = path.join(process.cwd(), '.connections.json');
const REGISTRATION_FILE = path.join(process.cwd(), '.registration_status.json');

async function main() {
  try {
    console.log('🔍 CONNECTION DATA DUMP');
    console.log('=======================\n');
    
    // Step 1: Load registration info
    console.log('🔄 Loading agent registration info...');
    let agentId, inboundTopicId, outboundTopicId;
    
    try {
      const registrationData = JSON.parse(
        await fs.readFile(REGISTRATION_FILE, 'utf8')
      );
      
      agentId = registrationData.accountId || process.env.NEXT_PUBLIC_HCS_AGENT_ID;
      inboundTopicId = registrationData.inboundTopicId || process.env.NEXT_PUBLIC_HCS_INBOUND_TOPIC;
      outboundTopicId = registrationData.outboundTopicId || process.env.NEXT_PUBLIC_HCS_OUTBOUND_TOPIC;
      
      console.log('✅ Agent registration info:');
      console.log(`   Agent ID: ${agentId}`);
      console.log(`   Inbound Topic: ${inboundTopicId}`);
      console.log(`   Outbound Topic: ${outboundTopicId}`);
    } catch (error) {
      console.error('❌ Error loading registration info:', error);
      agentId = process.env.NEXT_PUBLIC_HCS_AGENT_ID;
      inboundTopicId = process.env.NEXT_PUBLIC_HCS_INBOUND_TOPIC;
      outboundTopicId = process.env.NEXT_PUBLIC_HCS_OUTBOUND_TOPIC;
      
      console.log('Using environment variables:');
      console.log(`   Agent ID: ${agentId}`);
      console.log(`   Inbound Topic: ${inboundTopicId}`);
      console.log(`   Outbound Topic: ${outboundTopicId}`);
    }
    
    if (!agentId || !inboundTopicId || !outboundTopicId) {
      console.error('❌ Missing required agent configuration!');
      process.exit(1);
    }
    
    // Step 2: Load local connections from file
    console.log('\n🔄 Loading connections from local file...');
    let localConnections = [];
    try {
      const data = await fs.readFile(CONNECTIONS_FILE, 'utf8');
      localConnections = JSON.parse(data);
      console.log(`✅ Loaded ${localConnections.length} connections from local file`);
      
      console.log('\n=== Local Connection Data ===');
      localConnections.forEach((conn, i) => {
        console.log(`${i+1}. ID: ${conn.id}`);
        console.log(`   Topic ID: ${conn.connectionTopicId}`);
        console.log(`   Requester: ${conn.requesterId}`);
        console.log(`   Status: ${conn.status || 'unknown'}`);
        console.log(`   Established: ${new Date(conn.establishedAt).toISOString()}`);
        console.log('');
      });
    } catch (error) {
      console.error('❌ Error loading local connections:', error);
    }
    
    // Step 3: Create HCS10 client and ConnectionsManager
    console.log('\n🔄 Creating HCS10 client and ConnectionsManager...');
    const operatorId = process.env.NEXT_PUBLIC_OPERATOR_ID;
    const operatorKey = process.env.OPERATOR_KEY;
    
    if (!operatorId || !operatorKey) {
      console.error('❌ Missing required environment variables: NEXT_PUBLIC_OPERATOR_ID and OPERATOR_KEY');
      process.exit(1);
    }
    
    const client = new HCS10Client({
      network: 'testnet',
      operatorId,
      operatorPrivateKey: operatorKey,
      logLevel: 'info'
    });
    
    console.log('✅ HCS10 client created');
    
    const connectionsManager = new ConnectionsManager({ 
      baseClient: client 
    });
    console.log('✅ ConnectionsManager initialized');
    
    // Step 4: Fetch connections from mirror node
    console.log('\n🔄 Fetching connection data from mirror node...');
    try {
      const connections = await connectionsManager.fetchConnectionData(agentId);
      console.log(`✅ Loaded ${connections.length} connections from ConnectionsManager`);
      
      // Get pending connections
      const pendingRequests = connectionsManager.getPendingRequests();
      console.log(`🔍 Pending connection requests: ${pendingRequests.length}`);
      
      // Get active connections
      const activeConnections = connectionsManager.getActiveConnections();
      console.log(`🔍 Active connections: ${activeConnections.length}`);
      
      // Display all connections from ConnectionsManager
      console.log('\n=== Mirror Node Connection Data ===');
      connections.forEach((conn, i) => {
        console.log(`${i+1}. Topic ID: ${conn.connectionTopicId || 'unknown'}`);
        console.log(`   Target Account: ${conn.targetAccountId || 'unknown'}`);
        console.log(`   Status: ${conn.status || 'unknown'}`);
        console.log(`   Is Pending: ${conn.isPending}`);
        console.log(`   Request ID: ${conn.connectionRequestId || 'unknown'}`);
        console.log(`   Created: ${conn.created?.toISOString() || 'unknown'}`);
        console.log(`   Updated: ${conn.updated?.toISOString() || 'unknown'}`);
        console.log('');
      });
      
      // Show detailed info for pending connections
      if (pendingRequests.length > 0) {
        console.log('\n=== Pending Connection Details ===');
        pendingRequests.forEach((req, i) => {
          console.log(`${i+1}. Topic ID: ${req.connectionTopicId || 'unknown'}`);
          console.log(`   Target Account: ${req.targetAccountId || 'unknown'}`);
          console.log(`   Request ID: ${req.connectionRequestId || 'unknown'}`);
          console.log(`   Status: ${req.status || 'unknown'}`);
          console.log('');
        });
      }
      
      // Compare local vs mirror node connections
      console.log('\n=== Connection Data Comparison ===');
      console.log(`Local connections count: ${localConnections.length}`);
      console.log(`Mirror node connections count: ${connections.length}`);
      
      // Find discrepancies
      const localTopicIds = new Set(localConnections.map(c => c.connectionTopicId));
      const mirrorTopicIds = new Set(connections.map(c => c.connectionTopicId));
      
      const onlyInLocal = [...localTopicIds].filter(id => !mirrorTopicIds.has(id));
      const onlyInMirror = [...mirrorTopicIds].filter(id => !localTopicIds.has(id));
      
      console.log(`Connections only in local file: ${onlyInLocal.length}`);
      if (onlyInLocal.length > 0) {
        console.log(`   IDs: ${onlyInLocal.join(', ')}`);
      }
      
      console.log(`Connections only in mirror node: ${onlyInMirror.length}`);
      if (onlyInMirror.length > 0) {
        console.log(`   IDs: ${onlyInMirror.join(', ')}`);
      }
      
      // Status mismatches
      const commonIds = [...localTopicIds].filter(id => mirrorTopicIds.has(id));
      const statusMismatches = [];
      
      for (const id of commonIds) {
        const localConn = localConnections.find(c => c.connectionTopicId === id);
        const mirrorConn = connections.find(c => c.connectionTopicId === id);
        
        if (localConn && mirrorConn) {
          const localStatus = localConn.status || 'unknown';
          const mirrorStatus = mirrorConn.status || 'unknown';
          const mirrorIsPending = mirrorConn.isPending || false;
          
          if (localStatus !== mirrorStatus || 
              (localStatus === 'established' && mirrorIsPending)) {
            statusMismatches.push({
              id,
              localStatus,
              mirrorStatus,
              mirrorIsPending
            });
          }
        }
      }
      
      console.log(`Status mismatches: ${statusMismatches.length}`);
      if (statusMismatches.length > 0) {
        console.log('\n=== Status Mismatches ===');
        statusMismatches.forEach((mismatch, i) => {
          console.log(`${i+1}. Topic ID: ${mismatch.id}`);
          console.log(`   Local Status: ${mismatch.localStatus}`);
          console.log(`   Mirror Status: ${mismatch.mirrorStatus}`);
          console.log(`   Mirror isPending: ${mismatch.mirrorIsPending}`);
          console.log('');
        });
      }
      
    } catch (error) {
      console.error('❌ Error fetching connection data from mirror node:', error);
    }
    
  } catch (error) {
    console.error('❌ Error running connection data dump:', error);
    process.exit(1);
  }
}

// Run the main function
main().catch(console.error); 