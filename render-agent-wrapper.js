const http = require('http');
const { spawn, execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Get port from environment or use default
const PORT = process.env.PORT || 3000;

// Paths for IPC with agent process
const PENDING_CONNECTIONS_FILE = path.join(process.cwd(), '.pending_connections.json');
const APPROVAL_COMMAND_FILE = path.join(process.cwd(), '.approval_commands.json');
const AGENT_STATUS_FILE = path.join(process.cwd(), '.agent_status.json');

// Create a simple HTTP server
const server = http.createServer(async (req, res) => {
  // Enable CORS for all requests
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  // Handle OPTIONS requests (preflight)
  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  // Basic health check endpoint
  if (req.url === '/health' || req.url === '/') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ 
      status: 'ok',
      agent: 'running',
      uptime: Math.floor(process.uptime())
    }));
    return;
  }
  
  // Get agent status with connection info
  if (req.url === '/api/status') {
    try {
      let status = { 
        status: 'ok',
        uptime: Math.floor(process.uptime())
      };
      
      // Try to read the agent status file
      try {
        const agentStatusData = fs.readFileSync(AGENT_STATUS_FILE, 'utf8');
        const agentStatus = JSON.parse(agentStatusData);
        status = { ...status, ...agentStatus };
      } catch (err) {
        // Status file doesn't exist yet, that's ok
        console.log('Status file not found, returning basic status');
      }
      
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(status));
    } catch (error) {
      console.error('Failed to get agent status:', error);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Failed to get agent status' }));
    }
    return;
  }
  
  // List pending connections
  if (req.url === '/api/connections/pending') {
    try {
      console.log('Handling request to /api/connections/pending');
      console.log(`Pending connections file path: ${PENDING_CONNECTIONS_FILE}`);
      
      // Check if the file exists and is accessible
      const fileExists = fs.existsSync(PENDING_CONNECTIONS_FILE);
      console.log(`Pending connections file exists: ${fileExists}`);
      
      let pendingConnections = [];
      
      // Try to read the pending connections file
      try {
        if (fileExists) {
          const stats = fs.statSync(PENDING_CONNECTIONS_FILE);
          console.log(`File size: ${stats.size} bytes, last modified: ${stats.mtime}`);
          
          const pendingData = fs.readFileSync(PENDING_CONNECTIONS_FILE, 'utf8');
          console.log(`Raw file content (first 100 chars): ${pendingData.substring(0, 100)}`);
          
          pendingConnections = JSON.parse(pendingData);
          console.log(`Successfully parsed JSON, found ${pendingConnections.length} pending connections`);
        } else {
          console.log('Pending connections file does not exist');
        }
      } catch (err) {
        console.error(`Failed to read or parse pending connections file: ${err.message}`);
        // File doesn't exist yet or is invalid, assume no pending connections
      }
      
      // Add debug information to the response
      const response = { 
        pendingConnections,
        count: pendingConnections.length,
        debug: {
          fileExists,
          filePath: PENDING_CONNECTIONS_FILE,
          timestamp: new Date().toISOString(),
          cwd: process.cwd()
        }
      };
      
      console.log(`Sending response with ${pendingConnections.length} pending connections`);
      
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(response));
    } catch (error) {
      console.error(`Exception in pending connections handler: ${error.message}`);
      console.error(error.stack);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ 
        error: 'Failed to list pending connections',
        message: error.message,
        stack: error.stack
      }));
    }
    return;
  }
  
  // Approve a connection
  if (req.url.startsWith('/api/connections/approve/') && req.method === 'POST') {
    try {
      // Extract the connection ID from the URL
      const connectionId = req.url.split('/').pop();
      
      if (!connectionId) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Missing connection ID' }));
        return;
      }
      
      console.log(`Processing approval request for connection: ${connectionId}`);
      
      // Write approval command to file for agent to process
      const approvalCommand = {
        type: 'approve_connection',
        connectionId,
        timestamp: Date.now()
      };
      
      // Read existing commands (if any)
      let commands = [];
      try {
        const existingData = fs.readFileSync(APPROVAL_COMMAND_FILE, 'utf8');
        commands = JSON.parse(existingData);
      } catch (err) {
        // File doesn't exist yet, start with empty array
        console.log('No existing commands file, creating new one');
      }
      
      // Add new command to list
      commands.push(approvalCommand);
      
      // Write back to file
      fs.writeFileSync(APPROVAL_COMMAND_FILE, JSON.stringify(commands, null, 2));
      console.log(`Wrote approval command to ${APPROVAL_COMMAND_FILE}`);
      
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ 
        status: 'approval_requested', 
        message: 'Connection approval requested',
        connectionId
      }));
    } catch (error) {
      console.error(`Failed to approve connection: ${error.message}`);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Failed to approve connection' }));
    }
    return;
  }
  
  // List all connections
  if (req.url === '/api/connections') {
    try {
      let connections = [];
      
      // Try to read the connections file
      try {
        const data = fs.readFileSync(path.join(process.cwd(), '.connections.json'), 'utf8');
        connections = JSON.parse(data);
      } catch (err) {
        // File doesn't exist yet or is invalid, assume no connections
        console.log('No connections file found or invalid JSON');
      }
      
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ 
        connections,
        count: connections.length
      }));
    } catch (error) {
      console.error(`Failed to list connections: ${error.message}`);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Failed to list connections' }));
    }
    return;
  }
  
  // Default handler for unknown routes
  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Not found' }));
});

// Start the server
server.listen(PORT, () => {
  console.log(`HTTP server listening on port ${PORT}`);
  console.log(`Available endpoints:`);
  console.log(`- GET  /health - Health check`);
  console.log(`- GET  /api/status - Agent status`);
  console.log(`- GET  /api/connections - List all connections`);
  console.log(`- GET  /api/connections/pending - List pending connections`);
  console.log(`- POST /api/connections/approve/:id - Approve a connection`);
  console.log(`Server working directory: ${process.cwd()}`);
  
  try {
    // This step is only necessary if build hasn't been done already
    // On Render, the build command should have already run
    if (process.env.NODE_ENV !== 'production') {
      console.log('Building scripts...');
      execSync('npm run build-scripts', { stdio: 'inherit' });
    }
    
    console.log('Starting main agent process...');
    
    // Start the main agent in a child process
    const mainAgentProcess = spawn('node', ['dist/app/scripts/run-agent.js'], {
      stdio: 'inherit', // This will pipe the agent's stdout/stderr to the parent process
      env: {
        ...process.env
      }
    });
    
    // Handle main agent process exit
    mainAgentProcess.on('exit', (code) => {
      console.log(`Main agent process exited with code ${code}`);
      if (code !== 0) {
        console.error('Main agent process failed unexpectedly');
      }
    });
    
    // Handle errors
    mainAgentProcess.on('error', (err) => {
      console.error('Failed to start main agent process:', err);
    });
    
    // Now start our HCS10 agent handler as well
    console.log('Starting HCS10 agent handler...');
    
    // Start the HCS10 agent handler in a child process
    const hcs10AgentProcess = spawn('node', ['scripts/hcs10/agent-handler.mjs'], {
      stdio: 'inherit', // This will pipe the agent's stdout/stderr to the parent process
      env: {
        ...process.env,
        ENABLE_CONNECTION_APPROVAL_API: 'true' // Signal to the agent to check for approval commands
      }
    });
    
    // Handle HCS10 agent process exit
    hcs10AgentProcess.on('exit', (code) => {
      console.log(`HCS10 agent process exited with code ${code}`);
      if (code !== 0) {
        console.error('HCS10 agent process failed unexpectedly');
      }
    });
    
    // Handle errors
    hcs10AgentProcess.on('error', (err) => {
      console.error('Failed to start HCS10 agent process:', err);
    });
    
    // Handle parent process termination
    process.on('SIGINT', () => {
      console.log('Received SIGINT, shutting down...');
      mainAgentProcess.kill('SIGINT');
      hcs10AgentProcess.kill('SIGINT');
      server.close(() => {
        console.log('HTTP server closed');
        process.exit(0);
      });
    });
    
    process.on('SIGTERM', () => {
      console.log('Received SIGTERM, shutting down...');
      mainAgentProcess.kill('SIGTERM');
      hcs10AgentProcess.kill('SIGTERM');
      server.close(() => {
        console.log('HTTP server closed');
        process.exit(0);
      });
    });
  } catch (error) {
    console.error('Error in wrapper:', error);
  }
}); 