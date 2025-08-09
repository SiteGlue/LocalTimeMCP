import express from "express";
import cors from "cors";
import { randomUUID } from "node:crypto";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";

interface AppTransports {
  streamable: Record<string, StreamableHTTPServerTransport>;
  sse: Record<string, SSEServerTransport>;
}

/**
 * Creates Express server with MCP support for both Streamable HTTP and SSE transports
 */
export function createExpressServer(mcpServer: McpServer, port: number = 3000): express.Application {
  const app = express();
  
  // Middleware
  app.use(express.json());
  app.use(cors({
    origin: '*', // Configure appropriately for production
    exposedHeaders: ['Mcp-Session-Id'],
    allowedHeaders: ['Content-Type', 'mcp-session-id', 'Accept'],
  }));

  // Store transports for each session type
  const transports: AppTransports = {
    streamable: {},
    sse: {}
  };

  // Health check endpoint
  app.get('/health', (req, res) => {
    res.json({ 
      status: 'healthy',
      server: 'MCP Voice Agent Timezone Server',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      transports: {
        activeStreamable: Object.keys(transports.streamable).length,
        activeSSE: Object.keys(transports.sse).length
      }
    });
  });

  // Modern Streamable HTTP endpoint for MCP
  app.all('/mcp', async (req, res) => {
    try {
      // Check for existing session ID
      const sessionId = req.headers['mcp-session-id'] as string | undefined;
      let transport: StreamableHTTPServerTransport;

      if (sessionId && transports.streamable[sessionId]) {
        // Reuse existing transport
        transport = transports.streamable[sessionId];
      } else if (!sessionId && req.method === 'POST' && isInitializeRequest(req.body)) {
        // New initialization request
        transport = new StreamableHTTPServerTransport({
          sessionIdGenerator: () => randomUUID(),
          onsessioninitialized: (sessionId) => {
            // Store the transport by session ID
            transports.streamable[sessionId] = transport;
            console.log(`New Streamable HTTP session initialized: ${sessionId}`);
          },
          // Enable DNS rebinding protection for production
          enableDnsRebindingProtection: process.env.NODE_ENV === 'production',
          allowedHosts: process.env.NODE_ENV === 'production' ? ['127.0.0.1', 'localhost'] : undefined,
        });

        // Clean up transport when closed
        transport.onclose = () => {
          if (transport.sessionId) {
            delete transports.streamable[transport.sessionId];
            console.log(`Streamable HTTP session closed: ${transport.sessionId}`);
          }
        };

        // Connect to the MCP server
        await mcpServer.connect(transport);
      } else {
        // Invalid request
        return res.status(400).json({
          jsonrpc: '2.0',
          error: {
            code: -32000,
            message: 'Bad Request: No valid session ID provided or invalid initialization',
          },
          id: null,
        });
      }

      // Handle the request
      await transport.handleRequest(req, res, req.body);
      
    } catch (error) {
      console.error('Error handling Streamable HTTP MCP request:', error);
      if (!res.headersSent) {
        res.status(500).json({
          jsonrpc: '2.0',
          error: {
            code: -32603,
            message: 'Internal server error',
          },
          id: null,
        });
      }
    }
  });

  // Legacy SSE endpoint for backwards compatibility
  app.get('/sse', async (req, res) => {
    try {
      console.log('SSE connection requested');
      
      // Create SSE transport for legacy clients
      const transport = new SSEServerTransport('/messages', res);
      transports.sse[transport.sessionId] = transport;
      
      res.on("close", () => {
        delete transports.sse[transport.sessionId];
        console.log(`SSE session closed: ${transport.sessionId}`);
      });
      
      // Connect MCP server to SSE transport
      await mcpServer.connect(transport);
      console.log(`SSE session initialized: ${transport.sessionId}`);
      
    } catch (error) {
      console.error('Error setting up SSE transport:', error);
      if (!res.headersSent) {
        res.status(500).send('Failed to establish SSE connection');
      }
    }
  });

  // Legacy message endpoint for SSE clients
  app.post('/messages', async (req, res) => {
    try {
      const sessionId = req.query.sessionId as string;
      const transport = transports.sse[sessionId];
      
      if (transport) {
        await transport.handlePostMessage(req, res, req.body);
      } else {
        res.status(400).send('No transport found for sessionId');
      }
    } catch (error) {
      console.error('Error handling SSE message:', error);
      if (!res.headersSent) {
        res.status(500).send('Internal server error');
      }
    }
  });

  // API documentation endpoint
  app.get('/api/docs', (req, res) => {
    res.json({
      server: "MCP Voice Agent Timezone Server",
      version: "1.0.0",
      description: "Model Context Protocol server for voice agents providing timezone and business hours functionality",
      endpoints: {
        "/mcp": {
          methods: ["POST", "GET", "DELETE"],
          description: "Modern Streamable HTTP MCP endpoint",
          transport: "Streamable HTTP"
        },
        "/sse": {
          methods: ["GET"],
          description: "Legacy SSE connection endpoint",
          transport: "Server-Sent Events"
        },
        "/messages": {
          methods: ["POST"],
          description: "Legacy message endpoint for SSE clients",
          transport: "Server-Sent Events"
        },
        "/health": {
          methods: ["GET"],
          description: "Health check endpoint"
        }
      },
      tools: [
        {
          name: "getBusinessTime",
          description: "Get current local time for a business location",
          parameters: ["zipCode", "format?"]
        },
        {
          name: "checkBusinessHours", 
          description: "Check if business is currently open",
          parameters: ["zipCode", "businessType?"]
        },
        {
          name: "getTimezoneInfo",
          description: "Get detailed timezone information",
          parameters: ["zipCode"]
        }
      ],
      supportedRegions: ["US", "Canada"],
      businessTypes: ["dental", "medical", "general"]
    });
  });

  // Error handling middleware
  app.use((error: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error('Express server error:', error);
    if (!res.headersSent) {
      res.status(500).json({
        error: 'Internal server error',
        message: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong'
      });
    }
  });

  // 404 handler
  app.use((req, res) => {
    res.status(404).json({
      error: 'Not found',
      message: `Path ${req.path} not found`,
      availableEndpoints: ['/mcp', '/sse', '/messages', '/health', '/api/docs']
    });
  });

  return app;
}