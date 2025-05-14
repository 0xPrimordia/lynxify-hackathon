/**
 * ESM exports for standards-sdk ConnectionsManager
 * This file must use .mjs extension to properly load as ES Module
 */

import { ConnectionsManager } from '@hashgraphonline/standards-sdk';

// Export the ConnectionsManager directly (ESM style)
export { ConnectionsManager };

// Export a factory function to create a ConnectionsManager instance
export async function createConnectionsManager(options) {
  return new ConnectionsManager(options);
}
