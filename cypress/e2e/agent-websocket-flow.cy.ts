/// <reference types="cypress" />

describe('Agent WebSocket Integration Flow', () => {
  beforeEach(() => {
    // Visit the main application page
    cy.visit('/');
    
    // Wait for initial load
    cy.get('[data-testid="dashboard"]').should('be.visible');
  });
  
  it('Should show agent status and initial composition', () => {
    // Verify agent status is displayed
    cy.get('[data-testid="agent-status"]').should('exist');
    cy.get('[data-testid="agent-status"]').should('contain.text', 'Initialized');
    
    // Verify index composition is displayed
    cy.get('[data-testid="index-composition"]').should('exist');
    cy.get('[data-testid="weight-BTC"]').should('contain.text', 'BTC:');
    cy.get('[data-testid="weight-ETH"]').should('contain.text', 'ETH:');
    cy.get('[data-testid="weight-SOL"]').should('contain.text', 'SOL:');
  });
  
  it('Should complete a full rebalance proposal flow', () => {
    // Open rebalance proposal modal
    cy.get('[data-testid="open-rebalance-modal"]').click();
    
    // Verify modal is displayed
    cy.get('[data-testid="rebalance-modal"]').should('be.visible');
    
    // Update token weights
    cy.get('[data-testid="weight-input-BTC"]').clear().type('0.5');
    cy.get('[data-testid="weight-input-ETH"]').clear().type('0.3');
    cy.get('[data-testid="weight-input-SOL"]').clear().type('0.2');
    
    // Submit proposal
    cy.get('[data-testid="submit-proposal"]').click();
    
    // Verify proposal message is received
    cy.get('[data-testid="message-feed"]').should('exist');
    cy.wait(300); // Wait for WebSocket response
    cy.get('[data-testid="message-item"]').should('contain.text', 'RebalanceProposed');
    
    // Verify proposal approval
    cy.wait(500); // Wait for approval
    cy.get('[data-testid="message-item"]').should('contain.text', 'RebalanceApproved');
    
    // Verify execution
    cy.wait(1000); // Wait for execution
    cy.get('[data-testid="message-item"]').should('contain.text', 'RebalanceExecuted');
    
    // Verify weights updated
    cy.get('[data-testid="weight-BTC"]').should('contain.text', 'BTC: 0.5');
    cy.get('[data-testid="weight-ETH"]').should('contain.text', 'ETH: 0.3');
    cy.get('[data-testid="weight-SOL"]').should('contain.text', 'SOL: 0.2');
  });
  
  it('Should handle risk alerts from the agent', () => {
    // Trigger a risk alert simulation
    // This would typically be triggered from the UI, but for test purposes
    // we're assuming there's a button to simulate a risk alert
    cy.get('[data-testid="simulate-risk-alert"]').click();
    
    // Verify risk alert is displayed in the message feed
    cy.wait(300);
    cy.get('[data-testid="message-item"]').should('contain.text', 'RiskAlert');
    
    // Verify risk alert details
    cy.get('[data-testid="risk-severity-high"]').should('exist');
    cy.get('[data-testid="affected-token-SOL"]').should('exist');
  });
  
  it('Should perform token operations via WebSocket', () => {
    // Navigate to token operations panel
    cy.get('[data-testid="token-operations-tab"]').click();
    
    // Select mint operation
    cy.get('[data-testid="operation-select"]').select('mint');
    
    // Select token
    cy.get('[data-testid="token-select"]').select('BTC');
    
    // Enter amount
    cy.get('[data-testid="amount-input"]').clear().type('5');
    
    // Execute operation
    cy.get('[data-testid="execute-operation"]').click();
    
    // Verify operation result
    cy.wait(500);
    cy.get('[data-testid="message-item"]').should('contain.text', 'token_operation_result');
    cy.get('[data-testid="operation-success"]').should('exist');
    
    // Check updated balance
    cy.get('[data-testid="token-balance-BTC"]').should('contain.text', '15'); // 10 + 5
  });
  
  it('Should handle agent connection interruption', () => {
    // Simulate connection loss
    cy.window().then(win => {
      // Mock disconnection event
      const disconnectEvent = new Event('disconnect');
      win.dispatchEvent(disconnectEvent);
    });
    
    // Verify disconnection state is shown
    cy.get('[data-testid="connection-status"]').should('contain.text', 'Disconnected');
    
    // Simulate reconnection
    cy.get('[data-testid="reconnect-button"]').click();
    
    // Verify reconnected state
    cy.wait(300);
    cy.get('[data-testid="connection-status"]').should('contain.text', 'Connected');
    
    // Verify agent status is restored
    cy.get('[data-testid="agent-status"]').should('contain.text', 'Initialized');
  });
}); 