#!/usr/bin/env node
"use strict";
const dotenv = require('dotenv');
const fs = require('fs').promises;
const path = require('path');
// Load environment variables
dotenv.config({ path: '.env.local' });
// Path to the approval commands file
const APPROVAL_COMMAND_FILE = path.join(process.cwd(), '.approval_commands.json');
// Path to connection state file
const CONNECTION_STATE_FILE = path.join(process.cwd(), '.connection_state.json');
/**
 * Check for approval commands in the file
 */
async function checkApprovalCommands() {
    try {
        // Check if the file exists
        try {
            const data = await fs.readFile(APPROVAL_COMMAND_FILE, 'utf8');
            const commands = JSON.parse(data);
            if (commands.length > 0) {
                console.log(`📝 Found ${commands.length} approval commands processed by the API routes`);
                // Just log the commands for information
                for (const command of commands) {
                    if ((command.action === 'approve' || command.type === 'approve_connection') && command.connectionId) {
                        console.log(`ℹ️ Approval command for connection ${command.connectionId} is being processed by API`);
                    }
                }
            }
        }
        catch (error) {
            // File doesn't exist yet or other error
            if (error.code !== 'ENOENT') {
                console.error('❌ Error checking approval commands:', error);
            }
        }
    }
    catch (error) {
        console.error('❌ Error processing approval commands:', error);
    }
}
/**
 * Main function to run the connection monitoring
 */
async function main() {
    console.log('🚀 Starting connection monitor...');
    try {
        // Periodically check for approval commands
        const checkInterval = setInterval(async () => {
            await checkApprovalCommands();
        }, 5000);
        // Handle graceful shutdown
        process.on('SIGINT', async () => {
            console.log('🛑 Received SIGINT, shutting down...');
            clearInterval(checkInterval);
            process.exit(0);
        });
        process.on('SIGTERM', async () => {
            console.log('🛑 Received SIGTERM, shutting down...');
            clearInterval(checkInterval);
            process.exit(0);
        });
        // Keep the process running
        console.log('🔄 Monitor is now running and checking for connection commands every 5 seconds');
        console.log('🔄 Press Ctrl+C to stop');
    }
    catch (error) {
        console.error('❌ Error running monitor:', error);
        process.exit(1);
    }
}
// Run the main function
main().catch(error => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
});
