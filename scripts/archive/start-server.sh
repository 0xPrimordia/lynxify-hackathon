#!/bin/bash

# This script starts the server with HCS-10 compatibility

# Set colors for better readability
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}===============================================${NC}"
echo -e "${BLUE}  Lynxify Index with HCS-10 OpenConvAI Server  ${NC}"
echo -e "${BLUE}===============================================${NC}"
echo ""

echo -e "${YELLOW}Starting server with HCS-10 OpenConvAI support...${NC}"
echo ""

# Check environment variables
if [ -z "$OPERATOR_ID" ] || [ -z "$OPERATOR_KEY" ]; then
    echo -e "${YELLOW}Warning: OPERATOR_ID or OPERATOR_KEY environment variables not found.${NC}"
    echo -e "${YELLOW}HCS-10 agent registration may fail without these credentials.${NC}"
    echo ""
fi

# Check required topics
if [ -z "$NEXT_PUBLIC_HCS_GOVERNANCE_TOPIC" ] || [ -z "$NEXT_PUBLIC_HCS_AGENT_TOPIC" ] || [ -z "$NEXT_PUBLIC_HCS_PRICE_FEED_TOPIC" ]; then
    echo -e "${YELLOW}Warning: One or more HCS topic IDs are missing.${NC}"
    echo -e "${YELLOW}The server will use default topic IDs which may not work in your environment.${NC}"
    echo ""
fi

# Start the server
echo -e "${GREEN}Server starting using HCS-10 OpenConvAI for agent communication...${NC}"
echo ""

# Run the server
node dist/server/server.js

# Catch interrupts
trap "echo -e '${RED}Server stopped.${NC}'" SIGINT SIGTERM

# Wait for server to exit
wait $! 