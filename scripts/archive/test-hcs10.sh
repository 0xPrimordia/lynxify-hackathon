#!/bin/bash

# This script runs the HCS-10 integration test

# Set colors for better readability
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}======================================${NC}"
echo -e "${BLUE}  HCS-10 OpenConvAI Integration Test  ${NC}"
echo -e "${BLUE}======================================${NC}"
echo ""

# Check if ts-node is installed
if ! command -v ts-node &> /dev/null; then
    echo -e "${RED}ts-node is not installed. Installing it globally...${NC}"
    npm install -g ts-node typescript
fi

# Check if the test file exists
if [ ! -f "src/server/scripts/test-hcs10.ts" ]; then
    echo -e "${RED}Error: Test script not found at src/server/scripts/test-hcs10.ts${NC}"
    exit 1
fi

echo -e "${YELLOW}Running HCS-10 integration test...${NC}"
echo ""

# Run the test script
ts-node src/server/scripts/test-hcs10.ts

# Check the exit status
if [ $? -eq 0 ]; then
    echo ""
    echo -e "${GREEN}Test script completed successfully.${NC}"
    echo ""
    echo -e "${YELLOW}Next steps:${NC}"
    echo "1. If all tests passed, your HCS-10 integration is working correctly!"
    echo "2. If any tests failed, review the errors and fix them before deploying."
    echo ""
    echo "For more details, see HCS-10-INTEGRATION.md"
else
    echo ""
    echo -e "${RED}Test script failed. Please review the errors above.${NC}"
    echo ""
    echo -e "${YELLOW}Troubleshooting:${NC}"
    echo "1. Check your .env.local file for correct environment variables."
    echo "2. Ensure your Hedera account has enough HBAR for transactions."
    echo "3. Verify network connectivity to Hedera testnet."
    echo "4. Check src/server/services/openconvai.ts for implementation issues."
fi

echo ""
exit $? 