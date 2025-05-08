import fs from 'fs/promises';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

/**
 * Updates environment variables based on the registration_status.json file
 */
async function main() {
  try {
    console.log('🔄 Updating environment variables from registration data...');
    
    // Read registration status file
    const registrationData = JSON.parse(await fs.readFile('.registration_status.json', 'utf8'));
    console.log('📝 Registration data:', JSON.stringify(registrationData, null, 2));
    
    // Extract values
    const accountId = registrationData.accountId;
    const inboundTopicId = registrationData.inboundTopicId;
    const outboundTopicId = registrationData.outboundTopicId;
    const profileTopicId = registrationData.profileTopicId;
    
    // Use account ID as agent ID since that's how Moonscape identifies agents
    const agentId = accountId;
    
    // Update environment variables
    await updateEnvFile({
      NEXT_PUBLIC_HCS_AGENT_ID: agentId,
      NEXT_PUBLIC_HCS_INBOUND_TOPIC: inboundTopicId,
      NEXT_PUBLIC_HCS_OUTBOUND_TOPIC: outboundTopicId,
      NEXT_PUBLIC_HCS_PROFILE_TOPIC: profileTopicId
    });
    
    // Optional: Check for registry topic in environment
    const registryTopic = process.env.NEXT_PUBLIC_HCS_REGISTRY_TOPIC;
    if (!registryTopic) {
      console.log('⚠️ Registry topic not found in environment');
      console.log('ℹ️ You can specify a registry topic by setting NEXT_PUBLIC_HCS_REGISTRY_TOPIC in .env.local');
    } else {
      console.log('✅ Found registry topic:', registryTopic);
    }
    
    console.log(`
    ======================================================
    ✅ ENVIRONMENT VARIABLES UPDATED
    
    Agent ID (Account ID): ${agentId}
    Inbound Topic: ${inboundTopicId}
    Outbound Topic: ${outboundTopicId}
    Profile Topic: ${profileTopicId}
    
    All topic IDs have been saved to .env.local
    ======================================================
    `);
    
  } catch (error) {
    console.error('❌ Error updating environment variables:', error);
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

// Run the update process
main(); 