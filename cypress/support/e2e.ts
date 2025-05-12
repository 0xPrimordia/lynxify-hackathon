// Import Cypress commands
import './commands';

// Hide fetch/XHR requests in the Command Log
const app = window.top;
if (app && !app.document.head.querySelector('[data-hide-command-log-request]')) {
  const style = app.document.createElement('style');
  style.setAttribute('data-hide-command-log-request', '');
  style.innerHTML = '.command-name-request, .command-name-xhr { display: none }';
  app.document.head.appendChild(style);
}

// Custom behavior for Cypress tests
beforeEach(() => {
  // Mock WebSocket connection
  cy.on('window:before:load', (win) => {
    class MockWebSocket extends EventTarget {
      static OPEN = 1;
      static CLOSED = 3;

      url: string;
      readyState: number;
      OPEN: number;
      CLOSED: number;

      constructor(url: string) {
        super();
        this.url = url;
        this.readyState = MockWebSocket.OPEN;
        this.OPEN = MockWebSocket.OPEN;
        this.CLOSED = MockWebSocket.CLOSED;
        
        // Simulate immediate connection
        setTimeout(() => {
          const event = new Event('open');
          this.dispatchEvent(event);
        }, 0);
      }

      send(data: string) {
        // Process the message
        console.log('Mock WebSocket message sent:', data);
        
        // Simulate responses
        const message = JSON.parse(data);
        this.simulateResponse(message);
      }

      close() {
        this.readyState = MockWebSocket.CLOSED;
        const event = new Event('close');
        this.dispatchEvent(event);
      }

      addEventListener(type: string, listener: EventListener) {
        super.addEventListener(type, listener);
      }

      removeEventListener(type: string, listener: EventListener) {
        super.removeEventListener(type, listener);
      }

      // Simulate responses based on message type
      simulateResponse(message: any) {
        if (message.type === 'get_agent_status') {
          this.respondWithAgentStatus();
        } else if (message.type === 'rebalance_proposal') {
          this.respondWithRebalanceFlow(message.data);
        } else if (message.type === 'token_operation') {
          this.respondWithTokenOperation(message.data);
        }
      }

      // Simulate agent status response
      respondWithAgentStatus() {
        const response = {
          type: 'AgentStatus',
          data: {
            isInitialized: true,
            registrationStatus: 'registered',
            connectedAgents: 2,
            lastUpdated: Date.now()
          }
        };
        this.dispatchMessageEvent(response);
      }

      // Simulate rebalance flow (proposal, approval, execution)
      respondWithRebalanceFlow(data: any) {
        const proposalId = `proposal-${Date.now()}`;
        
        // Send proposal created response
        setTimeout(() => {
          const proposalResponse = {
            type: 'RebalanceProposed',
            data: {
              proposalId,
              newWeights: data.weights,
              trigger: 'user_initiated',
              timestamp: Date.now()
            }
          };
          this.dispatchMessageEvent(proposalResponse);
        }, 300);
        
        // Send approval response
        setTimeout(() => {
          const approvalResponse = {
            type: 'RebalanceApproved',
            data: {
              proposalId,
              approvedAt: Date.now()
            }
          };
          this.dispatchMessageEvent(approvalResponse);
        }, 800);
        
        // Send execution response
        setTimeout(() => {
          const executionResponse = {
            type: 'RebalanceExecuted',
            data: {
              proposalId,
              executedAt: Date.now(),
              newWeights: data.weights
            }
          };
          this.dispatchMessageEvent(executionResponse);
        }, 1500);
      }

      // Simulate token operation response
      respondWithTokenOperation(data: any) {
        setTimeout(() => {
          const response = {
            type: 'token_operation_result',
            data: {
              operation: data.operation,
              token: data.token,
              amount: data.amount,
              success: true,
              timestamp: Date.now()
            }
          };
          this.dispatchMessageEvent(response);
        }, 500);
      }

      // Helper to dispatch message event
      dispatchMessageEvent(data: any) {
        const event = new MessageEvent('message', {
          data: JSON.stringify(data)
        });
        this.dispatchEvent(event);
      }
    }

    // Replace the WebSocket constructor
    win.WebSocket = MockWebSocket as any;
  });
}); 