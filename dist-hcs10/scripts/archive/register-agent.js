#!/usr/bin/env node
"use strict";
/**
 * Agent Registration Script
 *
 * Registers a Lynxify agent with Moonscape using the HCS-10 standard
 * Run with: node scripts/register-agent.js
 */
// Load environment variables
require('dotenv').config({ path: '.env.local' });
// Initialize the logger
const logger = console;
// Log header
logger.info('==================================');
logger.info('Lynxify Agent Registration Process');
logger.info('==================================');
// Check environment variables
const operatorId = process.env.NEXT_PUBLIC_OPERATOR_ID;
const operatorKey = process.env.OPERATOR_KEY;
const registryTopic = process.env.NEXT_PUBLIC_HCS_REGISTRY_TOPIC;
if (!operatorId || !operatorKey) {
    logger.error('Missing required credentials. Set NEXT_PUBLIC_OPERATOR_ID and OPERATOR_KEY env variables.');
    process.exit(1);
}
if (!registryTopic) {
    logger.error('Missing Moonscape registry topic. Set NEXT_PUBLIC_HCS_REGISTRY_TOPIC env variable.');
    process.exit(1);
}
logger.info(`Using account: ${operatorId}`);
logger.info(`Using registry topic: ${registryTopic}`);
// We'll use the start-server script which already handles agent registration
logger.info('');
logger.info('To register your agent, start the server using:');
logger.info('npm run start-server');
logger.info('');
logger.info('The server will automatically handle agent registration during startup.');
logger.info('Check the server logs for registration details.');
logger.info('');
logger.info('If you need to force re-registration:');
logger.info('1. Delete the .registration_status.json file');
logger.info('2. Restart the server');
logger.info('');
logger.info('To verify your registration after server start:');
logger.info('1. Check the .registration_status.json file for your agent IDs');
logger.info('2. Use Hashscan to view your agent account: https://hashscan.io/testnet/account/YOUR_AGENT_ID');
