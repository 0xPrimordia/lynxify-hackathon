// Load environment variables from .env.local first
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

// Then load environment config
import './config/env';

// Import services
import { HederaService } from './services/hedera';
import agentRegistry from './services/agent-registry';
import hcsMessaging from './services/hcs-messaging';
import proposalHandler from './services/proposal-handler';
import websocketService from './services/websocket';
import { validateHederaEnv, getAllTopicIds, getOptionalEnv } from './utils/env-utils';

// Initialize Hedera service
const hederaService = new HederaService();

/**
 * Main server initialization function
 */
async function main() {
  try {
    console.log('🚀 Initializing Lynxify server...');
    
    // Validate environment variables
    const envValidation = validateHederaEnv();
    if (!envValidation.valid) {
      console.error(`❌ ERROR: ${envValidation.error}`);
      process.exit(1);
    }
    
    // Get topic IDs
    const {
      governanceTopic,
      agentTopic,
      registryTopic,
      inboundTopic,
      outboundTopic
    } = getAllTopicIds();
    
    // Get operator credentials
    const operatorId = getOptionalEnv('NEXT_PUBLIC_OPERATOR_ID');
    const operatorKey = getOptionalEnv('OPERATOR_KEY');
    
    console.log('== HEDERA CONFIGURATION ==');
    console.log(`Operator ID: ${operatorId}`);
    console.log(`Governance Topic: ${governanceTopic}`);
    console.log(`Agent Topic: ${agentTopic}`);
    console.log(`Registry Topic: ${registryTopic}`);
    console.log(`Moonscape Inbound Topic: ${inboundTopic}`);
    console.log(`Moonscape Outbound Topic: ${outboundTopic}`);
    console.log('=========================');
    
    // STEP 1: Check if registered and register with Moonscape registry if needed
    if (registryTopic) {
      const alreadyRegistered = await agentRegistry.isAlreadyRegistered(
        operatorId,
        registryTopic
      );
      
      if (!alreadyRegistered) {
        console.log('🌙 Agent not yet registered, performing registration...');
        
        const registrationResult = await agentRegistry.registerAgent(
          operatorId,
          operatorKey,
          getOptionalEnv('NEXT_PUBLIC_HCS_REGISTRY_URL', 'https://moonscape.tech'),
          registryTopic
        );
        
        if (registrationResult.success) {
          console.log('✅ Agent registration successful');
          console.log(`Account ID: ${registrationResult.accountId}`);
          console.log(`Inbound Topic ID: ${registrationResult.inboundTopicId}`);
          console.log(`Outbound Topic ID: ${registrationResult.outboundTopicId}`);
        } else {
          console.error('⚠️ Agent registration failed - some features may not work');
        }
      } else {
        console.log('✅ Agent already registered with registry');
        
        // Get stored registration info
        const registrationInfo = await agentRegistry.getStoredRegistrationInfo();
        if (registrationInfo) {
          console.log('📋 Registration info from previous run:');
          console.log(`Account ID: ${registrationInfo.accountId}`);
          console.log(`Inbound Topic ID: ${registrationInfo.inboundTopicId}`);
          console.log(`Outbound Topic ID: ${registrationInfo.outboundTopicId}`);
        }
      }
    } else {
      console.warn('⚠️ Registry topic not configured - agent will not be discoverable');
    }
    
    // STEP 2: Initialize topic subscriptions
    console.log('🔄 Initializing HCS topic subscriptions');
    
    // Subscribe to governance topic
    if (governanceTopic) {
      console.log(`🔄 Subscribing to governance topic: ${governanceTopic}`);
      await hederaService.subscribeToTopic(governanceTopic, message => {
        proposalHandler.handleMessage(message);
      });
      console.log('✅ Successfully subscribed to governance topic');
    } else {
      console.warn('⚠️ Governance topic not configured - proposal handling disabled');
    }
    
    // Subscribe to Moonscape inbound topic if configured
    if (inboundTopic) {
      console.log(`🔄 Subscribing to Moonscape inbound topic: ${inboundTopic}`);
      await hederaService.subscribeToTopic(inboundTopic, message => {
        proposalHandler.handleMessage(message);
      });
      console.log('✅ Successfully subscribed to Moonscape inbound topic');
      
      // Send status update to Moonscape
      if (outboundTopic) {
        const registrationInfo = await agentRegistry.getStoredRegistrationInfo();
        if (registrationInfo) {
          await hcsMessaging.sendAgentStatus(
            outboundTopic,
            inboundTopic,
            operatorId,
            proposalHandler.getPendingProposalCount(),
            proposalHandler.getExecutedProposalCount()
          );
        }
      }
    }
    
    console.log('✅ Server initialized successfully!');
    
    // Create a demo proposal after 5 seconds
    setTimeout(async () => {
      if (governanceTopic) {
        await proposalHandler.createTestProposal();
      }
    }, 5000);
    
  } catch (error) {
    console.error('❌ ERROR: Failed to initialize server:', error);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('🛑 Shutting down server...');
  websocketService.close();
  process.exit(0);
});

// Run the main function
main().catch(err => {
  console.error('❌ FATAL ERROR:', err);
  process.exit(1);
}); 