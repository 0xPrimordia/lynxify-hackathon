#!/usr/bin/env node --experimental-specifier-resolution=node --experimental-import-meta-resolve
/**
 * ConnectionsManager Integration Test
 * Tests the compatibility between standards-sdk ConnectionsManager and the project
 */

import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

// Set up __dirname equivalent for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

// Environment variables
const operatorId = process.env.NEXT_PUBLIC_OPERATOR_ID || '';
const operatorKey = process.env.OPERATOR_KEY || '';
const inboundTopicId = process.env.NEXT_PUBLIC_HCS_INBOUND_TOPIC || '';
const outboundTopicId = process.env.NEXT_PUBLIC_HCS_OUTBOUND_TOPIC || '';

console.log('📊 Starting ConnectionsManager compatibility test');
console.log('Environment variables:');
console.log(`- Operator ID: ${operatorId ? '✅ Set' : '❌ Missing'}`);
console.log(`- Operator Key: ${operatorKey ? '✅ Set' : '❌ Missing'}`);
console.log(`- Inbound Topic: ${inboundTopicId}`);
console.log(`- Outbound Topic: ${outboundTopicId}`);

async function testConnections() {
  try {
    console.log('\n🔍 Testing import compatibility...');

    // Method 1: Try createRequire method
    console.log('\n📦 Testing createRequire import method:');
    try {
      const require = createRequire(import.meta.url);
      const standardsSDK = require('@hashgraphonline/standards-sdk');
      
      if (standardsSDK && standardsSDK.ConnectionsManager) {
        console.log('✅ ConnectionsManager found via createRequire');
        console.log(`   Package version: ${standardsSDK.version || 'unknown'}`);
        
        // Check if we can instantiate it
        const cm = new standardsSDK.ConnectionsManager({
          logLevel: 'debug'
        });
        
        console.log('✅ ConnectionsManager instance created successfully');
        
        // Check the methods
        const methods = Object.getOwnPropertyNames(Object.getPrototypeOf(cm))
          .filter(method => method !== 'constructor');
        
        console.log('Available methods:', methods.join(', '));
      } else {
        console.error('❌ ConnectionsManager not found in the module');
      }
    } catch (error) {
      console.error('❌ createRequire method failed:', error.message);
    }
    
    // Method 2: Try dynamic import method
    console.log('\n📦 Testing dynamic import method:');
    try {
      const standardsSDK = await import('@hashgraphonline/standards-sdk');
      
      if (standardsSDK && 'ConnectionsManager' in standardsSDK) {
        console.log('✅ ConnectionsManager found via dynamic import');
        
        // Check if we can instantiate it
        const cm = new standardsSDK.ConnectionsManager({
          logLevel: 'debug'
        });
        
        console.log('✅ ConnectionsManager instance created successfully');
        
        // Check the methods
        const methods = Object.getOwnPropertyNames(Object.getPrototypeOf(cm))
          .filter(method => method !== 'constructor');
          
        console.log('Available methods:', methods.join(', '));
      } else {
        console.error('❌ ConnectionsManager not found in the dynamically imported module');
      }
    } catch (error) {
      console.error('❌ Dynamic import method failed:', error.message);
    }
    
    // Check for package conflicts
    console.log('\n📦 Checking for package conflicts:');
    try {
      // Find all instances of standards-sdk in node_modules
      const { execSync } = await import('child_process');
      const result = execSync('find ./node_modules -name "standards-sdk" -type d', { encoding: 'utf8' });
      
      const paths = result.trim().split('\n').filter(Boolean);
      
      if (paths.length > 1) {
        console.warn('⚠️ Multiple standards-sdk paths found:');
        paths.forEach(p => console.log(`   - ${p}`));
        
        // Try to find package.json for each path to determine versions
        for (const p of paths) {
          try {
            const pkgPath = path.join(process.cwd(), p, 'package.json');
            const require = createRequire(import.meta.url);
            const pkg = require(pkgPath);
            console.log(`   - ${p}: version ${pkg.version || 'unknown'}`);
          } catch (err) {
            console.log(`   - ${p}: unable to determine version`);
          }
        }
      } else if (paths.length === 1) {
        console.log(`✅ Single standards-sdk path found: ${paths[0]}`);
      } else {
        console.warn('⚠️ No standards-sdk directory found in node_modules');
      }
    } catch (error) {
      console.error('Error checking for package conflicts:', error.message);
    }
    
    console.log('\n📊 Test completed.');
  } catch (error) {
    console.error('❌ Unhandled error:', error);
  }
}

// Run the test
testConnections().catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
}); 