import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

// Constants
const APPROVAL_COMMAND_FILE = path.join(process.cwd(), '.approval_commands.json');

// Force dynamic rendering for API routes
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * POST endpoint to approve a connection - follows standards-expert example
 * This is a duplicate route for compatibility with client code that might be using this path
 */
export async function POST(
  request: Request,
) {
  try {
    // Get the connection ID either from URL or request body
    let connectionId;
    
    // Try to get from URL first
    const url = new URL(request.url);
    const urlConnectionId = url.pathname.split('/').pop();
    
    // Next try to get from request body
    try {
      const body = await request.json();
      connectionId = body.connectionId || urlConnectionId;
    } catch (e) {
      // If body parsing fails, use URL connectionId
      connectionId = urlConnectionId;
    }
    
    if (!connectionId) {
      return NextResponse.json(
        { success: false, error: 'Missing connection ID in request' },
        { status: 400 }
      );
    }
    
    console.log(`Processing approval request for connection: ${connectionId}`);
    
    // Write approval command to file for agent to process (following standards-expert example)
    const approvalCommand = {
      type: 'approve_connection',
      connectionId,
      timestamp: Date.now()
    };
    
    // Read existing commands (if any)
    let commands = [];
    try {
      const existingData = await fs.readFile(APPROVAL_COMMAND_FILE, 'utf8');
      commands = JSON.parse(existingData);
    } catch (err) {
      // File doesn't exist yet, start with empty array
      console.log('No existing commands file, creating new one');
    }
    
    // Add new command to list
    commands.push(approvalCommand);
    
    // Write back to file
    await fs.writeFile(APPROVAL_COMMAND_FILE, JSON.stringify(commands, null, 2));
    console.log(`Wrote approval command to ${APPROVAL_COMMAND_FILE}`);
    
    return NextResponse.json({ 
      success: true, 
      status: 'approval_requested', 
      message: 'Connection approval requested',
      connectionId 
    });
  } catch (error) {
    console.error('Error handling connection approval:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
} 