import dotenv from 'dotenv';
import fs from 'fs/promises';
import { HCS10Client } from '@hashgraphonline/standards-sdk';

// Load environment variables
dotenv.config({ path: '.env.local' });

async function registerHCS10Agent() {
  try {
    console.log('🚀 Initializing HCS-10 agent registration from absolute scratch...');
    
    // Get credentials from environment
    const operatorId = process.env.NEXT_PUBLIC_OPERATOR_ID;
    const operatorKey = process.env.OPERATOR_KEY;
    
    if (!operatorId || !operatorKey) {
      throw new Error('Missing required environment variables: NEXT_PUBLIC_OPERATOR_ID and OPERATOR_KEY');
    }
    
    console.log(`Using Hedera account: ${operatorId}`);
    
    // Check for existing registration status and remove if found
    try {
      await fs.access('.registration_status.json');
      console.log('⚠️ Found existing registration file. Removing to start fresh...');
      await fs.unlink('.registration_status.json');
      console.log('✅ Removed existing registration file');
    } catch (error) {
      // File doesn't exist, which is good for fresh registration
      console.log('✅ No existing registration found - starting fresh');
    }
    
    console.log('🔄 Creating HCS10 client...');
    
    // Use proper parameters to avoid type issues
    const hcs10Client = new HCS10Client({
      network: 'testnet',
      operatorId: operatorId.toString(),
      operatorPrivateKey: operatorKey.toString(),
      logLevel: 'debug'
    });
    
    console.log('✅ HCS10 client created');
    console.log('🔄 Registering agent with Moonscape...');
    console.log('   This will create NEW topics for your agent...');
    
    // The magic happens here - calling registerAgent() creates:
    // 1. An inbound topic
    // 2. An outbound topic
    // 3. A profile topic
    // 4. Registers the agent with Moonscape registry
    const agentInfo = await hcs10Client.registerAgent({
      displayName: "Fresh HCS-10 Test Agent",
      description: "A brand new agent created from absolute scratch",
      memo: "HCS-10 Test Agent - " + new Date().toISOString()
    });
    
    console.log('✅ Agent registered successfully with Moonscape!');
    console.log('📝 Agent details:', JSON.stringify(agentInfo, null, 2));
    
    // Save registration information to environment file
    await updateEnvFile({
      HCS10_AGENT_ID: agentInfo.agentId,
      HCS10_INBOUND_TOPIC_ID: agentInfo.inboundTopicId,
      HCS10_OUTBOUND_TOPIC_ID: agentInfo.outboundTopicId,
      HCS10_PROFILE_TOPIC_ID: agentInfo.profileTopicId
    });
    
    // Save registration information to a JSON file for reference
    await saveRegistrationStatus({
      ...agentInfo,
      accountId: operatorId,
      timestamp: Date.now()
    });
    
    console.log(`
    ======================================================
    ✅ HCS-10 AGENT REGISTERED SUCCESSFULLY WITH MOONSCAPE!
    
    ACCOUNT ID: ${operatorId}
    AGENT ID: ${agentInfo.agentId}
    INBOUND TOPIC: ${agentInfo.inboundTopicId}
    OUTBOUND TOPIC: ${agentInfo.outboundTopicId}
    PROFILE TOPIC: ${agentInfo.profileTopicId}
    
    All topic IDs have been saved to:
    1. .env.local file as environment variables
    2. .registration_status.json file for reference
    ======================================================
    `);
    
    return agentInfo;
    
  } catch (error) {
    console.error('❌ Error registering agent:', error);
    
    if (error.message.includes('parse entity id')) {
      console.error('\n⚠️ COMPATIBILITY ISSUE DETECTED:');
      console.error('   This error often occurs due to incompatibility between the standards-sdk');
      console.error('   and Hedera SDK versions. The recommended fix is:');
      console.error('   npm install @hashgraphonline/standards-sdk@0.0.95 @hashgraph/sdk@2.24.0');
    }
    
    process.exit(1);
  }
}

// Save registration status to JSON file
async function saveRegistrationStatus(data) {
  try {
    await fs.writeFile('.registration_status.json', JSON.stringify(data, null, 2));
    console.log('✅ Registration status saved to .registration_status.json');
  } catch (error) {
    console.error('❌ Error saving registration status:', error);
    throw error;
  }
}

// Update environment variables file
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

// Run the registration
registerHCS10Agent(); 