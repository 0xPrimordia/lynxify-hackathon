// Load environment variables
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

// Import server initialization
import { initializeServer } from './server-init';

// Import WebSocket service
import websocketService from '../services/websocket';

/**
 * Main application entry point
 */
async function main() {
  try {
    console.log('🚀 Starting Lynxify HCS-10 Agent...');
    
    // Initialize the server with all required components
    await initializeServer();
    
    console.log('✅ Server successfully initialized and running');
  } catch (error) {
    console.error('❌ FATAL ERROR:', error);
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