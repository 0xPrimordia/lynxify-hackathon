import { defineConfig } from 'cypress';

export default defineConfig({
  e2e: {
    baseUrl: 'http://localhost:3000',
    supportFile: 'cypress/support/e2e.ts',
    specPattern: 'cypress/e2e/**/*.cy.{js,jsx,ts,tsx}',
    setupNodeEvents(on, config) {
      // implement node event listeners here
      // Set environment variables for testing
      config.env = {
        ...config.env,
        NEXT_PUBLIC_OPERATOR_ID: '0.0.12345',
        NEXT_PUBLIC_HCS_GOVERNANCE_TOPIC: '0.0.12346',
        NEXT_PUBLIC_HCS_AGENT_TOPIC: '0.0.12347',
        NEXT_PUBLIC_HCS_PRICE_FEED_TOPIC: '0.0.12348',
        BYPASS_TOPIC_CHECK: 'true'
      };
      return config;
    },
  },
  component: {
    devServer: {
      framework: 'next',
      bundler: 'webpack',
    },
    specPattern: 'cypress/component/**/*.cy.{js,jsx,ts,tsx}',
  },
  viewportWidth: 1280,
  viewportHeight: 720,
  video: false,
  screenshotOnRunFailure: true,
}); 