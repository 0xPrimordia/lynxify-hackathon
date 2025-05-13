#!/usr/bin/env node

import { execSync } from 'child_process';

try {
  console.log('🔨 Building HCS10 agent...');
  
  // Build using tsconfig.hcs10.json
  execSync('tsc --project tsconfig.hcs10.json', { stdio: 'inherit' });
  
  console.log('✅ Build successful');

} catch (error) {
  console.error('❌ Build failed:', error);
  process.exit(1);
}
