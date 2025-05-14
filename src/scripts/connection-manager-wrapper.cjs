/**
 * ConnectionsManager CommonJS Wrapper
 * 
 * This is a CommonJS wrapper for ConnectionsManager to solve the
 * compatibility issues between ES Modules and CommonJS.
 * 
 * It provides functions to import the ConnectionsManager from the 
 * ES Module wrapper and use it in CommonJS files.
 */

const path = require('path');

/**
 * Get the ConnectionsManager class from the ES Module wrapper
 * @returns {Promise<any>} The ConnectionsManager class
 */
async function getConnectionsManager() {
  try {
    // Dynamically import the ESM wrapper
    const wrapper = await import('./connections-manager-esm-wrapper.mjs');
    return wrapper.default;
  } catch (error) {
    console.error('Error importing ConnectionsManager:', error.message);
    throw new Error('Failed to import ConnectionsManager: ' + error.message);
  }
}

/**
 * Create a new ConnectionsManager instance
 * @param {Object} options The options to pass to the ConnectionsManager constructor
 * @returns {Promise<any>} A new ConnectionsManager instance
 */
async function createConnectionsManager(options) {
  const CM = await getConnectionsManager();
  return new CM(options);
}

module.exports = {
  getConnectionsManager,
  createConnectionsManager
}; 