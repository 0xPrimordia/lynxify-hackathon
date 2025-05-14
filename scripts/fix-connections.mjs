#!/usr/bin/env node

/**
 * Connection Fix Utility
 * 
 * This script fixes common issues with the .connections.json file:
 * 1. Changes "pending" status connections to "established"
 * 2. Removes connections with invalid topic ID formats
 * 3. Removes duplicate connections for the same topic
 * 
 * Usage:
 *   node scripts/fix-connections.mjs [--backup] [--dry-run]
 * 
 * Options:
 *   --backup    Create a backup of the original file (default: true)
 *   --dry-run   Show what changes would be made without applying them
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

// Constants
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CONNECTIONS_FILE = path.resolve(process.cwd(), '.connections.json');
const BACKUP_FILE = path.resolve(process.cwd(), '.connections.json.backup');
const HEDERA_ID_REGEX = /^0\.0\.\d+$/;

// Command line arguments
const DRY_RUN = process.argv.includes('--dry-run');
const CREATE_BACKUP = !process.argv.includes('--no-backup');

async function main() {
  console.log('========== CONNECTION FIX UTILITY ==========');
  console.log(`Mode: ${DRY_RUN ? 'Dry Run (no changes will be applied)' : 'Live Run'}`);
  
  try {
    // Read the connections file
    console.log(`Reading connections from ${CONNECTIONS_FILE}...`);
    const data = await fs.readFile(CONNECTIONS_FILE, 'utf8');
    let connections;
    
    try {
      connections = JSON.parse(data);
      console.log(`Loaded ${connections.length} connections`);
    } catch (error) {
      console.error(`Failed to parse connections file: ${error}`);
      process.exit(1);
    }
    
    // Create backup if not in dry-run mode
    if (!DRY_RUN && CREATE_BACKUP) {
      await fs.writeFile(BACKUP_FILE, data);
      console.log(`Created backup at ${BACKUP_FILE}`);
    }
    
    // Statistics for tracking changes
    const stats = {
      total: connections.length,
      pendingFixed: 0,
      invalidRemoved: 0,
      duplicatesRemoved: 0
    };
    
    // Maps to track connections
    const connectionsByTopic = new Map();
    const validatedConnections = [];
    
    // Process each connection
    for (const conn of connections) {
      let isValid = true;
      let status = 'processed';
      
      // Check connection status
      if (conn.status === 'pending' && conn.connectionTopicId) {
        console.log(`Fixing pending connection with topic ${conn.connectionTopicId}`);
        conn.status = 'established';
        stats.pendingFixed++;
        status = 'fixed-pending';
      }
      
      // Check connection topic ID format
      if (conn.connectionTopicId && !HEDERA_ID_REGEX.test(conn.connectionTopicId)) {
        console.log(`Removing connection with invalid topic format: ${conn.connectionTopicId}`);
        isValid = false;
        stats.invalidRemoved++;
        status = 'removed-invalid';
      }
      
      // Check for duplicates
      if (isValid && conn.connectionTopicId) {
        if (connectionsByTopic.has(conn.connectionTopicId)) {
          const existingIndex = connectionsByTopic.get(conn.connectionTopicId);
          console.log(`Removing duplicate connection for topic ${conn.connectionTopicId} (keeping index ${existingIndex})`);
          isValid = false;
          stats.duplicatesRemoved++;
          status = 'removed-duplicate';
        } else {
          connectionsByTopic.set(conn.connectionTopicId, validatedConnections.length);
        }
      }
      
      // Add valid connections to the filtered list
      if (isValid) {
        validatedConnections.push(conn);
      }
      
      // Log the action taken (for dry run)
      if (DRY_RUN) {
        console.log(`[DRY RUN] ${status}: ${conn.connectionTopicId || 'unknown'} (${conn.status || 'unknown'})`);
      }
    }
    
    // Calculate stats
    stats.remaining = validatedConnections.length;
    stats.totalRemoved = stats.invalidRemoved + stats.duplicatesRemoved;
    stats.percentRemoved = ((stats.totalRemoved / stats.total) * 100).toFixed(2);
    
    // Print summary
    console.log('\n========== SUMMARY ==========');
    console.log(`Total original connections: ${stats.total}`);
    console.log(`Pending connections fixed: ${stats.pendingFixed}`);
    console.log(`Invalid topic formats removed: ${stats.invalidRemoved}`);
    console.log(`Duplicate connections removed: ${stats.duplicatesRemoved}`);
    console.log(`Total connections removed: ${stats.totalRemoved} (${stats.percentRemoved}%)`);
    console.log(`Remaining valid connections: ${stats.remaining}`);
    
    // Save changes if not in dry-run mode
    if (!DRY_RUN) {
      await fs.writeFile(CONNECTIONS_FILE, JSON.stringify(validatedConnections, null, 2));
      console.log(`\nSaved ${validatedConnections.length} connections to ${CONNECTIONS_FILE}`);
    } else {
      console.log('\n[DRY RUN] No changes were applied. Run without --dry-run to apply changes.');
    }
    
    console.log('\n========== COMPLETE ==========');
  } catch (error) {
    console.error(`Error: ${error}`);
    process.exit(1);
  }
}

// Run the script
main().catch(console.error); 