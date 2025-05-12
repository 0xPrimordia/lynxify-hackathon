import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

// Constants
const PENDING_CONNECTIONS_FILE = path.join(process.cwd(), '.pending_connections.json');

// Force dynamic rendering for API routes
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * GET endpoint to list pending connections
 */
export async function GET() {
  try {
    let pendingConnections = [];
    
    // Try to read the pending connections file
    try {
      const data = await fs.readFile(PENDING_CONNECTIONS_FILE, 'utf8');
      pendingConnections = JSON.parse(data);
    } catch (err) {
      // File doesn't exist yet or is invalid
      console.log('No pending connections file found or invalid JSON');
    }
    
    return NextResponse.json({ 
      pendingConnections,
      count: pendingConnections.length
    });
  } catch (error) {
    console.error('Error listing pending connections:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
} 