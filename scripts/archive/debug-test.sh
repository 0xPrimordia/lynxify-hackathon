#!/bin/bash

# Debug a specific test file
echo "Running test: $1"
echo "------------------------------"

# Set environment variables for testing
export NODE_ENV=test
export NEXT_PUBLIC_OPERATOR_ID=0.0.4340026
export OPERATOR_KEY=mock-private-key
export NEXT_PUBLIC_HCS_GOVERNANCE_TOPIC=0.0.12345
export NEXT_PUBLIC_HCS_AGENT_TOPIC=0.0.67890
export IS_TEST_ENV=true

# Run the test with verbose output
npm test -- --verbose $1 