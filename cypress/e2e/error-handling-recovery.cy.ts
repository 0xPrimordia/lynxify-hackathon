/// <reference types="cypress" />

describe('Error Handling and Recovery UI Flow', () => {
  beforeEach(() => {
    // Visit the main application page
    cy.visit('/');
    
    // Wait for initial load and connection
    cy.get('[data-testid="dashboard"]').should('be.visible');
    cy.get('[data-testid="connection-status"]').should('contain.text', 'Connected');
  });
  
  /**
   * Test 1: WebSocket disconnection handling
   * Tests the UI response to WebSocket disconnection and reconnection
   */
  it('Should handle WebSocket disconnection and reconnection', () => {
    // Verify initial connected state
    cy.get('[data-testid="agent-status"]').should('contain.text', 'Initialized');
    
    // Trigger a simulated disconnection
    cy.window().then(win => {
      // Dispatch custom event to simulate disconnect - our mock WebSocket handles this
      const disconnectEvent = new CustomEvent('websocket:disconnect');
      win.dispatchEvent(disconnectEvent);
    });
    
    // Verify disconnection state is shown
    cy.get('[data-testid="connection-status"]').should('contain.text', 'Disconnected');
    cy.get('[data-testid="connection-error-message"]').should('be.visible');
    cy.get('[data-testid="reconnect-button"]').should('be.visible');
    
    // Attempt manual reconnection
    cy.get('[data-testid="reconnect-button"]').click();
    
    // Verify connection is restored
    cy.get('[data-testid="connection-status"]').should('contain.text', 'Connected');
    cy.get('[data-testid="connection-error-message"]').should('not.exist');
    cy.get('[data-testid="agent-status"]').should('contain.text', 'Initialized');
  });
  
  /**
   * Test 2: Failed operation retry
   * Tests retry mechanisms for failed operations
   */
  it('Should allow retrying failed operations', () => {
    // Try to perform a token operation that will fail
    cy.get('[data-testid="token-operations-tab"]').click();
    
    // Set up token operation with failure flag
    cy.get('[data-testid="operation-select"]').select('mint');
    cy.get('[data-testid="token-select"]').select('BTC');
    cy.get('[data-testid="amount-input"]').clear().type('999999'); // Amount that triggers failure
    cy.get('[data-testid="simulate-failure"]').check(); // Special checkbox to trigger a simulated failure
    
    // Execute the operation
    cy.get('[data-testid="execute-operation"]').click();
    
    // Verify error state
    cy.get('[data-testid="operation-error"]').should('be.visible');
    cy.get('[data-testid="operation-error"]').should('contain.text', 'Failed to execute mint operation');
    cy.get('[data-testid="retry-operation"]').should('be.visible');
    
    // Uncheck the simulate failure option
    cy.get('[data-testid="simulate-failure"]').uncheck();
    
    // Retry the operation
    cy.get('[data-testid="retry-operation"]').click();
    
    // Verify success
    cy.get('[data-testid="operation-success"]').should('be.visible');
    cy.get('[data-testid="operation-error"]').should('not.exist');
  });
  
  /**
   * Test 3: Network error handling during rebalance
   * Tests handling of network errors during complex operations
   */
  it('Should handle network errors during rebalance operations', () => {
    // Navigate to rebalance panel
    cy.get('[data-testid="rebalance-tab"]').click();
    
    // Open rebalance proposal modal
    cy.get('[data-testid="open-rebalance-modal"]').click();
    
    // Set new weights
    cy.get('[data-testid="weight-input-BTC"]').clear().type('0.5');
    cy.get('[data-testid="weight-input-ETH"]').clear().type('0.3');
    cy.get('[data-testid="weight-input-SOL"]').clear().type('0.2');
    
    // Enable network error simulation for proposal creation
    cy.get('[data-testid="simulate-network-error"]').check();
    
    // Submit proposal which will fail
    cy.get('[data-testid="submit-proposal"]').click();
    
    // Verify error message is displayed
    cy.get('[data-testid="network-error-message"]').should('be.visible');
    cy.get('[data-testid="network-error-message"]').should('contain.text', 'Network error occurred');
    cy.get('[data-testid="retry-button"]').should('be.visible');
    
    // Disable network error simulation
    cy.get('[data-testid="simulate-network-error"]').uncheck();
    
    // Retry the operation
    cy.get('[data-testid="retry-button"]').click();
    
    // Verify success - proposal was created
    cy.get('[data-testid="proposal-created-message"]').should('be.visible');
    cy.get('[data-testid="network-error-message"]').should('not.exist');
  });
  
  /**
   * Test 4: Error handling for invalid input
   * Tests form validation and error messaging
   */
  it('Should validate inputs and show appropriate error messages', () => {
    // Navigate to rebalance panel
    cy.get('[data-testid="rebalance-tab"]').click();
    
    // Open rebalance proposal modal
    cy.get('[data-testid="open-rebalance-modal"]').click();
    
    // Enter invalid weights (sum > 1.0)
    cy.get('[data-testid="weight-input-BTC"]').clear().type('0.5');
    cy.get('[data-testid="weight-input-ETH"]').clear().type('0.5');
    cy.get('[data-testid="weight-input-SOL"]').clear().type('0.5');
    
    // Verify validation error is shown
    cy.get('[data-testid="validation-error"]').should('be.visible');
    cy.get('[data-testid="validation-error"]').should('contain.text', 'Total weight must equal 1.0');
    cy.get('[data-testid="submit-proposal"]').should('be.disabled');
    
    // Fix the weights
    cy.get('[data-testid="weight-input-SOL"]').clear().type('0.0');
    
    // Verify validation error is cleared
    cy.get('[data-testid="validation-error"]').should('not.exist');
    cy.get('[data-testid="submit-proposal"]').should('be.enabled');
    
    // Try negative weight
    cy.get('[data-testid="weight-input-BTC"]').clear().type('-0.5');
    
    // Verify validation error
    cy.get('[data-testid="validation-error"]').should('be.visible');
    cy.get('[data-testid="validation-error"]').should('contain.text', 'Weights must be positive');
    cy.get('[data-testid="submit-proposal"]').should('be.disabled');
  });
  
  /**
   * Test 5: Message queue recovery
   * Tests recovery when messages are backed up or processing is delayed
   */
  it('Should recover from message processing delays', () => {
    // Navigate to agent operations panel
    cy.get('[data-testid="agent-operations-tab"]').click();
    
    // Trigger a message backlog simulation
    cy.get('[data-testid="simulate-message-backlog"]').click();
    
    // Verify backlog indication
    cy.get('[data-testid="message-backlog-indicator"]').should('be.visible');
    cy.get('[data-testid="processing-count"]').should('contain.text', '10'); // 10 backed up messages
    
    // Wait for automatic recovery
    cy.get('[data-testid="message-backlog-indicator"]', { timeout: 10000 }).should('not.exist');
    
    // Verify processing completed message
    cy.get('[data-testid="status-message"]').should('contain.text', 'Message processing completed');
  });
  
  /**
   * Test 6: Server error responses
   * Tests handling of error responses from the server
   */
  it('Should handle and display server error responses', () => {
    // Navigate to agent operations panel
    cy.get('[data-testid="agent-operations-tab"]').click();
    
    // Trigger a simulated server error
    cy.get('[data-testid="trigger-server-error"]').click();
    
    // Verify error notification appears
    cy.get('[data-testid="error-notification"]').should('be.visible');
    cy.get('[data-testid="error-notification"]').should('contain.text', 'Server error: Internal processing error');
    
    // Dismiss the error
    cy.get('[data-testid="dismiss-error"]').click();
    
    // Verify error is dismissed
    cy.get('[data-testid="error-notification"]').should('not.exist');
  });
  
  /**
   * Test 7: Recovery from data corruption
   * Tests error handling for malformed or corrupt data
   */
  it('Should recover from corrupt or malformed data', () => {
    // Navigate to agent status panel
    cy.get('[data-testid="agent-status-tab"]').click();
    
    // Send malformed data simulation
    cy.window().then(win => {
      // Dispatch custom event to simulate receiving malformed data
      const corruptDataEvent = new CustomEvent('websocket:corrupt-data', {
        detail: { messageType: 'AgentStatus' }
      });
      win.dispatchEvent(corruptDataEvent);
    });
    
    // Verify error message about malformed data
    cy.get('[data-testid="data-error-message"]').should('be.visible');
    cy.get('[data-testid="data-error-message"]').should('contain.text', 'Received malformed data');
    
    // Trigger a refresh
    cy.get('[data-testid="refresh-data"]').click();
    
    // Verify data is correctly displayed after refresh
    cy.get('[data-testid="data-error-message"]').should('not.exist');
    cy.get('[data-testid="agent-status"]').should('contain.text', 'Initialized');
  });
  
  /**
   * Test 8: Session expiry and authentication recovery
   * Tests recovery from expired authentication
   */
  it('Should handle session expiry and reauthentication', () => {
    // Simulate session expiration
    cy.window().then(win => {
      // Dispatch custom event to simulate session expiry
      const sessionExpiredEvent = new CustomEvent('session:expired');
      win.dispatchEvent(sessionExpiredEvent);
    });
    
    // Verify session expired message
    cy.get('[data-testid="session-expired-message"]').should('be.visible');
    cy.get('[data-testid="reauthenticate-button"]').should('be.visible');
    
    // Click reauthenticate
    cy.get('[data-testid="reauthenticate-button"]').click();
    
    // Verify mock login form appears
    cy.get('[data-testid="login-form"]').should('be.visible');
    
    // Fill in credentials
    cy.get('[data-testid="username-input"]').type('testuser');
    cy.get('[data-testid="password-input"]').type('password');
    cy.get('[data-testid="login-button"]').click();
    
    // Verify successful reauth
    cy.get('[data-testid="login-form"]').should('not.exist');
    cy.get('[data-testid="session-expired-message"]').should('not.exist');
    cy.get('[data-testid="connection-status"]').should('contain.text', 'Connected');
  });
}); 