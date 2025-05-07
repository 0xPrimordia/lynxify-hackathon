import '../config/env';

// Import services
import { HederaService } from '../services/hedera';
import agentRegistry from '../services/agent-registry';
import hcsMessaging from '../services/hcs-messaging';
import proposalHandler from '../services/proposal-handler';
import websocketService from '../services/websocket';
import { validateHederaEnv, getAllTopicIds, getOptionalEnv } from '../utils/env-utils';

/**
 * Initialize all server components
 */
export async function initializeServer(): Promise<void> {
  // Validate environment variables
  const envValidation = validateHederaEnv();
  if (!envValidation.valid) {
    throw new Error(`Environment validation failed: ${envValidation.error}`);
  }
  
  // Get configuration
  const {
    governanceTopic,
    agentTopic,
    registryTopic,
    inboundTopic,
    outboundTopic
  } = getAllTopicIds();
  
  const operatorId = getOptionalEnv('NEXT_PUBLIC_OPERATOR_ID');
  const operatorKey = getOptionalEnv('OPERATOR_KEY');
  
  // Log configuration
  logConfiguration(operatorId, governanceTopic, agentTopic, registryTopic, inboundTopic, outboundTopic);
  
  // Initialize Hedera service
  const hederaService = new HederaService();
  
  // Register with Moonscape if needed
  await registerWithMoonscape(registryTopic, operatorId, operatorKey);
  
  // Initialize topic subscriptions
  await initializeSubscriptions(
    hederaService, 
    governanceTopic, 
    inboundTopic,
    outboundTopic,
    operatorId
  );
  
  // Create demo proposal after delay (if enabled)
  scheduleTestProposal(governanceTopic);
}

/**
 * Log server configuration
 */
function logConfiguration(
  operatorId: string,
  governanceTopic: string,
  agentTopic: string,
  registryTopic: string,
  inboundTopic: string,
  outboundTopic: string
): void {
  console.log('== HEDERA CONFIGURATION ==');
  console.log(`Operator ID: ${operatorId}`);
  console.log(`Governance Topic: ${governanceTopic}`);
  console.log(`Agent Topic: ${agentTopic}`);
  console.log(`Registry Topic: ${registryTopic}`);
  console.log(`Moonscape Inbound Topic: ${inboundTopic}`);
  console.log(`Moonscape Outbound Topic: ${outboundTopic}`);
  console.log('=========================');
}

/**
 * Register agent with Moonscape
 */
async function registerWithMoonscape(
  registryTopic: string,
  operatorId: string,
  operatorKey: string
): Promise<void> {
  if (!registryTopic) {
    console.warn('⚠️ Registry topic not configured - agent will not be discoverable');
    return;
  }
  
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
}

/**
 * Initialize all topic subscriptions
 */
async function initializeSubscriptions(
  hederaService: HederaService,
  governanceTopic: string,
  inboundTopic: string,
  outboundTopic: string,
  operatorId: string
): Promise<void> {
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
}

/**
 * Schedule a test proposal creation (for demo purposes)
 */
function scheduleTestProposal(governanceTopic: string): void {
  if (!governanceTopic) return;
  
  setTimeout(async () => {
    await proposalHandler.createTestProposal();
  }, 5000);
}
 