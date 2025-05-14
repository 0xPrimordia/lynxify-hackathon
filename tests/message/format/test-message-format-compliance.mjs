/**
 * Test: test-message-format-compliance
 * 
 * Purpose: Tests message format compliance with the HCS-10 protocol standard
 * and compares message handling between our implementation and the reference
 * standards-expert implementation.
 * 
 * Test procedure:
 * 1. Generate sample messages in various formats
 * 2. Apply message extraction logic from both implementations
 * 3. Compare the extracted content
 * 4. Identify format compatibility issues
 * 
 * Expected results:
 * - Clear identification of message format differences
 * - Recommendations for format alignment
 * - Test messages that work with both implementations
 * 
 * Related components:
 * - HCS10AgentHandler.processApplicationMessage
 * - StandardsExpertAgent.handleStandardMessage
 * 
 * Author: Claude AI
 * Date: 2023-05-13
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

// Initialize environment
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPORT_FILE = path.resolve(process.cwd(), 'message-format-report.json');

// Message extraction logic from HCS10AgentHandler (our implementation)
function extractMessageContentLynxify(message) {
  let messageText = '';
  
  if (message.text) {
    messageText = message.text;
  } else if (message.data) {
    if (typeof message.data === 'string') {
      try {
        // Try to parse as JSON
        const jsonData = JSON.parse(message.data);
        messageText = jsonData.text || jsonData.message || jsonData.content || JSON.stringify(jsonData);
      } catch (e) {
        // Not JSON, use as is
        messageText = message.data;
      }
    } else {
      messageText = JSON.stringify(message.data);
    }
  }
  
  return messageText;
}

// Message extraction logic from StandardsExpertAgent (reference implementation)
function extractMessageContentStandardsExpert(message) {
  if (!message.data) {
    return '';
  }
  
  let questionText = message.data;
  try {
    if (isJson(message.data)) {
      const jsonData = JSON.parse(message.data);
      questionText = extractAllText(jsonData);
    }
  } catch (error) {
    console.debug(`Failed to parse message as JSON: ${error}`);
  }
  
  return questionText;
}

// Helper function for StandardsExpertAgent implementation
function isJson(str) {
  if (typeof str !== 'string') return false;
  try {
    const result = JSON.parse(str);
    return typeof result === 'object';
  } catch (e) {
    return false;
  }
}

// Helper function for StandardsExpertAgent implementation
function extractAllText(obj) {
  if (!obj) return '';
  
  if (typeof obj === 'string') return obj;
  
  if (Array.isArray(obj)) {
    return obj.map(extractAllText).join(' ');
  }
  
  if (typeof obj === 'object') {
    const textProperties = [
      'text', 'message', 'content', 'query', 'question'
    ];
    
    for (const prop of textProperties) {
      if (obj[prop] && typeof obj[prop] === 'string') {
        return obj[prop];
      }
    }
    
    return Object.values(obj)
      .map(extractAllText)
      .filter(t => t)
      .join(' ');
  }
  
  return '';
}

// Test sample messages
const testMessages = [
  {
    name: 'Simple text message',
    message: {
      p: 'hcs-10',
      op: 'message',
      text: 'Hello, this is a test message',
      sequence_number: 1,
      created: new Date(),
      connection_topic_id: '0.0.12345'
    }
  },
  {
    name: 'JSON string in data field',
    message: {
      p: 'hcs-10',
      op: 'message',
      data: '{"text":"Hello, this is a test message with JSON in data field"}',
      sequence_number: 2,
      created: new Date(),
      connection_topic_id: '0.0.12345'
    }
  },
  {
    name: 'Plain string in data field',
    message: {
      p: 'hcs-10',
      op: 'message',
      data: 'Hello, this is a plain text in data field',
      sequence_number: 3,
      created: new Date(),
      connection_topic_id: '0.0.12345'
    }
  },
  {
    name: 'Object in data field with text property',
    message: {
      p: 'hcs-10',
      op: 'message',
      data: { text: 'Hello, this is an object with text property' },
      sequence_number: 4,
      created: new Date(),
      connection_topic_id: '0.0.12345'
    }
  },
  {
    name: 'Object in data field with message property',
    message: {
      p: 'hcs-10',
      op: 'message',
      data: { message: 'Hello, this is an object with message property' },
      sequence_number: 5,
      created: new Date(),
      connection_topic_id: '0.0.12345'
    }
  },
  {
    name: 'JSON string in data with complex content',
    message: {
      p: 'hcs-10',
      op: 'message',
      data: '{"query":"What is Hedera?","options":{"detailed":true}}',
      sequence_number: 6,
      created: new Date(),
      connection_topic_id: '0.0.12345'
    }
  },
  {
    name: 'Empty data field',
    message: {
      p: 'hcs-10',
      op: 'message',
      data: '',
      sequence_number: 7,
      created: new Date(),
      connection_topic_id: '0.0.12345'
    }
  },
  {
    name: 'Malformed JSON in data field',
    message: {
      p: 'hcs-10',
      op: 'message',
      data: '{text:"This is malformed JSON"}',
      sequence_number: 8,
      created: new Date(),
      connection_topic_id: '0.0.12345'
    }
  },
  {
    name: 'Missing key fields',
    message: {
      op: 'message',
      sequence_number: 9,
      created: new Date(),
      connection_topic_id: '0.0.12345'
    }
  },
  {
    name: 'Standards Expert style message',
    message: {
      p: 'hcs-10',
      op: 'message',
      data: 'What is HCS-10?',
      sequence_number: 10,
      created: new Date(),
      timestamp: new Date().toISOString(),
      connection_topic_id: '0.0.12345'
    }
  }
];

// Test message formats
async function testMessageFormats() {
  console.log('========== TESTING MESSAGE FORMAT COMPLIANCE ==========');
  
  const results = [];
  let matchCount = 0;
  let mismatchCount = 0;
  
  for (const test of testMessages) {
    console.log(`\nTesting: ${test.name}`);
    
    // Extract with both implementations
    const lynxifyResult = extractMessageContentLynxify(test.message);
    const standardsExpertResult = extractMessageContentStandardsExpert(test.message);
    
    // Compare results
    const matches = lynxifyResult === standardsExpertResult;
    
    if (matches) {
      matchCount++;
      console.log('✅ Message format matches between implementations');
    } else {
      mismatchCount++;
      console.log('❌ Message format mismatch between implementations');
    }
    
    console.log(`Lynxify extracted: "${lynxifyResult}"`);
    console.log(`Standards Expert extracted: "${standardsExpertResult}"`);
    
    // Record result
    results.push({
      testName: test.name,
      message: test.message,
      lynxifyResult,
      standardsExpertResult,
      matches
    });
  }
  
  // Generate report
  const report = {
    timestamp: new Date().toISOString(),
    summary: {
      totalTests: testMessages.length,
      matches: matchCount,
      mismatches: mismatchCount,
      matchPercentage: (matchCount / testMessages.length) * 100
    },
    results
  };
  
  // Output summary
  console.log('\n========== MESSAGE FORMAT COMPLIANCE SUMMARY ==========');
  console.log(`Total tests: ${report.summary.totalTests}`);
  console.log(`Format matches: ${report.summary.matches}`);
  console.log(`Format mismatches: ${report.summary.mismatches}`);
  console.log(`Match percentage: ${report.summary.matchPercentage.toFixed(2)}%`);
  
  // Save report
  await fs.writeFile(REPORT_FILE, JSON.stringify(report, null, 2));
  console.log(`\n✅ Report saved to ${REPORT_FILE}`);
  
  // Generate recommendations
  if (report.summary.mismatches > 0) {
    console.log('\n========== RECOMMENDATIONS ==========');
    
    // Analyze mismatch patterns and provide recommendations
    const mismatchedResults = results.filter(r => !r.matches);
    
    // Check for JSON string in data field issues
    if (mismatchedResults.some(r => r.testName.includes('JSON string in data field'))) {
      console.log('1. Update JSON string parsing logic:');
      console.log('   - Look for nested text properties in parsed JSON');
      console.log('   - Consider implementing the extractAllText function');
    }
    
    // Check for object handling issues
    if (mismatchedResults.some(r => r.testName.includes('Object in data field'))) {
      console.log('2. Improve object handling:');
      console.log('   - Check for additional properties like query/question');
      console.log('   - Consider recursive property extraction for nested objects');
    }
    
    // Check for empty data issues
    if (mismatchedResults.some(r => r.testName.includes('Empty data field'))) {
      console.log('3. Handle empty data cases better:');
      console.log('   - Validate data presence before processing');
      console.log('   - Provide meaningful defaults for empty values');
    }
    
    // General recommendation
    console.log('4. Consider adopting the Standards Expert approach:');
    console.log('   - It handles a wider variety of message formats');
    console.log('   - Provides better nested property extraction');
    console.log('   - Consistent handling of different data types');
  }
  
  // Generate working message templates
  console.log('\n========== RECOMMENDED MESSAGE FORMATS ==========');
  console.log('Use these message formats for guaranteed compatibility:');
  
  const compatibleFormats = results.filter(r => r.matches).map(r => {
    const { p, op, text, data } = r.message;
    return { p, op, text, data };
  });
  
  for (let i = 0; i < Math.min(3, compatibleFormats.length); i++) {
    console.log(`\n${i + 1}. Compatible message format:`);
    console.log(JSON.stringify(compatibleFormats[i], null, 2));
  }
  
  return report;
}

// Main function
async function main() {
  try {
    await testMessageFormats();
    console.log('\n========== TEST COMPLETE ==========');
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Run the script
main().catch(console.error); 