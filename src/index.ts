#!/usr/bin/env node

import { createMcpServer } from './mcpServer.js';
import { createExpressServer } from './expressServer.js';

/**
 * Main entry point for the MCP Voice Agent Timezone Server
 */
async function main() {
  try {
    console.log('🚀 Starting MCP Voice Agent Timezone Server...');
    
    // Get port from environment or default to 3000
    const port = parseInt(process.env.PORT || '3000', 10);
    
    // Create MCP server instance
    const mcpServer = createMcpServer();
    
    // Create Express server with MCP endpoints
    const app = createExpressServer(mcpServer, port);
    
    // Start the server
    const server = app.listen(port, '0.0.0.0', () => {
      console.log(`✅ MCP Voice Agent Timezone Server running on port ${port}`);
      console.log(`📍 Health check: http://localhost:${port}/health`);
      console.log(`📚 API docs: http://localhost:${port}/api/docs`);
      console.log(`🔗 MCP endpoint: http://localhost:${port}/mcp`);
      console.log(`📡 SSE endpoint: http://localhost:${port}/sse`);
      console.log('');
      console.log('🎯 Ready for voice agent connections!');
      console.log('Supported regions: US and Canada');
      console.log('Business types: dental (default), medical, general');
    });

    // Graceful shutdown handling
    const gracefulShutdown = (signal: string) => {
      console.log(`\n💫 Received ${signal}, shutting down gracefully...`);
      
      server.close((err) => {
        if (err) {
          console.error('❌ Error during shutdown:', err);
          process.exit(1);
        }
        
        console.log('✅ Server shut down successfully');
        process.exit(0);
      });
      
      // Force exit after 10 seconds
      setTimeout(() => {
        console.error('⚠️  Forcing shutdown after 10 seconds');
        process.exit(1);
      }, 10000);
    };

    // Handle shutdown signals
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));
    
    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
      console.error('💥 Uncaught Exception:', error);
      gracefulShutdown('uncaughtException');
    });
    
    // Handle unhandled promise rejections
    process.on('unhandledRejection', (reason, promise) => {
      console.error('💥 Unhandled Rejection at:', promise, 'reason:', reason);
      gracefulShutdown('unhandledRejection');
    });

  } catch (error) {
    console.error('💥 Failed to start server:', error);
    process.exit(1);
  }
}

// Start the server
main().catch((error) => {
  console.error('💥 Fatal error:', error);
  process.exit(1);
});