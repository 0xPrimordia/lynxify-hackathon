#!/usr/bin/env node

/**
 * SDK Version Compatibility Check
 * 
 * This script checks the version of @hashgraphonline/standards-sdk being used
 * in our project against the version used in the reference implementation.
 * 
 * It helps identify potential version incompatibilities that could cause
 * connection and message handling issues.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import chalk from 'chalk';
import semver from 'semver';

// Constants
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '..');
const REFERENCE_ROOT = path.resolve(PROJECT_ROOT, 'reference-examples/standards-agent-kit');

// Analysis results
const results = {
  project: {
    path: path.join(PROJECT_ROOT, 'package.json'),
    version: null,
    dependencies: {}
  },
  reference: {
    path: path.join(REFERENCE_ROOT, 'package.json'),
    version: null,
    dependencies: {}
  },
  compatibilityIssues: []
};

/**
 * Read package.json and extract version information
 */
function readPackageJson(filePath) {
  try {
    const data = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error(`Error reading ${filePath}: ${error.message}`);
    return null;
  }
}

/**
 * Check compatibility between versions
 */
function checkCompatibility(projectVersion, referenceVersion, packageName) {
  if (!projectVersion || !referenceVersion) {
    return {
      compatible: false,
      reason: 'Missing version information'
    };
  }

  // Clean versions (remove ^ or ~ if present)
  const cleanProject = projectVersion.replace(/[\^~]/, '');
  const cleanReference = referenceVersion.replace(/[\^~]/, '');

  // If versions are exactly the same
  if (cleanProject === cleanReference) {
    return {
      compatible: true,
      reason: 'Exact match'
    };
  }

  // Check if project version is older than reference
  if (semver.lt(cleanProject, cleanReference)) {
    return {
      compatible: false,
      reason: `Project version (${cleanProject}) is older than reference (${cleanReference})`
    };
  }

  // Check major version compatibility
  const projectMajor = semver.major(cleanProject);
  const referenceMajor = semver.major(cleanReference);
  
  if (projectMajor !== referenceMajor) {
    return {
      compatible: false,
      reason: `Major version mismatch: Project ${projectMajor}.x vs Reference ${referenceMajor}.x`
    };
  }

  return {
    compatible: true,
    reason: `Compatible versions (Project: ${cleanProject}, Reference: ${cleanReference})`
  };
}

// Read package.json files
const projectPackage = readPackageJson(results.project.path);
const referencePackage = readPackageJson(results.reference.path);

if (!projectPackage) {
  console.error(chalk.red('❌ Could not read project package.json'));
  process.exit(1);
}

if (!referencePackage) {
  console.error(chalk.yellow('⚠️ Could not read reference package.json. Checking only project dependencies.'));
}

// Extract version information
results.project.version = projectPackage.version;
results.project.dependencies = {
  ...projectPackage.dependencies,
  ...projectPackage.devDependencies
};

if (referencePackage) {
  results.reference.version = referencePackage.version;
  results.reference.dependencies = {
    ...referencePackage.dependencies,
    ...referencePackage.devDependencies
  };
}

// Check SDK compatibility
const sdkPackages = [
  '@hashgraphonline/standards-sdk',
  '@hashgraph/sdk',
  '@hashgraphonline/standards-agent-kit'
];

console.log(chalk.blue('=== SDK Version Compatibility Check ==='));
console.log();

for (const pkg of sdkPackages) {
  const projectVersion = results.project.dependencies[pkg];
  const referenceVersion = referencePackage ? results.reference.dependencies[pkg] : null;
  
  console.log(chalk.bold(`Package: ${pkg}`));
  console.log(`Project: ${projectVersion || 'Not found'}`);
  console.log(`Reference: ${referenceVersion || 'Not found'}`);
  
  if (projectVersion && referenceVersion) {
    const compatibility = checkCompatibility(projectVersion, referenceVersion, pkg);
    
    if (compatibility.compatible) {
      console.log(chalk.green(`✅ ${compatibility.reason}`));
    } else {
      console.log(chalk.red(`❌ ${compatibility.reason}`));
      results.compatibilityIssues.push({
        package: pkg,
        project: projectVersion,
        reference: referenceVersion,
        reason: compatibility.reason
      });
    }
  } else if (!projectVersion) {
    console.log(chalk.red(`❌ Missing in project`));
    results.compatibilityIssues.push({
      package: pkg,
      reason: 'Missing in project'
    });
  } else if (!referenceVersion) {
    console.log(chalk.yellow(`⚠️ Missing in reference (can't compare)`));
  }
  
  console.log();
}

// Print summary
console.log(chalk.blue('=== Summary ==='));
if (results.compatibilityIssues.length === 0) {
  console.log(chalk.green('✅ No compatibility issues found'));
} else {
  console.log(chalk.red(`❌ Found ${results.compatibilityIssues.length} potential compatibility issues:`));
  
  for (const issue of results.compatibilityIssues) {
    console.log(`  - ${issue.package}: ${issue.reason}`);
  }
  
  console.log();
  console.log(chalk.yellow('Recommendation:'));
  console.log('  1. Update dependencies to match reference implementation');
  console.log('  2. Check for API changes in newer versions');
  console.log('  3. Update code to use compatible API methods');
} 