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
      }
      
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(status));
    } catch (error) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Failed to get agent status' }));
    }
    return;
  }
  
  // List pending connections
  if (req.url === '/api/connections/pending') {
    try {
      let pendingConnections = [];
      
      // Try to read the pending connections file
      try {
        const pendingData = fs.readFileSync(PENDING_CONNECTIONS_FILE, 'utf8');
        pendingConnections = JSON.parse(pendingData);
      } catch (err) {
        // File doesn't exist yet or is invalid, assume no pending connections
      }
      
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ 
        pendingConnections,
        count: pendingConnections.length
      }));
    } catch (error) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Failed to list pending connections' }));
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
      }
      
      // Add new command to list
      commands.push(approvalCommand);
      
      // Write back to file
      fs.writeFileSync(APPROVAL_COMMAND_FILE, JSON.stringify(commands, null, 2));
      
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ 
        status: 'approval_requested', 
        message: 'Connection approval requested',
        connectionId
      }));
    } catch (error) {
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
      }
      
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ 
        connections,
        count: connections.length
      }));
    } catch (error) {
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
  
  try {
    // This step is only necessary if build hasn't been done already
    // On Render, the build command should have already run
    if (process.env.NODE_ENV !== 'production') {
      console.log('Building scripts...');
      execSync('npm run build-scripts', { stdio: 'inherit' });
    }
    
    console.log('Starting agent process...');
    
    // Start the actual agent in a child process
    const agentProcess = spawn('node', ['dist/app/scripts/run-agent.js'], {
      stdio: 'inherit', // This will pipe the agent's stdout/stderr to the parent process
      env: {
        ...process.env,
        ENABLE_CONNECTION_APPROVAL_API: 'true' // Signal to the agent to check for approval commands
      }
    });
    
    // Handle agent process exit
    agentProcess.on('exit', (code) => {
      console.log(`Agent process exited with code ${code}`);
      if (code !== 0) {
        console.error('Agent process failed unexpectedly');
      }
    });
    
    // Handle errors
    agentProcess.on('error', (err) => {
      console.error('Failed to start agent process:', err);
    });
    
    // Handle parent process termination
    process.on('SIGINT', () => {
      console.log('Received SIGINT, shutting down...');
      agentProcess.kill('SIGINT');
      server.close(() => {
        console.log('HTTP server closed');
        process.exit(0);
      });
    });
    
    process.on('SIGTERM', () => {
      console.log('Received SIGTERM, shutting down...');
      agentProcess.kill('SIGTERM');
      server.close(() => {
        console.log('HTTP server closed');
        process.exit(0);
      });
    });
  } catch (error) {
    console.error('Error in wrapper:', error);
  }
}); 