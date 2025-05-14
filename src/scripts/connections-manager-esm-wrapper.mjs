/**
 * ConnectionsManager ESM Wrapper
 * 
 * This is an ES Module wrapper for ConnectionsManager to solve the
 * compatibility issues between ES Modules and CommonJS.
 * 
 * It exports the ConnectionsManager and related utilities from 
 * @hashgraphonline/standards-sdk in a way that can be properly imported
 * from CommonJS files.
 */

import { ConnectionsManager as OriginalConnectionsManager } from '@hashgraphonline/standards-sdk';

/**
 * Enhanced wrapper around ConnectionsManager that ensures all methods are properly exposed
 */
class EnhancedConnectionsManager {
  constructor(options) {
    // Ensure we have a properly structured client
    if (options && options.baseClient) {
      // Adapt the client to ensure it has all required properties/methods
      options.baseClient = this.adaptClient(options.baseClient);
    }
    
    // Create the original ConnectionsManager instance
    this.instance = new OriginalConnectionsManager(options);
    
    // Bind all methods from the original instance to this wrapper
    this.bindMethods();
  }
  
  /**
   * Adapt a client to ensure it meets ConnectionsManager requirements
   * @param {Object} client - The client to adapt
   * @returns {Object} The adapted client
   */
  adaptClient(client) {
    // Create a new object with the original client as its prototype
    const adaptedClient = {
      // Original client properties and methods
      ...client,
      
      // Required methods with fallbacks
      retrieveCommunicationTopics: client.retrieveCommunicationTopics ? 
        client.retrieveCommunicationTopics.bind(client) : 
        (() => Promise.resolve({ inboundTopic: '', outboundTopic: '' })),
        
      getMessages: client.getMessages ? 
        client.getMessages.bind(client) : 
        (() => Promise.resolve([])),
      
      // Required properties with defaults
      network: client.network || 'testnet',
      operatorId: client.operatorId || '',
      
      // Required mirror client with fallback
      getMirrorClient: client.getMirrorClient || 
        (() => ({
          getTopicMessages: async () => ({ messages: [] })
        }))
    };
    
    return adaptedClient;
  }
  
  /**
   * Bind all methods from the original instance to this wrapper
   */
  bindMethods() {
    // Get all method names from the original instance
    const methodNames = Object.getOwnPropertyNames(
      Object.getPrototypeOf(this.instance)
    ).filter(name => name !== 'constructor');
    
    // Bind each method to this wrapper
    for (const methodName of methodNames) {
      if (typeof this.instance[methodName] === 'function') {
        this[methodName] = this.instance[methodName].bind(this.instance);
      }
    }
  }
  
  /**
   * Set agent information for ConnectionsManager
   * This is required for proper functionality
   */
  async setAgentInfo(info) {
    if (this.instance.setAgentInfo) {
      return await this.instance.setAgentInfo(info);
    } else {
      console.warn('setAgentInfo method not found on ConnectionsManager instance');
    }
  }
  
  /**
   * Get pending connection requests
   * @returns Array of pending requests
   */
  getPendingRequests() {
    if (this.instance.getPendingRequests) {
      return this.instance.getPendingRequests();
    } else {
      console.warn('getPendingRequests method not found on ConnectionsManager instance');
      return [];
    }
  }
  
  /**
   * Accept a connection request
   * @param options Request options including requestId
   */
  async acceptConnectionRequest(options) {
    if (this.instance.acceptConnectionRequest) {
      return await this.instance.acceptConnectionRequest(options);
    } else {
      console.warn('acceptConnectionRequest method not found on ConnectionsManager instance');
    }
  }
  
  /**
   * Process inbound messages
   * @param messages Array of HCS messages
   */
  async processInboundMessages(messages) {
    if (this.instance.processInboundMessages) {
      return await this.instance.processInboundMessages(messages);
    } else {
      console.warn('processInboundMessages method not found on ConnectionsManager instance');
    }
  }
  
  /**
   * Fetch connection data for an account
   * @param accountId The account ID to fetch connection data for
   */
  async fetchConnectionData(accountId) {
    if (this.instance.fetchConnectionData) {
      return await this.instance.fetchConnectionData(accountId);
    } else {
      console.warn('fetchConnectionData method not found on ConnectionsManager instance');
    }
  }
  
  /**
   * Get the connection store
   * @returns Array of connections
   */
  getConnectionStore() {
    if (this.instance.getConnectionStore) {
      return this.instance.getConnectionStore();
    } else if (this.instance.listConnections) {
      return this.instance.listConnections();
    } else {
      console.warn('getConnectionStore and listConnections methods not found on ConnectionsManager instance');
      return [];
    }
  }
  
  /**
   * List connections
   * @returns Array of connections
   */
  listConnections() {
    return this.getConnectionStore();
  }
}

// Direct export of the enhanced ConnectionsManager for ESM imports
export { EnhancedConnectionsManager as ConnectionsManager };

// For CommonJS interoperability in a hybrid environment
export default EnhancedConnectionsManager;

// To use this in CommonJS modules:
// 1. Import using dynamic import(): 
//    const { default: ConnectionsManager } = await import('./connections-manager-esm-wrapper.mjs');
// 
// 2. Or use the provided wrapper function:
//    const { getConnectionsManager } = require('./connection-manager-wrapper.cjs');
//    const ConnectionsManager = await getConnectionsManager(); 