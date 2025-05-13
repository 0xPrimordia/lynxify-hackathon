#!/usr/bin/env node

import { exec, spawn } from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

// Get the directory name
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Constants
const AGENT_SCRIPT = path.join(__dirname, 'hcs10', 'agent-handler.mjs');
const MAX_RESTART_COUNT = 10;
const RESTART_THRESHOLD = 1000 * 60 * 60; // 1 hour
const CHECK_INTERVAL = 1000 * 60 * 5; // Check every 5 minutes
const INACTIVITY_THRESHOLD = 1000 * 60 * 15; // 15 minutes

// Validate required environment variables
function validateEnvironment() {
  const requiredVars = [
    'OPERATOR_KEY',
    'NEXT_PUBLIC_HCS_AGENT_ID',
    'NEXT_PUBLIC_HCS_INBOUND_TOPIC',
    'NEXT_PUBLIC_HCS_OUTBOUND_TOPIC'
  ];
  
  const missing = requiredVars.filter(varName => !process.env[varName]);
  
  if (missing.length > 0) {
    console.error('❌ Missing required environment variables:', missing.join(', '));
    process.exit(1);
  }
  
  console.log('✅ Environment variables validated');
}

// State
let agentProcess = null;
let restartCount = 0;
let lastRestartTime = Date.now();
let lastActivityTime = Date.now();
let checkIntervalId = null;

/**
 * Start the agent process
 */
async function startAgent() {
  // Validate environment first
  validateEnvironment();
  
  console.log('🚀 Starting HCS10 agent process...');
  
  // Kill any existing process
  if (agentProcess) {
    try {
      process.kill(agentProcess.pid, 'SIGTERM');
      console.log('⚠️ Killed existing agent process');
    } catch (error) {
      // Ignore errors
    }
  }
  
  // Start the agent process with explicit environment variables
  const env = {
    ...process.env,
    OPERATOR_KEY: process.env.OPERATOR_KEY,
    NEXT_PUBLIC_HCS_AGENT_ID: process.env.NEXT_PUBLIC_HCS_AGENT_ID,
    NEXT_PUBLIC_HCS_INBOUND_TOPIC: process.env.NEXT_PUBLIC_HCS_INBOUND_TOPIC,
    NEXT_PUBLIC_HCS_OUTBOUND_TOPIC: process.env.NEXT_PUBLIC_HCS_OUTBOUND_TOPIC
  };
  
  // Start the agent process
  agentProcess = spawn('node', [AGENT_SCRIPT], {
    stdio: 'inherit',
    detached: false,
    env
  });
  
  // Set the last activity time
  lastActivityTime = Date.now();
  
  // Track events
  agentProcess.on('error', (error) => {
    console.error('❌ Agent process error:', error);
    restartAgent();
  });
  
  agentProcess.on('exit', (code, signal) => {
    console.log(`ℹ️ Agent process exited with code ${code} and signal ${signal}`);
    
    // Only restart if not killed intentionally
    if (signal !== 'SIGTERM') {
      restartAgent();
    }
  });
  
  console.log('✅ Agent process started');
  
  // Set up periodic health check
  if (checkIntervalId) {
    clearInterval(checkIntervalId);
  }
  
  checkIntervalId = setInterval(checkAgentHealth, CHECK_INTERVAL);
}

/**
 * Restart the agent process
 */
async function restartAgent() {
  // Check if we've restarted too many times in a short period
  const now = Date.now();
  
  if (now - lastRestartTime < RESTART_THRESHOLD) {
    restartCount++;
    
    if (restartCount > MAX_RESTART_COUNT) {
      console.error('❌ Too many restarts in a short period, exiting');
      process.exit(1);
    }
  } else {
    // Reset restart count
    restartCount = 0;
  }
  
  lastRestartTime = now;
  
  // Start the agent
  await startAgent();
}

/**
 * Check agent health
 */
async function checkAgentHealth() {
  try {
    // Check if agent process is running
    if (!agentProcess || agentProcess.exitCode !== null) {
      console.log('⚠️ Agent process not running, restarting...');
      await restartAgent();
      return;
    }
    
    // Check for agent activity by monitoring agent status file
    try {
      const statusFile = path.join(process.cwd(), '.agent_status.json');
      const stats = await fs.stat(statusFile);
      
      // Update last activity time if status file was updated
      if (stats.mtimeMs > lastActivityTime) {
        lastActivityTime = stats.mtimeMs;
      }
      
      // Check for inactivity
      const now = Date.now();
      if (now - lastActivityTime > INACTIVITY_THRESHOLD) {
        console.log('⚠️ Agent inactive for too long, restarting...');
        console.log(`   Last activity: ${new Date(lastActivityTime).toISOString()}`);
        console.log(`   Current time: ${new Date().toISOString()}`);
        console.log(`   Inactivity period: ${Math.round((now - lastActivityTime) / 1000 / 60)} minutes`);
        
        await restartAgent();
      }
    } catch (error) {
      // File might not exist yet, ignore
    }
  } catch (error) {
    console.error('❌ Error checking agent health:', error);
  }
}

// Start the agent
await startAgent(); 