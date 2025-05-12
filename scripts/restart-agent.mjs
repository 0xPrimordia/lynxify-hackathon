#!/usr/bin/env node

import { spawn } from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

const MIN_UPTIME_MS = 10000; // 10 seconds
const MAX_RESTARTS = 5;

// Global variables
let agentProcess = null;
let startTime = null;
let restartCount = 0;
let isShuttingDown = false;

/**
 * Start the agent process
 */
async function startAgent() {
  try {
    console.log('🚀 Starting HCS10 agent process...');
    
    // Clear out any old connections.json file
    try {
      await fs.writeFile(path.join(process.cwd(), '.connections.json'), '[]');
    } catch (e) {
      // Ignore errors
    }
    
    // Start the process
    agentProcess = spawn('node', ['scripts/hcs10/agent-handler.mjs'], {
      env: process.env,
      stdio: 'inherit'
    });
    
    startTime = Date.now();
    
    agentProcess.on('exit', (code, signal) => {
      const uptime = Date.now() - startTime;
      console.log(`⚠️ Agent process exited with code ${code} after ${uptime/1000} seconds`);
      
      if (isShuttingDown) return;
      
      // If the process crashed too quickly, increment restart count
      if (uptime < MIN_UPTIME_MS) {
        restartCount++;
        console.log(`⚠️ Process crashed quickly. Restart count: ${restartCount}/${MAX_RESTARTS}`);
        
        if (restartCount >= MAX_RESTARTS) {
          console.error('❌ Too many quick restarts. Exiting.');
          process.exit(1);
        }
      } else {
        // If the process ran for a while, reset restart count
        restartCount = 0;
      }
      
      // Restart the process after a delay
      console.log('🔄 Restarting agent in 2 seconds...');
      setTimeout(startAgent, 2000);
    });
    
    console.log('✅ Agent process started');
  } catch (error) {
    console.error('❌ Error starting agent process:', error);
    
    if (restartCount < MAX_RESTARTS) {
      restartCount++;
      console.log(`🔄 Trying again in 5 seconds (attempt ${restartCount}/${MAX_RESTARTS})...`);
      setTimeout(startAgent, 5000);
    } else {
      console.error('❌ Too many restart attempts. Exiting.');
      process.exit(1);
    }
  }
}

/**
 * Handle shutdown
 */
function shutdown() {
  console.log('🛑 Shutting down...');
  isShuttingDown = true;
  
  if (agentProcess) {
    agentProcess.kill();
  }
  
  process.exit(0);
}

// Handle signals for clean shutdown
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

// Start the agent
startAgent(); 