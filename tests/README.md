# HCS-10 Agent Testing

This directory contains a structured set of tests for diagnosing and resolving issues with the HCS-10 agent's messaging capabilities.

## Directory Structure

```
tests/
├── connection/             # Connection management tests
│   ├── validation/         # Connection validation tests
│   └── lifecycle/          # Connection lifecycle tests (future)
├── message/                # Message handling tests
│   ├── format/             # Message format tests
│   ├── parsing/            # Message parsing tests (future)
│   └── filtering/          # Message filtering tests (future)
├── response/               # Response generation tests (future)
│   ├── format/             # Response format tests (future)
│   └── delivery/           # Response delivery tests (future)
├── integration/            # End-to-end tests (future)
├── diagnostics/            # Diagnostic tools (future)
└── utils/                  # Test utilities (future)
```

## Available Tests

### Connection Tests

1. **Connection Status Validation** (`connection/validation/test-connection-status-validation.mjs`)
   - Validates connection statuses in `.connections.json`
   - Identifies invalid and duplicate connections
   - Creates a detailed report of connection issues
   - Can optionally fix common problems with `--fix` flag
   - Can verify topics exist on the network with `--verify-topics` flag

### Message Tests

1. **Message Format Compliance** (`message/format/test-message-format-compliance.mjs`)
   - Tests message format compliance with the HCS-10 protocol
   - Compares message handling between our implementation and the reference Standards Expert
   - Identifies format compatibility issues
   - Provides recommendations for format alignment

## Running Tests

You can run these tests using npm scripts:

```bash
# Connection validation test
npm run test:agent:connection

# Message format test
npm run test:agent:message

# Fix connection issues
npm run test:agent:fix-connections

# Verify topic existence on Hedera network
npm run test:agent:verify-topics
```

## Test Reports

Tests generate detailed reports in the project root:
- `connection-validation-report.json` - Results of connection validation
- `message-format-report.json` - Results of message format testing

## Adding New Tests

When adding new tests, please follow these guidelines:

1. Place tests in the appropriate subdirectory
2. Follow the established naming convention: `test-[category]-[component]-[function].mjs`
3. Include proper documentation in the test file header
4. Add an npm script to make the test easy to run

## Integration with Standards Expert

The test suite is designed to help align our implementation with the Standards Expert reference implementation found in:
`/reference-examples/standards-agent-kit/examples/standards-expert/`

By comparing message handling, connection management, and other key features, we can ensure our agent behaves consistently with the HCS-10 protocol standards. 