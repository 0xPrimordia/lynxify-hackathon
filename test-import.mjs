import * as sdk from '@hashgraphonline/standards-sdk';

console.log('Module keys:', Object.keys(sdk));
console.log('ConnectionsManager exists:', !!sdk.ConnectionsManager);
console.log('ConnectionsManager type:', typeof sdk.ConnectionsManager);

// Try direct import of ConnectionsManager
try {
  const { ConnectionsManager } = await import('@hashgraphonline/standards-sdk');
  console.log('Direct import successful:', !!ConnectionsManager);
  console.log('Direct import type:', typeof ConnectionsManager);
} catch (error) {
  console.error('Direct import failed:', error.message);
}

// Try destructuring import of ConnectionsManager
try {
  const ConnectionsManager = sdk.ConnectionsManager;
  console.log('Destructured import successful:', !!ConnectionsManager);
  console.log('Destructured import type:', typeof ConnectionsManager);
} catch (error) {
  console.error('Destructured import failed:', error.message);
}
