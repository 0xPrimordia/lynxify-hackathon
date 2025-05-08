import dotenv from 'dotenv';
import fs from 'fs/promises';
import { HCS10Client, AgentBuilder, AIAgentCapability } from '@hashgraphonline/standards-sdk';

// Load environment variables
dotenv.config({ path: '.env.local' });

/**
 * Registers a fresh HCS-10 agent following the polling-agent example
 */
async function main() {
  try {
    console.log('🚀 Starting HCS-10 agent registration...');
    
    // Get credentials from environment
    const operatorId = process.env.NEXT_PUBLIC_OPERATOR_ID;
    const operatorKey = process.env.OPERATOR_KEY;
    
    if (!operatorId || !operatorKey) {
      throw new Error('Missing required environment variables: NEXT_PUBLIC_OPERATOR_ID and OPERATOR_KEY');
    }
    
    console.log(`Using Hedera account: ${operatorId}`);
    
    // Create the HCS10 client
    console.log('🔄 Creating HCS10 client...');
    
    const client = new HCS10Client({
      network: 'testnet',
      operatorId: operatorId,
      operatorPrivateKey: operatorKey,
      logLevel: 'debug'
    });
    
    console.log('✅ HCS10 client created');
    
    // Use AgentBuilder to create agent parameters (following examples in documentation)
    console.log('🔄 Building agent with AgentBuilder...');
    
    const agentBuilder = new AgentBuilder()
      .setName('Lynxify Agent')
      .setAlias('lynxify_agent')
      .setBio('Tokenized Index Agent for Lynxify')
      .setCapabilities([
        AIAgentCapability.TEXT_GENERATION,
        AIAgentCapability.KNOWLEDGE_RETRIEVAL,
        AIAgentCapability.DATA_INTEGRATION
      ])
      .setCreator('Lynxify')
      .setModel('gpt-3.5-turbo')
      .setNetwork('testnet');
    
    // Register the agent with Moonscape
    console.log('🔄 Registering agent with Moonscape...');
    
    // Using createAndRegisterAgent which is the recommended method
    const result = await client.createAndRegisterAgent(agentBuilder, {
      initialBalance: 5 // Fund with 5 HBAR
    });
    
    if (!result || !result.metadata) {
      throw new Error('Agent registration failed - missing metadata in response');
    }
    
    const agentInfo = result.metadata;
    
    console.log('✅ Agent registered successfully!');
    console.log('📝 Agent details:', JSON.stringify(agentInfo, null, 2));
    
    // Save registration information
    await fs.writeFile('.registration_status.json', JSON.stringify(agentInfo, null, 2));
    console.log('✅ Registration information saved to .registration_status.json');
    
    // Save environment variables
    await updateEnvFile({
      NEXT_PUBLIC_HCS_AGENT_ID: agentInfo.agentId,
      NEXT_PUBLIC_HCS_INBOUND_TOPIC: agentInfo.inboundTopicId,
      NEXT_PUBLIC_HCS_OUTBOUND_TOPIC: agentInfo.outboundTopicId,
      NEXT_PUBLIC_HCS_PROFILE_TOPIC: agentInfo.profileTopicId
    });
    
    if (agentInfo.registryTopicId) {
      await updateEnvFile({
        NEXT_PUBLIC_HCS_REGISTRY_TOPIC: agentInfo.registryTopicId
      });
    }
    
    console.log(`
    ======================================================
    ✅ HCS-10 AGENT REGISTRATION COMPLETE!
    
    Agent ID: ${agentInfo.agentId}
    Inbound Topic: ${agentInfo.inboundTopicId}
    Outbound Topic: ${agentInfo.outboundTopicId}
    Profile Topic: ${agentInfo.profileTopicId}
    Registry Topic: ${agentInfo.registryTopicId || 'Not provided'}
    
    Topic IDs saved to:
    - .env.local
    - .registration_status.json
    ======================================================
    `);
    
  } catch (error) {
    console.error('❌ Error registering agent:', error);
    process.exit(1);
  }
}

async function updateEnvFile(newVars) {
  try {
    const envPath = '.env.local';
    let envContent = '';
    
    // Read existing env file
    try {
      envContent = await fs.readFile(envPath, 'utf8');
    } catch (error) {
      console.log('Creating new .env.local file');
    }
    
    // Update or add variables
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
    
    // Write updated content
    await fs.writeFile(envPath, envContent);
    console.log('✅ Environment variables updated in .env.local');
  } catch (error) {
    console.error('❌ Error updating environment variables:', error);
  }
}

// Run the registration process
main(); 