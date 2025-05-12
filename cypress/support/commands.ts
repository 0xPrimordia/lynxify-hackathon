// ***********************************************
// Custom commands for Cypress
// ***********************************************

// Declare global Cypress namespace to add custom commands
declare global {
  namespace Cypress {
    interface Chainable {
      /**
       * Custom command to wait for websocket messages
       * @example cy.waitForWebSocketMessage('RebalanceProposed')
       */
      waitForWebSocketMessage(messageType: string): Chainable<void>;
      
      /**
       * Custom command to initiate a rebalance proposal from UI
       * @example cy.initiateRebalance({ BTC: 0.5, ETH: 0.3, SOL: 0.2 })
       */
      initiateRebalance(weights: Record<string, number>): Chainable<void>;
      
      /**
       * Custom command to execute token operation
       * @example cy.executeTokenOperation('mint', 'BTC', 5)
       */
      executeTokenOperation(operation: string, token: string, amount: number): Chainable<void>;
    }
  }
}

// Wait for specific websocket message type
Cypress.Commands.add('waitForWebSocketMessage', (messageType: string) => {
  cy.window().then(win => {
    return new Cypress.Promise(resolve => {
      // Setup interval to check messages
      const checkInterval = setInterval(() => {
        // Find message elements that match the expected type
        const messages = Array.from(document.querySelectorAll('[data-testid^="message-"]'));
        const found = messages.some(el => el.textContent?.includes(messageType));
        
        if (found) {
          clearInterval(checkInterval);
          resolve(true);
        }
      }, 100);
      
      // Set a timeout to prevent hanging
      setTimeout(() => {
        clearInterval(checkInterval);
        resolve(false);
      }, 10000);
    });
  });
});

// Initiate a rebalance proposal
Cypress.Commands.add('initiateRebalance', (weights: Record<string, number>) => {
  // Open rebalance modal
  cy.get('[data-testid="open-rebalance-modal"]').click();
  
  // Fill in weights (assuming UI has inputs for each token)
  Object.entries(weights).forEach(([token, weight]) => {
    cy.get(`[data-testid="weight-input-${token}"]`).clear().type(weight.toString());
  });
  
  // Submit proposal
  cy.get('[data-testid="submit-proposal"]').click();
  
  // Wait for proposal to be registered
  cy.waitForWebSocketMessage('RebalanceProposed');
});

// Execute token operation
Cypress.Commands.add('executeTokenOperation', (operation: string, token: string, amount: number) => {
  // Navigate to token operations panel
  cy.get('[data-testid="token-operations-tab"]').click();
  
  // Select operation
  cy.get('[data-testid="operation-select"]').select(operation);
  
  // Select token
  cy.get('[data-testid="token-select"]').select(token);
  
  // Enter amount
  cy.get('[data-testid="amount-input"]').clear().type(amount.toString());
  
  // Submit operation
  cy.get('[data-testid="execute-operation"]').click();
  
  // Wait for operation to complete
  cy.waitForWebSocketMessage('token_operation_result');
});

export {}; 