#!/usr/bin/env node

/**
 * Script to investigate and fix the ConnectionsManager import issue
 */

import { exec } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';
import util from 'util';

const execAsync = util.promisify(exec);

async function main() {
  console.log('🔍 Investigating ConnectionsManager import issue...');
  
  // Check the current standards-sdk version
  try {
    const { stdout: versionOutput } = await execAsync('npm list @hashgraphonline/standards-sdk');
    console.log('Current package versions:');
    console.log(versionOutput);
    
    // Check if we have multiple versions
    if (versionOutput.includes('deduped')) {
      console.log('⚠️ Multiple versions detected, this can cause import issues');
    }
  } catch (error) {
    console.error('Error checking package version:', error.message);
  }

  // Check the package exports
  try {
    const { stdout } = await execAsync('node -e "console.log(Object.keys(require(\'@hashgraphonline/standards-sdk\')))"');
    console.log('Package exports:');
    console.log(stdout);
    
    if (!stdout.includes('ConnectionsManager')) {
      console.log('⚠️ ConnectionsManager not found in the package exports');
    }
  } catch (error) {
    console.error('Error checking package exports:', error.message);
  }
  
  // Try different import strategies
  console.log('Trying different import strategies...');
  
  const strategies = [
    {
      name: 'Default require',
      code: 'console.log("ConnectionsManager =", require("@hashgraphonline/standards-sdk").ConnectionsManager)'
    },
    {
      name: 'Named import',
      code: 'const { ConnectionsManager } = require("@hashgraphonline/standards-sdk"); console.log("ConnectionsManager =", ConnectionsManager)'
    },
    {
      name: 'Direct path import',
      code: 'console.log("ConnectionsManager =", require("@hashgraphonline/standards-sdk/lib/hcs-10/connections-manager"))'
    }
  ];
  
  for (const strategy of strategies) {
    try {
      console.log(`\nTrying ${strategy.name}:`);
      const { stdout, stderr } = await execAsync(`node -e "${strategy.code}"`);
      console.log(stdout || 'No output');
      if (stderr) console.error(stderr);
    } catch (error) {
      console.error(`Error with ${strategy.name}:`, error.message);
    }
  }
  
  // Check package structure
  try {
    const packagePath = path.dirname(require.resolve('@hashgraphonline/standards-sdk/package.json'));
    console.log(`\nPackage path: ${packagePath}`);
    
    // List the package contents
    const { stdout: lsOutput } = await execAsync(`ls -la ${packagePath}`);
    console.log('Package contents:');
    console.log(lsOutput);
    
    // Check if there's a lib directory
    const libPath = path.join(packagePath, 'lib');
    try {
      await fs.access(libPath);
      const { stdout: libOutput } = await execAsync(`ls -la ${libPath}`);
      console.log('lib directory contents:');
      console.log(libOutput);
      
      // Check if there's an hcs-10 directory
      const hcs10Path = path.join(libPath, 'hcs-10');
      try {
        await fs.access(hcs10Path);
        const { stdout: hcs10Output } = await execAsync(`ls -la ${hcs10Path}`);
        console.log('hcs-10 directory contents:');
        console.log(hcs10Output);
      } catch (error) {
        console.log('hcs-10 directory not found');
      }
    } catch (error) {
      console.log('lib directory not found');
    }
  } catch (error) {
    console.error('Error checking package structure:', error.message);
  }
  
  console.log('\n📋 Summary:');
  console.log('1. Make sure @hashgraphonline/standards-sdk is at version 0.0.95 or higher');
  console.log('2. Try reinstalling the package with npm install @hashgraphonline/standards-sdk@latest');
  console.log('3. Check for the correct import path based on the package structure');
  console.log('4. Update the import in enhanced-hcs10-agent.ts based on the findings');
}

main().catch(error => {
  console.error('Script failed:', error);
  process.exit(1);
}); 