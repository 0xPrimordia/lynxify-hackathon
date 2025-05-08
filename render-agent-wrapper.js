const http = require('http');
const { spawn, execSync } = require('child_process');

// Get port from environment or use default
const PORT = process.env.PORT || 3000;

// Create a simple HTTP server
const server = http.createServer((req, res) => {
  if (req.url === '/health' || req.url === '/') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ 
      status: 'ok',
      agent: 'running',
      uptime: Math.floor(process.uptime())
    }));
  } else {
    res.writeHead(404);
    res.end('Not found');
  }
});

// Start the server
server.listen(PORT, () => {
  console.log(`HTTP server listening on port ${PORT}`);
  
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
      stdio: 'inherit' // This will pipe the agent's stdout/stderr to the parent process
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