import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerTools } from './tools.js';

/**
 * Creates and configures the MCP server instance
 */
export function createMcpServer(): McpServer {
  const server = new McpServer({
    name: "voice-agent-timezone-server",
    version: "1.0.0"
  }, {
    capabilities: {
      tools: {
        listChanged: true
      }
    }
  });

  // Register all tools
  registerTools(server);

  // Log server startup
  console.log('MCP Voice Agent Timezone Server initialized');
  console.log('Available tools:');
  console.log('- getBusinessTime: Get current local time for a location');
  console.log('- checkBusinessHours: Check if business is currently open');  
  console.log('- getTimezoneInfo: Get detailed timezone information');

  return server;
}