const { WebSocketServer } = require('ws');

console.log("Testing WebSocketServer import...");
try {
  const wss = new WebSocketServer({ port: 3002 });
  console.log("Success! WebSocketServer is working.");
  wss.close();
} catch (error) {
  console.error("Error creating WebSocketServer:", error);
} 