#!/bin/bash

# Start the refactored server
echo "Starting refactored Lynxify Rebalancer server..."
echo "-----------------------------------------------"

# Make sure the script directory exists
mkdir -p dist/app

# Compile TypeScript files
echo "Compiling TypeScript files..."
npx tsc --project tsconfig.server.json

# Check if compilation was successful
if [ $? -eq 0 ]; then
  echo "Compilation successful!"
  
  # Run the refactored server using TS-Node for development
  echo "Starting server..."
  ts-node --compilerOptions '{"module":"commonjs"}' src/app/start-server.ts
else
  echo "Compilation failed. Please fix the errors and try again."
  exit 1
fi 