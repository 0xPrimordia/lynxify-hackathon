#!/usr/bin/env node

import fetch from 'node-fetch';

/**
 * Main function to test API endpoints
 */
async function main() {
  try {
    console.log('🔧 Starting API endpoint test...');
    
    // Test the connections/approve endpoint
    const baseUrl = 'http://localhost:3000'; // Change to your actual URL if testing deployed version
    
    // Test 1: GET /api/connections
    console.log('\n🔄 Testing GET /api/connections...');
    try {
      const connectionsResponse = await fetch(`${baseUrl}/api/connections`);
      console.log(`Status: ${connectionsResponse.status}`);
      if (connectionsResponse.ok) {
        const data = await connectionsResponse.json();
        console.log('Response:', JSON.stringify(data, null, 2));
      } else {
        console.log('Error response:', await connectionsResponse.text());
      }
    } catch (error) {
      console.error('❌ Error testing /api/connections:', error.message);
    }
    
    // Test 2: GET /api/connections/pending
    console.log('\n🔄 Testing GET /api/connections/pending...');
    try {
      const pendingResponse = await fetch(`${baseUrl}/api/connections/pending`);
      console.log(`Status: ${pendingResponse.status}`);
      if (pendingResponse.ok) {
        const data = await pendingResponse.json();
        console.log('Response:', JSON.stringify(data, null, 2));
      } else {
        console.log('Error response:', await pendingResponse.text());
      }
    } catch (error) {
      console.error('❌ Error testing /api/connections/pending:', error.message);
    }
    
    // Test 3: POST /api/connections/approve with a connectionId
    console.log('\n🔄 Testing POST /api/connections/approve...');
    try {
      const approveResponse = await fetch(`${baseUrl}/api/connections/approve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          connectionId: '0.0.5988861' // Use a valid connection ID from your test
        })
      });
      console.log(`Status: ${approveResponse.status}`);
      if (approveResponse.ok) {
        const data = await approveResponse.json();
        console.log('Response:', JSON.stringify(data, null, 2));
      } else {
        console.log('Error response:', await approveResponse.text());
      }
    } catch (error) {
      console.error('❌ Error testing /api/connections/approve:', error.message);
    }
    
    // Test 4: POST /api/agent/connections/approve with a connectionId
    console.log('\n🔄 Testing POST /api/agent/connections/approve...');
    try {
      const agentApproveResponse = await fetch(`${baseUrl}/api/agent/connections/approve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          connectionId: '0.0.5988861' // Use a valid connection ID from your test
        })
      });
      console.log(`Status: ${agentApproveResponse.status}`);
      if (agentApproveResponse.ok) {
        const data = await agentApproveResponse.json();
        console.log('Response:', JSON.stringify(data, null, 2));
      } else {
        console.log('Error response:', await agentApproveResponse.text());
      }
    } catch (error) {
      console.error('❌ Error testing /api/agent/connections/approve:', error.message);
    }
    
    // Test 5: Does agent/connections/approve work with a trailing slash
    console.log('\n🔄 Testing POST /api/agent/connections/approve/ (with trailing slash)...');
    try {
      const approveSlashResponse = await fetch(`${baseUrl}/api/agent/connections/approve/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          connectionId: '0.0.5988861' // Use a valid connection ID from your test
        })
      });
      console.log(`Status: ${approveSlashResponse.status}`);
      if (approveSlashResponse.ok) {
        const data = await approveSlashResponse.json();
        console.log('Response:', JSON.stringify(data, null, 2));
      } else {
        console.log('Error response:', await approveSlashResponse.text());
      }
    } catch (error) {
      console.error('❌ Error testing /api/agent/connections/approve/:', error.message);
    }
    
    console.log('\n✅ API endpoint test completed');
  } catch (error) {
    console.error('❌ Fatal error testing API endpoints:', error);
    process.exit(1);
  }
}

// Run the main function
main().catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
}); 