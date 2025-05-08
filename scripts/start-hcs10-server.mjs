#!/usr/bin/env node
/**
 * Start the combined HCS10 agent server
 * This server provides both API and WebSocket endpoints for interacting with the HCS10 agent
 */

import { exec } from 'child_process';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Load environment variables
dotenv.config({ path: '.env.local' });

// Get the current directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

console.log(`
===============================================
🚀 Starting Lynxify HCS-10 Agent Server
===============================================
`);

// Print agent configuration
console.log('📝 Agent Configuration:');
console.log('- Agent ID:', process.env.NEXT_PUBLIC_HCS_AGENT_ID || 'Not configured');
console.log('- Inbound Topic:', process.env.NEXT_PUBLIC_HCS_INBOUND_TOPIC || 'Not configured');
console.log('- Outbound Topic:', process.env.NEXT_PUBLIC_HCS_OUTBOUND_TOPIC || 'Not configured');
console.log('- Profile Topic:', process.env.NEXT_PUBLIC_HCS_PROFILE_TOPIC || 'Not configured');
console.log('- Operator ID:', process.env.NEXT_PUBLIC_OPERATOR_ID || 'Not configured');
console.log('- Operator Key:', process.env.OPERATOR_KEY ? '✅ Set' : '❌ Not set');

// Start the server
console.log('\n🔄 Starting server...');
const serverProcess = exec('node combined-server.js', { cwd: rootDir });

// Forward stdout and stderr
serverProcess.stdout.on('data', (data) => {
  process.stdout.write(data);
});

serverProcess.stderr.on('data', (data) => {
  process.stderr.write(data);
});

// Handle server process exit
serverProcess.on('exit', (code) => {
  console.log(`\n💥 Server process exited with code ${code}`);
  process.exit(code);
});

// Handle script termination
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down server...');
  serverProcess.kill('SIGINT');
});

console.log('\n🔄 Server should start momentarily... (watch for startup messages)');
console.log('Press Ctrl+C to stop the server');
console.log('==============================================='); 