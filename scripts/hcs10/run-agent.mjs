#!/usr/bin/env node

import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import fs from 'fs/promises';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function validateEnvironment() {
  console.log('🔍 Validating environment...');
  
  // Load .env.local
  const envPath = path.resolve(process.cwd(), '.env.local');
  try {
    const envContent = await fs.readFile(envPath, 'utf8');
    const env = dotenv.parse(envContent);
    process.env = { ...process.env, ...env };
  } catch (error) {
    console.error('❌ Error loading .env.local:', error);
    process.exit(1);
  }

  // Required environment variables
  const required = [
    'OPERATOR_KEY',
    'NEXT_PUBLIC_OPERATOR_ID',
    'NEXT_PUBLIC_HCS_AGENT_ID',
    'NEXT_PUBLIC_HCS_INBOUND_TOPIC',
    'NEXT_PUBLIC_HCS_OUTBOUND_TOPIC',
    'NEXT_PUBLIC_NETWORK'
  ];

  const missing = required.filter(key => !process.env[key]);
  if (missing.length > 0) {
    console.error('❌ Missing required environment variables:', missing.join(', '));
    process.exit(1);
  }

  console.log('✅ Environment variables validated');
}

async function main() {
  try {
    await validateEnvironment();
    
    console.log('🚀 Starting HCS10 agent process...');
    
    const agentProcess = spawn('node', ['--experimental-modules', 'agent-handler.mjs'], {
      stdio: 'inherit',
      cwd: path.resolve(__dirname),
      env: process.env
    });

    agentProcess.on('exit', (code, signal) => {
      console.log(`ℹ️ Agent process exited with code ${code} and signal ${signal}`);
      
      // Restart process on error
      if (code !== 0) {
        console.log('✅ Environment variables validated');
        console.log('🚀 Starting HCS10 agent process...');
        main();
      }
    });

    console.log('✅ Agent process started');

  } catch (error) {
    console.error('❌ Error starting agent:', error);
    process.exit(1);
  }
}

main();
