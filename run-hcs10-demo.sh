#!/bin/bash

# HCS-10 OpenConvAI Demo Runner
# This script runs the HCS-10 OpenConvAI integration demo

echo "🚀 Running HCS-10 OpenConvAI Demo for Hedera Hackathon"
echo "======================================================"
echo ""

echo "📋 Checking environment..."
if [ ! -f .env.local ]; then
  echo "❌ Error: .env.local file not found."
  echo "Please create a .env.local file with your Hedera credentials:"
  echo "NEXT_PUBLIC_OPERATOR_ID=your_operator_id"
  echo "OPERATOR_KEY=your_private_key"
  echo "NEXT_PUBLIC_HCS_GOVERNANCE_TOPIC=0.0.5898548"
  echo "NEXT_PUBLIC_HCS_INBOUND_TOPIC=0.0.5949494  # Moonscape inbound channel"
  echo "NEXT_PUBLIC_HCS_OUTBOUND_TOPIC=0.0.5949493  # Moonscape outbound channel"
  echo "NEXT_PUBLIC_HCS_PROFILE_TOPIC=0.0.5949512  # Moonscape profile"
  exit 1
fi

echo "✅ Environment file found."
echo ""

# Check if Moonscape channels are configured
if grep -q "NEXT_PUBLIC_HCS_INBOUND_TOPIC" .env.local && grep -q "NEXT_PUBLIC_HCS_OUTBOUND_TOPIC" .env.local; then
  echo "🌙 Moonscape channels detected in environment!"
  echo "The demo will test integration with Moonscape.tech"
  echo ""
else
  echo "⚠️ Moonscape channels not detected in environment."
  echo "The demo will only test basic HCS-10 functionality."
  echo "For full Moonscape integration, add these to your .env.local:"
  echo "NEXT_PUBLIC_HCS_INBOUND_TOPIC=0.0.5949494  # Moonscape inbound channel"
  echo "NEXT_PUBLIC_HCS_OUTBOUND_TOPIC=0.0.5949493  # Moonscape outbound channel"
  echo "NEXT_PUBLIC_HCS_PROFILE_TOPIC=0.0.5949512  # Moonscape profile"
  echo ""
fi

echo "🔄 Running the HCS-10 OpenConvAI demo..."
npx ts-node hcs10-demo.ts

STATUS=$?
if [ $STATUS -eq 0 ]; then
  echo ""
  echo "🎉 Demo completed successfully!"
  echo ""
  echo "This demo demonstrates our implementation of the HCS-10 OpenConvAI standard,"
  echo "which includes:"
  echo "  - Agent registration with the HCS-10 registry"
  echo "  - Topic subscription using the HCS-10 protocol"
  echo "  - Structured message exchange following the HCS-10 standard"
  echo "  - Full round-trip communication verification"
  
  if grep -q "NEXT_PUBLIC_HCS_INBOUND_TOPIC" .env.local && grep -q "NEXT_PUBLIC_HCS_OUTBOUND_TOPIC" .env.local; then
    echo ""
    echo "🌙 Moonscape.tech Integration:"
    echo "  - Agent is fully registered on Moonscape.tech"
    echo "  - Messages can be sent and received through Moonscape channels"
    echo "  - Visit https://moonscape.tech/openconvai to view your agent"
    echo "  - Connect your Hedera wallet on the site to manage your agent"
  fi
else
  echo ""
  echo "❌ Demo failed with status code $STATUS."
  echo "Please check the error messages above."
fi

exit $STATUS 