"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.openConvAIService = exports.OpenConvAIService = void 0;
const hcs_1 = require("../types/hcs");
// Class to store messages in memory
class SimpleMessageStore {
    constructor() {
        this.messages = new Map();
    }
    addMessage(topicId, message) {
        var _a;
        if (!this.messages.has(topicId)) {
            this.messages.set(topicId, []);
        }
        (_a = this.messages.get(topicId)) === null || _a === void 0 ? void 0 : _a.push(message);
    }
    getMessages(topicId) {
        return this.messages.get(topicId) || [];
    }
    getAllMessages() {
        const allMessages = [];
        this.messages.forEach(messages => {
            allMessages.push(...messages);
        });
        return allMessages;
    }
}
// Create a message store instance
const inMemoryMessageStore = new SimpleMessageStore();
/**
 * OpenConvAI Service
 * Implements the HCS-10 standard for AI agent communication
 */
class OpenConvAIService {
    constructor() {
        this.messageHandlers = new Map();
        this.isInitialized = false;
        // Default empty initialization - will be properly initialized in init()
        this.sdk = null;
        this.agentId = '';
        this._topicCallbacks = new Map();
    }
    /**
     * Initialize the SDK with Hedera credentials
     */
    init() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                if (this.isInitialized) {
                    console.log('📝 OPENCONVAI: SDK already initialized');
                    return;
                }
                // Validate environment variables
                if (!process.env.NEXT_PUBLIC_OPERATOR_ID || !process.env.OPERATOR_KEY) {
                    throw new Error('NEXT_PUBLIC_OPERATOR_ID and OPERATOR_KEY environment variables are required');
                }
                console.log('📝 OPENCONVAI: Initializing SDK...');
                // Configure the SDK with a simple approach
                const config = {
                    network: process.env.NEXT_PUBLIC_HEDERA_NETWORK === 'mainnet' ? 'mainnet' : 'testnet',
                    operatorId: process.env.NEXT_PUBLIC_OPERATOR_ID,
                    operatorPrivateKey: process.env.OPERATOR_KEY,
                    logLevel: 'info',
                    prettyPrint: true,
                };
                try {
                    // For the hackathon, we'll use a simplified mock implementation
                    // since we're running into module compatibility issues
                    console.log('📝 OPENCONVAI: Using mock implementation for the hackathon demo');
                    // Create a mock SDK with the expected methods
                    this.sdk = {
                        // Mock registerAgent method
                        registerAgent: (profile, progressCallback) => __awaiter(this, void 0, void 0, function* () {
                            console.log('📝 OPENCONVAI MOCK: Registering agent with profile:', profile);
                            // Call the progress callback with initial progress
                            if (progressCallback) {
                                progressCallback({
                                    stage: 'preparing',
                                    message: 'Preparing agent registration',
                                    progressPercent: 25
                                });
                                // Simulate some processing time
                                yield new Promise(resolve => setTimeout(resolve, 500));
                                progressCallback({
                                    stage: 'submitting',
                                    message: 'Submitting to HCS-10 registry',
                                    progressPercent: 50
                                });
                                // Simulate some processing time
                                yield new Promise(resolve => setTimeout(resolve, 500));
                                progressCallback({
                                    stage: 'confirming',
                                    message: 'Registration confirmed',
                                    progressPercent: 75
                                });
                                // Simulate some processing time
                                yield new Promise(resolve => setTimeout(resolve, 500));
                                progressCallback({
                                    stage: 'completed',
                                    message: 'Registration complete',
                                    progressPercent: 100
                                });
                            }
                            // Return a successful result
                            return {
                                success: true,
                                transactionId: `mock-transaction-${Date.now()}`,
                                metadata: {
                                    capabilities: profile.capabilities || [],
                                    name: profile.name,
                                    description: profile.description
                                }
                            };
                        }),
                        // Mock subscribeTopic method
                        subscribeTopic: (topicId, callback) => __awaiter(this, void 0, void 0, function* () {
                            var _a;
                            console.log(`📝 OPENCONVAI MOCK: Subscribing to topic ${topicId}`);
                            // Store the callback to be triggered by the sendMessage method
                            if (!this._topicCallbacks.has(topicId)) {
                                this._topicCallbacks.set(topicId, []);
                            }
                            (_a = this._topicCallbacks.get(topicId)) === null || _a === void 0 ? void 0 : _a.push(callback);
                            return true;
                        }),
                        // Mock sendMessage method
                        sendMessage: (topicId, message) => __awaiter(this, void 0, void 0, function* () {
                            console.log(`📝 OPENCONVAI MOCK: Sending message to topic ${topicId}`);
                            // Parse the message
                            const parsedMessage = typeof message === 'string' ? JSON.parse(message) : message;
                            // Trigger the callbacks for this topic
                            setTimeout(() => {
                                console.log(`📝 OPENCONVAI MOCK: Delivering message to topic ${topicId}`);
                                if (this._topicCallbacks && this._topicCallbacks.has(topicId)) {
                                    const callbacks = this._topicCallbacks.get(topicId) || [];
                                    callbacks.forEach((callback) => {
                                        if (typeof callback === 'function') {
                                            // Wrap the message in the expected format
                                            callback({
                                                message: typeof parsedMessage === 'string' ? parsedMessage : JSON.stringify(parsedMessage),
                                                sequence_number: Date.now()
                                            });
                                        }
                                    });
                                }
                            }, 1000); // Simulate a delay to mimic network latency
                            return {
                                success: true,
                                transactionId: `mock-transaction-${Date.now()}`
                            };
                        }),
                        // Topic callbacks storage
                        _topicCallbacks: this._topicCallbacks
                    };
                }
                catch (error) {
                    console.error('📝 OPENCONVAI: Error initializing SDK, falling back to mock:', error);
                }
                this.agentId = process.env.NEXT_PUBLIC_OPERATOR_ID;
                this.isInitialized = true;
                console.log('✅ OPENCONVAI: SDK initialized successfully');
            }
            catch (error) {
                console.error('❌ OPENCONVAI ERROR: Failed to initialize SDK:', error);
                throw error;
            }
        });
    }
    /**
     * Register the agent in the HCS-10 registry
     */
    registerAgent() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                if (!this.isInitialized) {
                    yield this.init();
                }
                console.log('📝 OPENCONVAI: Registering agent...');
                // Define the agent profile with Moonscape data
                const agentProfile = {
                    name: 'Rebalancer Agent',
                    description: 'Testnet rebalancer agent for the Lynx tokenized index',
                    capabilities: ['text_generation', 'market_analysis', 'rebalancing', 'trading', 'governance'],
                    customMetadata: {
                        tokenizedIndexAgent: true,
                        version: '1.0.0',
                        creator: 'Lynxify',
                        profileTopicId: process.env.NEXT_PUBLIC_HCS_PROFILE_TOPIC,
                        inboundTopicId: process.env.NEXT_PUBLIC_HCS_INBOUND_TOPIC,
                        outboundTopicId: process.env.NEXT_PUBLIC_HCS_OUTBOUND_TOPIC
                    }
                };
                // Register the agent
                const result = yield this.sdk.registerAgent(agentProfile, (progress) => {
                    console.log(`📝 OPENCONVAI REGISTRATION: ${progress.stage} - ${progress.message} ${progress.progressPercent ? `(${progress.progressPercent}%)` : ''}`);
                });
                if (result && result.success) {
                    console.log('✅ OPENCONVAI: Agent registered successfully');
                    console.log('✅ OPENCONVAI: Agent is registered with Moonscape with the following channels:');
                    console.log(`   Profile: ${process.env.NEXT_PUBLIC_HCS_PROFILE_TOPIC}`);
                    console.log(`   Inbound: ${process.env.NEXT_PUBLIC_HCS_INBOUND_TOPIC} (messages TO the agent)`);
                    console.log(`   Outbound: ${process.env.NEXT_PUBLIC_HCS_OUTBOUND_TOPIC} (messages FROM the agent)`);
                    if (result.transactionId) {
                        console.log(`✅ OPENCONVAI: Registration transaction ID: ${result.transactionId}`);
                    }
                    return result;
                }
                else {
                    const errorMsg = (result === null || result === void 0 ? void 0 : result.error) || 'Unknown error';
                    console.error('❌ OPENCONVAI ERROR: Failed to register agent:', errorMsg);
                    throw new Error(errorMsg);
                }
            }
            catch (error) {
                console.error('❌ OPENCONVAI ERROR: Failed to register agent:', error);
                throw error;
            }
        });
    }
    /**
     * Subscribe to a topic for messages
     */
    subscribeToTopic(topicId, onMessage) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            try {
                if (!this.isInitialized) {
                    yield this.init();
                }
                console.log(`📝 OPENCONVAI: Subscribing to topic ${topicId}...`);
                // Register the message handler
                if (!this.messageHandlers.has(topicId)) {
                    this.messageHandlers.set(topicId, []);
                }
                (_a = this.messageHandlers.get(topicId)) === null || _a === void 0 ? void 0 : _a.push(onMessage);
                // Subscribe to the topic using the SDK
                yield this.sdk.subscribeTopic(topicId, (message) => __awaiter(this, void 0, void 0, function* () {
                    var _a;
                    try {
                        console.log(`📝 OPENCONVAI: Received message from topic ${topicId}:`, message);
                        // Handle message based on its structure
                        let jsonData;
                        // If message is already an object and has a message property, extract it
                        if (typeof message === 'object' && message.message) {
                            if (typeof message.message === 'string') {
                                jsonData = JSON.parse(message.message);
                            }
                            else if (typeof message.message === 'object') {
                                jsonData = message.message;
                            }
                        }
                        else if (typeof message === 'string') {
                            // If message is a string, try to parse it
                            jsonData = JSON.parse(message);
                        }
                        else {
                            // If message is already an object, use it directly
                            jsonData = message;
                        }
                        // Validate and process the message
                        if ((0, hcs_1.isValidHCSMessage)(jsonData)) {
                            // Store in our message store
                            inMemoryMessageStore.addMessage(topicId, jsonData);
                            // Notify all handlers for this topic
                            (_a = this.messageHandlers.get(topicId)) === null || _a === void 0 ? void 0 : _a.forEach(handler => {
                                handler(jsonData);
                            });
                        }
                        else {
                            console.warn(`⚠️ OPENCONVAI: Received invalid message format from topic ${topicId}`);
                            console.warn('Message data:', jsonData);
                        }
                    }
                    catch (error) {
                        console.error(`❌ OPENCONVAI ERROR: Failed to process message from topic ${topicId}:`, error);
                        console.error('Raw message:', message);
                    }
                }));
                console.log(`✅ OPENCONVAI: Successfully subscribed to topic ${topicId}`);
            }
            catch (error) {
                console.error(`❌ OPENCONVAI ERROR: Failed to subscribe to topic ${topicId}:`, error);
                throw error;
            }
        });
    }
    /**
     * Send a message to a topic
     */
    sendMessage(topicId, message) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                if (!this.isInitialized) {
                    yield this.init();
                }
                console.log(`📝 OPENCONVAI: Sending message to topic ${topicId}...`);
                // Convert our message to string
                const messageString = JSON.stringify(message);
                // Send the message using the SDK
                const result = yield this.sdk.sendMessage(topicId, messageString);
                console.log(`✅ OPENCONVAI: Successfully sent message to topic ${topicId}`);
                return result;
            }
            catch (error) {
                console.error(`❌ OPENCONVAI ERROR: Failed to send message to topic ${topicId}:`, error);
                throw error;
            }
        });
    }
}
exports.OpenConvAIService = OpenConvAIService;
// Create singleton instance
exports.openConvAIService = new OpenConvAIService();
