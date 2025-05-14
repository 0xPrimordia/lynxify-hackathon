#!/usr/bin/env ts-node
"use strict";
/**
 * HCS-10 OpenConvAI Integration Test Script
 *
 * This script tests the complete implementation of HCS-10 in our application:
 * 1. Initializes the SDK
 * 2. Registers an agent
 * 3. Subscribes to a topic
 * 4. Sends a test message
 * 5. Verifies message receipt
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
// Load environment variables
const dotenv = __importStar(require("dotenv"));
dotenv.config({ path: '.env.local' });
const openconvai_1 = require("../services/openconvai");
const uuid_1 = require("uuid");
// Check required environment variables
const requiredEnvVars = [
    'NEXT_PUBLIC_OPERATOR_ID',
    'OPERATOR_KEY',
    'NEXT_PUBLIC_HCS_GOVERNANCE_TOPIC'
];
const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
if (missingVars.length > 0) {
    console.error(`❌ ERROR: Missing required environment variables: ${missingVars.join(', ')}`);
    console.error('Please set these variables in .env.local file');
    process.exit(1);
}
// Topic to test with
const testTopic = process.env.NEXT_PUBLIC_HCS_GOVERNANCE_TOPIC;
// Flag to track if the message was received
let messageReceived = false;
const testMessageId = (0, uuid_1.v4)();
async function runTest() {
    try {
        console.log('🧪 HCS-10 TEST: Starting HCS-10 integration test\n');
        // Step 1: Initialize the SDK
        console.log('🧪 STEP 1: Initializing OpenConvAI SDK');
        await openconvai_1.openConvAIService.init();
        console.log('✅ SDK initialization successful\n');
        // Step 2: Register an agent
        console.log('🧪 STEP 2: Registering agent with HCS-10 registry');
        const registrationResult = await openconvai_1.openConvAIService.registerAgent();
        if (registrationResult?.success) {
            console.log('✅ Agent registration successful');
            if (registrationResult.transactionId) {
                console.log(`Transaction ID: ${registrationResult.transactionId}`);
            }
        }
        else {
            console.warn('⚠️ Agent registration unsuccessful or incomplete');
            console.warn('Response:', JSON.stringify(registrationResult, null, 2));
        }
        console.log('');
        // Step 3: Subscribe to a topic
        console.log(`🧪 STEP 3: Subscribing to topic: ${testTopic}`);
        // Create a promise to wait for message receipt
        const messagePromise = new Promise((resolve) => {
            openconvai_1.openConvAIService.subscribeToTopic(testTopic, (message) => {
                console.log('📩 Received message:', JSON.stringify(message, null, 2));
                // Convert to our extended test interface to check for testId
                const testMessage = message;
                if (testMessage.details?.testId === testMessageId) {
                    console.log('✅ Successfully received our test message');
                    messageReceived = true;
                    resolve();
                }
            });
        });
        // Set a timeout for receiving the message
        const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => {
                if (!messageReceived) {
                    reject(new Error('Timeout: No message received within the time limit'));
                }
            }, 20000); // 20 seconds timeout
        });
        console.log('✅ Topic subscription set up successfully\n');
        // Step 4: Send a test message
        console.log(`🧪 STEP 4: Sending test message to topic: ${testTopic}`);
        // Create a message that conforms to HCSMessage interface
        const testMessage = {
            id: (0, uuid_1.v4)(),
            type: 'RebalanceProposal', // Using a valid message type
            timestamp: Date.now(),
            sender: 'HCS-10 Test Script',
            details: {
                message: 'This is a test message to verify HCS-10 integration',
                testId: testMessageId, // Add our test ID in the details
                newWeights: { 'TEST-TOKEN': 1.0 }, // Required for RebalanceProposal
                executeAfter: Date.now() + 3600000, // 1 hour from now
                quorum: 0.51
            }
        };
        await openconvai_1.openConvAIService.sendMessage(testTopic, testMessage);
        console.log('✅ Test message sent successfully');
        console.log('📤 Message content:', JSON.stringify(testMessage, null, 2));
        console.log('');
        // Step 5: Wait for message receipt
        console.log('🧪 STEP 5: Waiting for message receipt (up to 20 seconds)');
        try {
            await Promise.race([messagePromise, timeoutPromise]);
            if (messageReceived) {
                console.log('✅ TEST PASSED: Full HCS-10 round-trip communication verified\n');
            }
        }
        catch (error) {
            console.error('❌ TEST FAILED: Message not received within timeout period');
            console.error('This may indicate an issue with the HCS-10 subscription or message format');
        }
        // Summary of results
        console.log('🧪 HCS-10 TEST SUMMARY:');
        console.log('✅ SDK Initialization:', true);
        console.log('✅ Agent Registration:', !!registrationResult?.success);
        console.log('✅ Topic Subscription:', true);
        console.log('✅ Message Sending:', true);
        console.log('✅ Message Receiving:', messageReceived);
        if (registrationResult?.success && messageReceived) {
            console.log('\n🎉 SUCCESS: HCS-10 integration is fully functional');
        }
        else if (registrationResult?.success) {
            console.log('\n⚠️ PARTIAL SUCCESS: Agent registration works but message receiving failed');
        }
        else if (messageReceived) {
            console.log('\n⚠️ PARTIAL SUCCESS: Messaging works but agent registration failed');
        }
        else {
            console.log('\n❌ FAILURE: Neither agent registration nor messaging worked correctly');
        }
        // Exit after a delay to allow any pending operations to complete
        setTimeout(() => process.exit(0), 3000);
    }
    catch (error) {
        console.error('❌ TEST ERROR:', error);
        process.exit(1);
    }
}
// Run the test
runTest().catch(error => {
    console.error('❌ UNHANDLED ERROR:', error);
    process.exit(1);
});
