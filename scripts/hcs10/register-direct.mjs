import dotenv from 'dotenv';
import fs from 'fs/promises';
import { HCS10Client } from '@hashgraphonline/standards-sdk';

// Load environment variables from .env.local
dotenv.config({ path: '.env.local' });

/**
 * Register a new HCS-10 agent with Moonscape
 * This function will create new topics on Hedera and register the agent with Moonscape
 */
async function registerHCS10Agent() {
  try {
    console.log('🚀 Starting fresh HCS-10 agent registration with direct approach...');

    // Get credentials from environment
    const operatorId = process.env.NEXT_PUBLIC_OPERATOR_ID;
    const operatorKey = process.env.OPERATOR_KEY;
    
    if (!operatorId || !operatorKey) {
      throw new Error('Missing required environment variables: NEXT_PUBLIC_OPERATOR_ID and OPERATOR_KEY');
    }
    
    console.log(`Using Hedera account: ${operatorId}`);

    // Delete any existing registration file to ensure a clean start
    try {
      await fs.unlink('.registration_status.json');
      console.log('✅ Removed existing registration file to start fresh');
    } catch (error) {
      console.log('✅ No existing registration file found - starting fresh');
    }
    
    // Initialize the HCS10 client with explicit parameter parsing
    console.log('🔄 Creating HCS10 client with string parameters...');
    
    // Convert all parameters to strings to avoid type-related issues
    const clientConfig = {
      network: 'testnet',
      operatorId: String(operatorId),
      operatorPrivateKey: String(operatorKey),
      logLevel: 'debug'
    };
    
    console.log('Client config:', JSON.stringify({
      ...clientConfig,
      operatorPrivateKey: '***REDACTED***'
    }, null, 2));
    
    const hcs10Client = new HCS10Client(clientConfig);
    
    console.log('✅ HCS10 client created successfully');
    
    // Register the agent with custom agent parameters
    console.log('🔄 Registering agent with Moonscape (creating new topics)...');
    
    const timestamp = new Date().toISOString();
    const agentParams = {
      displayName: `Direct Test Agent ${timestamp}`,
      description: "A brand new agent created with direct parameter approach",
      memo: "Direct HCS-10 Test - " + timestamp
    };
    
    console.log('Using agent parameters:', JSON.stringify(agentParams, null, 2));
    
    // This is the CRITICAL step that creates the topics
    const agentInfo = await hcs10Client.registerAgent(agentParams);
    
    console.log('✅ Agent registered successfully!');
    console.log('📝 Agent details:', JSON.stringify(agentInfo, null, 2));
    
    // Save the topic IDs and agent information to environment file
    await updateEnvFile({
      HCS10_AGENT_ID: agentInfo.agentId,
      HCS10_INBOUND_TOPIC_ID: agentInfo.inboundTopicId,
      HCS10_OUTBOUND_TOPIC_ID: agentInfo.outboundTopicId,
      HCS10_PROFILE_TOPIC_ID: agentInfo.profileTopicId
    });
    
    // Save complete registration information to a JSON file
    await saveRegistrationStatus({
      ...agentInfo,
      accountId: operatorId,
      timestamp: Date.now()
    });
    
    console.log(`
    ======================================================
    ✅ HCS-10 AGENT REGISTRATION COMPLETE!
    
    Account ID:     ${operatorId}
    Agent ID:       ${agentInfo.agentId}
    Inbound Topic:  ${agentInfo.inboundTopicId}
    Outbound Topic: ${agentInfo.outboundTopicId}
    Profile Topic:  ${agentInfo.profileTopicId}
    
    These topic IDs were NEWLY created during this registration.
    They have been saved to both:
    - .env.local (as environment variables)
    - .registration_status.json (as a reference)
    ======================================================
    `);
    
    return agentInfo;
    
  } catch (error) {
    console.error('❌ Error registering agent:', error);
    
    if (error.message.includes('parse entity id')) {
      console.error(`
      ⚠️ SDK COMPATIBILITY ISSUE DETECTED:
         This error indicates there's a version compatibility issue between
         the standards-sdk and Hedera SDK. 
         
         Based on the error, it appears that the SDK is trying to parse 
         a registry topic ID that's already in object form or has an 
         unexpected format.
         
         Try these steps:
         1. Open the standards-sdk source code
         2. Look for submitPayload function
         3. Add a console.log to check registry ID format
      `);
    }
    
    process.exit(1);
  }
}

/**
 * Save registration information to a JSON file for future reference
 */
async function saveRegistrationStatus(data) {
  try {
    await fs.writeFile('.registration_status.json', JSON.stringify(data, null, 2));
    console.log('✅ Registration status saved to .registration_status.json');
  } catch (error) {
    console.error('❌ Error saving registration status:', error);
    throw error;
  }
}

/**
 * Update or add environment variables in .env.local
 */
async function updateEnvFile(newVars) {
  try {
    const envPath = '.env.local';
    let envContent = '';
    
    // Read existing env file if it exists
    try {
      envContent = await fs.readFile(envPath, 'utf8');
    } catch (error) {
      // File doesn't exist, start with empty content
      console.log('Creating new .env.local file');
    }
    
    // Update or add new variables
    for (const [key, value] of Object.entries(newVars)) {
      const regex = new RegExp(`^${key}=.*`, 'm');
      if (regex.test(envContent)) {
        // Replace existing variable
        envContent = envContent.replace(regex, `${key}=${value}`);
      } else {
        // Add new variable
        envContent += `\n${key}=${value}`;
      }
    }
    
    // Write updated content back to file
    await fs.writeFile(envPath, envContent);
    console.log('✅ Environment variables updated in .env.local');
  } catch (error) {
    console.error('❌ Error updating environment variables:', error);
    throw error;
  }
}

// Run the registration process
registerHCS10Agent(); 