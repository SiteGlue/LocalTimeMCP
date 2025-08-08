#!/usr/bin/env node

/**
 * Vapi-Compatible Local Time MCP Server
 * Supports both Streamable HTTP and SSE transport protocols
 * Specifically designed for Vapi integration requirements
 */

import express from 'express';
import cors from 'cors';
import LocalTimeMCPServer from './index.js';

const app = express();
const port = process.env.PORT || 3000;
const mcpServer = new LocalTimeMCPServer();

// Middleware
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Cache-Control']
}));
app.use(express.json());

// Global error handler
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    service: 'Vapi-Compatible Local Time MCP Server',
    timestamp: new Date().toISOString(),
    protocols: ['SSE', 'HTTP', 'Streamable HTTP'],
    transports: ['/mcp (SSE)', '/messages (HTTP)', '/mcp (Streamable HTTP)']
  });
});

// Root endpoint with server info
app.get('/', (req, res) => {
  res.json({
    service: 'Vapi-Compatible Local Time MCP Server',
    version: '1.0.0',
    description: 'Provides accurate local time information for dental practice voice agents',
    protocols: {
      'SSE': 'GET /mcp - Server-Sent Events transport',
      'HTTP': 'POST /messages - Request/response transport', 
      'Streamable HTTP': 'POST /mcp - Modern streamable transport'
    },
    tools: [
      'getBusinessTime - Get current local time for practice location',
      'checkBusinessHours - Check if practice is currently open',
      'getTimezoneInfo - Get detailed timezone information'
    ],
    usage: 'For Vapi integration, use MCP tool type with this server URL'
  });
});

// SSE Transport - GET /mcp (Required by Vapi)
app.get('/mcp', (req, res) => {
  console.log('🔄 SSE connection initiated');
  
  // Set SSE headers
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Cache-Control, Authorization'
  });

  // Send initial connection event
  res.write('event: connect\n');
  res.write(`data: ${JSON.stringify({ 
    type: 'connection_established',
    timestamp: new Date().toISOString(),
    server: 'Local Time MCP Server'
  })}\n\n`);

  // Send server info
  const serverInfo = {
    jsonrpc: '2.0',
    id: 0,
    result: {
      protocolVersion: '2024-11-05',
      capabilities: {
        tools: { listChanged: true },
        resources: {},
        prompts: {}
      },
      serverInfo: {
        name: 'Local Time MCP Server',
        version: '1.0.0'
      }
    }
  };

  res.write('event: message\n');
  res.write(`data: ${JSON.stringify(serverInfo)}\n\n`);

  // Keep connection alive
  const keepAlive = setInterval(() => {
    res.write('event: ping\n');
    res.write(`data: ${JSON.stringify({ timestamp: new Date().toISOString() })}\n\n`);
  }, 30000);

  // Handle client disconnect
  req.on('close', () => {
    console.log('🔌 SSE connection closed');
    clearInterval(keepAlive);
  });

  req.on('error', (error) => {
    console.error('🚨 SSE connection error:', error);
    clearInterval(keepAlive);
  });
});

// HTTP Transport - POST /messages (Required by Vapi)
app.post('/messages', async (req, res) => {
  try {
    console.log('📨 HTTP message received:', JSON.stringify(req.body, null, 2));
    
    const { jsonrpc, method, params, id } = req.body;

    if (jsonrpc !== '2.0') {
      return res.status(400).json({
        jsonrpc: '2.0',
        id: id || null,
        error: { code: -32600, message: 'Invalid JSON-RPC version' }
      });
    }

    let result;

    switch (method) {
      case 'initialize':
        result = {
          protocolVersion: '2024-11-05',
          capabilities: {
            tools: { listChanged: true },
            resources: {},
            prompts: {}
          },
          serverInfo: {
            name: 'Local Time MCP Server for Vapi',
            version: '1.0.0'
          }
        };
        break;

      case 'tools/list':
        result = {
          tools: [
            {
              name: 'getBusinessTime',
              description: 'Get current local time for business location using zip/postal code. Perfect for dental practice scheduling and business hours inquiries.',
              inputSchema: {
                type: 'object',
                properties: {
                  zipCode: {
                    type: 'string',
                    description: 'US zip code (5 digits) or Canadian postal code (A1A 1A1 format)',
                    default: '33067'
                  },
                  format: {
                    type: 'string',
                    enum: ['12-hour', '24-hour'],
                    default: '12-hour',
                    description: 'Time format preference for voice agents'
                  }
                },
                required: ['zipCode']
              }
            },
            {
              name: 'checkBusinessHours',
              description: 'Determine if a business is currently open based on local time and business type. Ideal for call routing and availability responses.',
              inputSchema: {
                type: 'object',
                properties: {
                  zipCode: {
                    type: 'string',
                    description: 'US zip code or Canadian postal code for the business location',
                    default: '33067'
                  },
                  businessType: {
                    type: 'string',
                    enum: ['dental', 'medical', 'general'],
                    default: 'dental',
                    description: 'Type of business for accurate hours calculation'
                  }
                },
                required: ['zipCode']
              }
            },
            {
              name: 'getTimezoneInfo',
              description: 'Get comprehensive timezone information including DST status and UTC offset.',
              inputSchema: {
                type: 'object',
                properties: {
                  zipCode: {
                    type: 'string',
                    description: 'US zip code or Canadian postal code'
                  }
                },
                required: ['zipCode']
              }
            }
          ]
        };
        break;

      case 'tools/call':
        const toolName = params?.name;
        const toolArgs = params?.arguments;

        if (!toolName) {
          throw new Error('Tool name is required');
        }

        let toolResult;
        switch (toolName) {
          case 'getBusinessTime':
            const timeResponse = await mcpServer.getBusinessTime(
              toolArgs?.zipCode || '33067', 
              toolArgs?.format || '12-hour'
            );
            toolResult = JSON.parse(timeResponse.content[0].text);
            break;

          case 'checkBusinessHours':
            const hoursResponse = await mcpServer.checkBusinessHours(
              toolArgs?.zipCode || '33067',
              toolArgs?.businessType || 'dental'
            );
            toolResult = JSON.parse(hoursResponse.content[0].text);
            break;

          case 'getTimezoneInfo':
            const timezoneResponse = await mcpServer.getTimezoneInfo(
              toolArgs?.zipCode || '33067'
            );
            toolResult = JSON.parse(timezoneResponse.content[0].text);
            break;

          default:
            throw new Error(`Unknown tool: ${toolName}`);
        }

        result = {
          content: [
            {
              type: 'text',
              text: JSON.stringify(toolResult, null, 2)
            }
          ]
        };
        break;

      default:
        return res.status(400).json({
          jsonrpc: '2.0',
          id: id || null,
          error: { code: -32601, message: `Method not found: ${method}` }
        });
    }

    res.json({
      jsonrpc: '2.0',
      id: id || 0,
      result
    });

  } catch (error) {
    console.error('🚨 Error processing MCP message:', error);
    res.status(500).json({
      jsonrpc: '2.0',
      id: req.body?.id || null,
      error: {
        code: -32603,
        message: 'Internal error',
        data: error.message
      }
    });
  }
});

// Streamable HTTP Transport - POST /mcp (Newer protocol)
app.post('/mcp', async (req, res) => {
  try {
    console.log('🌊 Streamable HTTP request received');
    
    // Set proper headers for Streamable HTTP
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    
    // Handle streamable HTTP protocol
    const response = await handleStreamableHTTP(req.body);
    
    // Send the response as a stream
    res.write(JSON.stringify(response) + '\n');
    res.end();
    
  } catch (error) {
    console.error('🚨 Streamable HTTP error:', error);
    res.status(500).json({
      jsonrpc: '2.0',
      id: req.body?.id || null,
      error: {
        code: -32603,
        message: 'Streamable HTTP processing failed',
        data: error.message
      }
    });
  }
});

// Handle Streamable HTTP protocol
async function handleStreamableHTTP(body) {
  console.log('Processing streamable HTTP request:', body);
  
  const { jsonrpc, method, params, id } = body;
  
  if (jsonrpc !== '2.0') {
    return {
      jsonrpc: '2.0',
      id: id || null,
      error: { code: -32600, message: 'Invalid JSON-RPC version' }
    };
  }
  
  switch (method) {
    case 'initialize':
      return {
        jsonrpc: '2.0',
        id: id,
        result: {
          protocolVersion: '2024-11-05',
          capabilities: {
            tools: { listChanged: true },
            resources: {},
            prompts: {}
          },
          serverInfo: {
            name: 'Local Time MCP Server',
            version: '1.0.0'
          }
        }
      };
      
    case 'tools/list':
      return {
        jsonrpc: '2.0',
        id: id,
        result: {
          tools: [
            {
              name: 'getBusinessTime',
              description: 'Get current local time for business location using zip/postal code',
              inputSchema: {
                type: 'object',
                properties: {
                  zipCode: {
                    type: 'string',
                    description: 'US zip code or Canadian postal code'
                  },
                  format: {
                    type: 'string',
                    enum: ['12-hour', '24-hour'],
                    default: '12-hour'
                  }
                },
                required: ['zipCode']
              }
            },
            {
              name: 'checkBusinessHours',
              description: 'Check if business is currently open based on location and type',
              inputSchema: {
                type: 'object',
                properties: {
                  zipCode: {
                    type: 'string',
                    description: 'US zip code or Canadian postal code'
                  },
                  businessType: {
                    type: 'string',
                    enum: ['dental', 'medical', 'general'],
                    default: 'dental'
                  }
                },
                required: ['zipCode']
              }
            },
            {
              name: 'getTimezoneInfo',
              description: 'Get detailed timezone information for a location',
              inputSchema: {
                type: 'object',
                properties: {
                  zipCode: {
                    type: 'string',
                    description: 'US zip code or Canadian postal code'
                  }
                },
                required: ['zipCode']
              }
            }
          ]
        }
      };
      
    default:
      return {
        jsonrpc: '2.0',
        id: id,
        error: { code: -32601, message: 'Method not found' }
      };
  }
}

// Legacy HTTP endpoints for backward compatibility
app.post('/getBusinessTime', async (req, res) => {
  try {
    const { zipCode = '33067', format = '12-hour' } = req.body;
    const result = await mcpServer.getBusinessTime(zipCode, format);
    const data = JSON.parse(result.content[0].text);
    res.json(data);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/checkBusinessHours', async (req, res) => {
  try {
    const { zipCode = '33067', businessType = 'dental' } = req.body;
    const result = await mcpServer.checkBusinessHours(zipCode, businessType);
    const data = JSON.parse(result.content[0].text);
    res.json(data);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/getTimezoneInfo', async (req, res) => {
  try {
    const { zipCode = '33067' } = req.body;
    const result = await mcpServer.getTimezoneInfo(zipCode);
    const data = JSON.parse(result.content[0].text);
    res.json(data);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('🚨 Server error:', error);
  res.status(500).json({
    success: false,
    error: 'Internal server error',
    details: process.env.NODE_ENV === 'development' ? error.message : 'Contact support'
  });
});

// Handle 404s
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Endpoint not found',
    availableEndpoints: [
      'GET / - Server information',
      'GET /health - Health check',
      'GET /mcp - SSE transport (for MCP clients)',
      'POST /messages - HTTP transport (for MCP clients)',
      'POST /mcp - Streamable HTTP transport (newer)',
      'POST /getBusinessTime - Legacy HTTP endpoint',
      'POST /checkBusinessHours - Legacy HTTP endpoint',
      'POST /getTimezoneInfo - Legacy HTTP endpoint'
    ]
  });
});

// Start server
app.listen(port, '0.0.0.0', () => {
  console.log(`🚀 Vapi-Compatible MCP Server running on port ${port}`);
  console.log(`🌐 Health check: http://localhost:${port}/health`);
  console.log(`📋 Server info: http://localhost:${port}/`);
  console.log(`🔌 SSE endpoint: http://localhost:${port}/mcp`);
  console.log(`📨 HTTP endpoint: http://localhost:${port}/messages`);
  console.log(`🌊 Streamable HTTP: http://localhost:${port}/mcp`);
  console.log(`⚡ Ready for Vapi integration!`);
});

export default app;