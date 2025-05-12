import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

// Constants
const CONNECTIONS_FILE = path.join(process.cwd(), '.connections.json');
const AGENT_STATUS_FILE = path.join(process.cwd(), '.agent_status.json');

// Force dynamic rendering for API routes
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * GET endpoint to list all connections
 */
export async function GET() {
  try {
    let connections = [];
    let status = {};
    
    // Try to read the connections file
    try {
      const data = await fs.readFile(CONNECTIONS_FILE, 'utf8');
      connections = JSON.parse(data);
    } catch (err) {
      // File doesn't exist yet or is invalid
      console.log('No connections file found or invalid JSON');
    }
    
    // Try to read the agent status file for more information
    try {
      const statusData = await fs.readFile(AGENT_STATUS_FILE, 'utf8');
      status = JSON.parse(statusData);
    } catch (err) {
      // Status file doesn't exist yet
      console.log('No agent status file found');
    }
    
    return NextResponse.json({ 
      connections,
      count: connections.length,
      status
    });
  } catch (error) {
    console.error('Error listing connections:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
} 