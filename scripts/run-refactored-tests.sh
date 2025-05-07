#!/bin/bash

# Run the tests for the refactored server components
echo "Running tests for refactored server components..."
echo "------------------------------------------------"

# Server-init module tests (standard config)
echo "Testing server-init module..."
npm test -- src/__tests__/server/server-init.test.ts

# HCS-10 messaging integration tests (standard config)
echo "Testing HCS-10 messaging..."
npm test -- src/__tests__/integration/hcs10-messaging.test.ts

# Tests that require jsdom (browser environment)
echo "Running tests that require jsdom environment..."

# Agent registration tests (with jsdom config)
echo "Testing agent registration..."
npx jest --config=jest.jsdom.config.js src/__tests__/integration/agent-registration.test.ts

# Simple E2E tests (can run without jsdom)
echo "Testing E2E functionality..."
npm test -- src/__tests__/e2e/mock-e2e.test.ts

# Run mock server workflow E2E tests
echo "Testing mock server workflow..."
npm test -- src/__tests__/e2e/mock-server-workflow.test.ts

# Run rebalance flow E2E tests
echo "Testing rebalance flow E2E..."
npm test -- src/__tests__/e2e/rebalance-flow.test.ts

echo "Tests completed!" 