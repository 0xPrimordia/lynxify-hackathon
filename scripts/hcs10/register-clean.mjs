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
    console.log('🚀 Starting fresh HCS-10 agent registration...');

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
    
    // Initialize the HCS10 client
    // When you create an HCS10Client, it connects to Hedera using your account credentials
    console.log('🔄 Creating HCS10 client...');
    
    const hcs10Client = new HCS10Client({
      network: 'testnet',           // Using testnet for development
      operatorId: operatorId,       // Your Hedera account ID
      operatorPrivateKey: operatorKey, // Your Hedera private key
      logLevel: 'debug'             // Verbose logging for troubleshooting
    });
    
    console.log('✅ HCS10 client created successfully');
    
    // Register the agent with Moonscape
    // This is the CRITICAL step that creates NEW topics:
    // 1. Creates an inbound topic for receiving messages
    // 2. Creates an outbound topic for sending messages
    // 3. Creates a profile topic for your agent information
    // 4. Registers your agent with the Moonscape registry
    console.log('🔄 Registering agent with Moonscape (creating new topics)...');
    
    const agentInfo = await hcs10Client.registerAgent({
      displayName: "Fresh HCS-10 Agent",
      description: "A brand new agent created from scratch for testing",
      memo: "New HCS-10 Agent - " + new Date().toISOString()
    });
    
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
         This error occurs when there's a version mismatch between the standards-sdk
         and the Hedera SDK. The SDKs must be compatible versions:
      
         Try these steps:
         1. npm uninstall @hashgraph/sdk @hashgraphonline/standards-sdk
         2. npm install @hashgraphonline/standards-sdk@0.0.95 @hashgraph/sdk@2.24.0
         3. rm package-lock.json
         4. npm install
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