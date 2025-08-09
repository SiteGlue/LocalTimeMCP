#!/usr/bin/env node

import express from "express";
import cors from "cors";
import { randomUUID } from "node:crypto";
import moment from 'moment-timezone';
import { parsePhoneNumber } from 'libphonenumber-js';
import { z } from 'zod';
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";

// ============================================================================
// TIMEZONE UTILITIES
// ============================================================================

// US ZIP code to timezone mapping based on first digit
const US_ZIP_TIMEZONE_MAP = {
  '0': 'America/New_York',    // Massachusetts, Rhode Island, New Hampshire, Maine, Vermont
  '1': 'America/New_York',    // Delaware, New York, Pennsylvania
  '2': 'America/New_York',    // District of Columbia, Maryland, North Carolina, South Carolina, Virginia, West Virginia
  '3': 'America/New_York',    // Alabama, Florida, Georgia, Mississippi, Tennessee
  '4': 'America/New_York',    // Indiana, Kentucky, Michigan, Ohio
  '5': 'America/Chicago',     // Iowa, Minnesota, Montana, North Dakota, South Dakota, Wisconsin
  '6': 'America/Chicago',     // Illinois, Kansas, Missouri, Nebraska
  '7': 'America/Chicago',     // Arkansas, Louisiana, Oklahoma, Texas
  '8': 'America/Denver',      // Arizona, Colorado, Idaho, New Mexico, Nevada, Utah, Wyoming
  '9': 'America/Los_Angeles'  // Alaska, American Samoa, California, Guam, Hawaii, Marshall Islands, Oregon, Washington
};

// Canadian postal code to timezone mapping based on first letter
const CANADIAN_POSTAL_TIMEZONE_MAP = {
  'A': 'America/Halifax',     // Newfoundland and Labrador
  'B': 'America/Halifax',     // Nova Scotia, New Brunswick
  'C': 'America/Halifax',     // Prince Edward Island
  'E': 'America/Halifax',     // New Brunswick
  'G': 'America/Toronto',     // Quebec (Eastern part)
  'H': 'America/Toronto',     // Quebec (Montreal area)
  'J': 'America/Toronto',     // Quebec (Western part)
  'K': 'America/Toronto',     // Ontario (Eastern part)
  'L': 'America/Toronto',     // Ontario (Central part)
  'M': 'America/Toronto',     // Ontario (Toronto area)
  'N': 'America/Toronto',     // Ontario (Central part)
  'P': 'America/Toronto',     // Ontario (Northern part)
  'R': 'America/Winnipeg',    // Manitoba
  'S': 'America/Regina',      // Saskatchewan
  'T': 'America/Edmonton',    // Alberta
  'V': 'America/Vancouver',   // British Columbia
  'X': 'America/Edmonton',    // Northwest Territories, Nunavut
  'Y': 'America/Whitehorse'   // Yukon
};

function isValidUSZip(zipCode) {
  const zipRegex = /^\d{5}(-\d{4})?$/;
  return zipRegex.test(zipCode);
}

function isValidCanadianPostal(postalCode) {
  const postalRegex = /^[ABCEGHJ-NPRSTVXY]\d[ABCEGHJ-NPRSTV-Z][ ]?\d[ABCEGHJ-NPRSTV-Z]\d$/i;
  return postalRegex.test(postalCode);
}

function getTimezoneFromPostalCode(code) {
  if (!code || typeof code !== 'string') {
    throw new Error('Postal code is required and must be a string');
  }
  
  const cleanCode = code.trim().toUpperCase();
  
  // Check if US ZIP
  if (isValidUSZip(cleanCode)) {
    const firstDigit = cleanCode.charAt(0);
    const timezone = US_ZIP_TIMEZONE_MAP[firstDigit];
    if (!timezone) {
      throw new Error(`Unable to determine timezone for US ZIP code: ${cleanCode}`);
    }
    return { timezone, name: moment.tz(timezone).format('z') };
  }
  
  // Check if Canadian postal code
  if (isValidCanadianPostal(cleanCode)) {
    const firstLetter = cleanCode.charAt(0).toUpperCase();
    const timezone = CANADIAN_POSTAL_TIMEZONE_MAP[firstLetter];
    if (!timezone) {
      throw new Error(`Unable to determine timezone for Canadian postal code: ${cleanCode}`);
    }
    return { timezone, name: moment.tz(timezone).format('z') };
  }
  
  throw new Error(`Invalid postal code format: ${code}. Must be a valid US ZIP code or Canadian postal code.`);
}

function getCurrentTimeInTimezone(timezone, format = '12') {
  try {
    const now = moment.tz(timezone);
    const isDST = now.isDST();
    const utcOffset = now.format('Z');
    const timezoneName = now.format('z');
    
    const timeFormat = format === '12' ? 'h:mm A z' : 'HH:mm z';
    const time = now.format(timeFormat);
    
    return { time, isDST, utcOffset, timezoneName };
  } catch (error) {
    throw new Error(`Failed to get current time for timezone ${timezone}: ${error.message}`);
  }
}

// ============================================================================
// BUSINESS HOURS LOGIC
// ============================================================================

const BUSINESS_HOURS_CONFIG = {
  dental: {
    monday: { open: '08:00', close: '17:00' },
    tuesday: { open: '08:00', close: '17:00' },
    wednesday: { open: '08:00', close: '17:00' },
    thursday: { open: '08:00', close: '17:00' },
    friday: { open: '08:00', close: '17:00' },
    saturday: { closed: true, open: '09:00', close: '13:00' },
    sunday: { closed: true, open: '09:00', close: '13:00' }
  },
  medical: {
    monday: { open: '07:00', close: '19:00' },
    tuesday: { open: '07:00', close: '19:00' },
    wednesday: { open: '07:00', close: '19:00' },
    thursday: { open: '07:00', close: '19:00' },
    friday: { open: '07:00', close: '19:00' },
    saturday: { open: '08:00', close: '16:00' },
    sunday: { closed: true, open: '10:00', close: '14:00' }
  },
  general: {
    monday: { open: '09:00', close: '18:00' },
    tuesday: { open: '09:00', close: '18:00' },
    wednesday: { open: '09:00', close: '18:00' },
    thursday: { open: '09:00', close: '18:00' },
    friday: { open: '09:00', close: '18:00' },
    saturday: { open: '10:00', close: '15:00' },
    sunday: { closed: true, open: '12:00', close: '16:00' }
  }
};

function getDayOfWeek(momentObj) {
  const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  return dayNames[momentObj.day()];
}

function parseTimeOnDate(date, timeStr) {
  const [hours, minutes] = timeStr.split(':').map(Number);
  return date.clone().hour(hours).minute(minutes).second(0).millisecond(0);
}

function findNextOpenTime(currentTime, businessType) {
  const config = BUSINESS_HOURS_CONFIG[businessType];
  
  // Check today first
  const today = getDayOfWeek(currentTime);
  const todayHours = config[today];
  
  if (!todayHours.closed) {
    const todayOpen = parseTimeOnDate(currentTime, todayHours.open);
    if (currentTime.isBefore(todayOpen)) {
      return todayOpen;
    }
  }
  
  // Check next 7 days
  for (let i = 1; i <= 7; i++) {
    const checkDate = currentTime.clone().add(i, 'days');
    const dayName = getDayOfWeek(checkDate);
    const dayHours = config[dayName];
    
    if (!dayHours.closed) {
      return parseTimeOnDate(checkDate, dayHours.open);
    }
  }
  
  return null;
}

function checkBusinessHours(zipCode, businessType = 'dental') {
  try {
    const { timezone } = getTimezoneFromPostalCode(zipCode);
    const currentTime = moment.tz(timezone);
    const config = BUSINESS_HOURS_CONFIG[businessType];
    
    const today = getDayOfWeek(currentTime);
    const todayHours = config[today];
    
    let isOpen = false;
    let reasoning = '';
    let nextOpenTime;
    let nextCloseTime;
    
    if (todayHours.closed) {
      isOpen = false;
      reasoning = `We are closed on ${today}s.`;
      
      const nextOpen = findNextOpenTime(currentTime, businessType);
      if (nextOpen) {
        nextOpenTime = nextOpen.format('dddd [at] h:mm A z');
        reasoning += ` We will be open next on ${nextOpenTime}.`;
      }
    } else {
      const openTime = parseTimeOnDate(currentTime, todayHours.open);
      const closeTime = parseTimeOnDate(currentTime, todayHours.close);
      
      if (currentTime.isBefore(openTime)) {
        isOpen = false;
        nextOpenTime = openTime.format('h:mm A z');
        reasoning = `We are currently closed. We open today at ${nextOpenTime}.`;
      } else if (currentTime.isAfter(closeTime)) {
        isOpen = false;
        const nextOpen = findNextOpenTime(currentTime, businessType);
        if (nextOpen) {
          nextOpenTime = nextOpen.format('dddd [at] h:mm A z');
          reasoning = `We are currently closed. We closed today at ${closeTime.format('h:mm A z')}. We will be open next on ${nextOpenTime}.`;
        }
      } else {
        isOpen = true;
        nextCloseTime = closeTime.format('h:mm A z');
        reasoning = `We are currently open! We close today at ${nextCloseTime}.`;
      }
    }
    
    return {
      isOpen,
      nextOpenTime,
      nextCloseTime,
      reasoning,
      currentTime: currentTime.format('dddd, MMMM Do YYYY [at] h:mm A z'),
      businessType,
      todayHours: {
        open: todayHours.open,
        close: todayHours.close,
        closed: todayHours.closed
      }
    };
    
  } catch (error) {
    throw new Error(`Failed to check business hours: ${error.message}`);
  }
}

// ============================================================================
// MCP SERVER SETUP
// ============================================================================

// Input schemas
const GetBusinessTimeSchema = z.object({
  zipCode: z.string().describe("US zip code or Canadian postal code"),
  format: z.enum(["12", "24"]).optional().default("12").describe("Time format: 12-hour or 24-hour")
});

const CheckBusinessHoursSchema = z.object({
  zipCode: z.string().describe("US zip code or Canadian postal code"),
  businessType: z.enum(["dental", "medical", "general"]).optional().default("dental").describe("Type of business for hours calculation")
});

const GetTimezoneInfoSchema = z.object({
  zipCode: z.string().describe("US zip code or Canadian postal code")
});

function createMcpServer() {
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

  // Tool 1: Get current business time
  server.registerTool(
    "getBusinessTime",
    {
      title: "Get Current Business Time",
      description: "Get the current local time for a business location using ZIP code or postal code. Perfect for 'What time is it there?' questions.",
      inputSchema: GetBusinessTimeSchema
    },
    async ({ zipCode, format = "12" }) => {
      try {
        const { timezone } = getTimezoneFromPostalCode(zipCode);
        const timeInfo = getCurrentTimeInTimezone(timezone, format);
        const formatted = `It is currently ${timeInfo.time} in the ${zipCode} area.`;
        
        return {
          content: [{ type: "text", text: formatted }]
        };
      } catch (error) {
        return {
          content: [{ 
            type: "text", 
            text: `I'm sorry, I couldn't determine the time for that location. ${error.message}`
          }],
          isError: true
        };
      }
    }
  );

  // Tool 2: Check business hours
  server.registerTool(
    "checkBusinessHours",
    {
      title: "Check Business Hours Status", 
      description: "Determine if a business is currently open based on location and business type. Answers 'Are you open now?' questions with detailed reasoning.",
      inputSchema: CheckBusinessHoursSchema
    },
    async ({ zipCode, businessType = "dental" }) => {
      try {
        const hoursInfo = checkBusinessHours(zipCode, businessType);
        const response = hoursInfo.isOpen 
          ? `Yes, we are currently open! ${hoursInfo.reasoning}`
          : `No, we are currently closed. ${hoursInfo.reasoning}`;
        
        return {
          content: [{ type: "text", text: response }]
        };
      } catch (error) {
        return {
          content: [{ 
            type: "text",
            text: `I'm sorry, I couldn't check our hours for that location. ${error.message}`
          }],
          isError: true
        };
      }
    }
  );

  // Tool 3: Get timezone info
  server.registerTool(
    "getTimezoneInfo",
    {
      title: "Get Timezone Information",
      description: "Get comprehensive timezone details for a location including DST status, UTC offset, and timezone name. Useful for scheduling and time coordination.",
      inputSchema: GetTimezoneInfoSchema
    },
    async ({ zipCode }) => {
      try {
        const { timezone, name: timezoneName } = getTimezoneFromPostalCode(zipCode);
        const timeInfo = getCurrentTimeInTimezone(timezone, "12");
        
        const dstStatus = timeInfo.isDST ? "observing daylight saving time" : "on standard time";
        const formatted = `The ${zipCode} area is in the ${timezoneName} timezone, currently ${dstStatus}. The local time is ${timeInfo.time} (UTC${timeInfo.utcOffset}).`;
        
        return {
          content: [{ type: "text", text: formatted }]
        };
      } catch (error) {
        return {
          content: [{ 
            type: "text",
            text: `I'm sorry, I couldn't get timezone information for that location. ${error.message}`
          }],
          isError: true
        };
      }
    }
  );

  return server;
}

// ============================================================================
// EXPRESS SERVER WITH MCP ENDPOINTS
// ============================================================================

function createExpressServer(mcpServer, port = 3000) {
  const app = express();
  
  // Middleware
  app.use(express.json());
  app.use(cors({
    origin: '*',
    exposedHeaders: ['Mcp-Session-Id'],
    allowedHeaders: ['Content-Type', 'mcp-session-id', 'Accept'],
  }));

  // Store transports
  const transports = {
    streamable: {},
    sse: {}
  };

  // Health check
  app.get('/health', (req, res) => {
    res.json({ 
      status: 'healthy',
      server: 'MCP Voice Agent Timezone Server',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      activeConnections: {
        streamable: Object.keys(transports.streamable).length,
        sse: Object.keys(transports.sse).length
      }
    });
  });

  // Modern Streamable HTTP endpoint
  app.all('/mcp', async (req, res) => {
    try {
      const sessionId = req.headers['mcp-session-id'];
      let transport;

      if (sessionId && transports.streamable[sessionId]) {
        transport = transports.streamable[sessionId];
      } else if (!sessionId && req.method === 'POST' && isInitializeRequest(req.body)) {
        transport = new StreamableHTTPServerTransport({
          sessionIdGenerator: () => randomUUID(),
          onsessioninitialized: (sessionId) => {
            transports.streamable[sessionId] = transport;
            console.log(`New session: ${sessionId}`);
          },
          enableDnsRebindingProtection: process.env.NODE_ENV === 'production',
          allowedHosts: process.env.NODE_ENV === 'production' ? ['127.0.0.1', 'localhost'] : undefined,
        });

        transport.onclose = () => {
          if (transport.sessionId) {
            delete transports.streamable[transport.sessionId];
            console.log(`Session closed: ${transport.sessionId}`);
          }
        };

        await mcpServer.connect(transport);
      } else {
        return res.status(400).json({
          jsonrpc: '2.0',
          error: { code: -32000, message: 'Bad Request: No valid session ID provided' },
          id: null,
        });
      }

      await transport.handleRequest(req, res, req.body);
    } catch (error) {
      console.error('MCP request error:', error);
      if (!res.headersSent) {
        res.status(500).json({
          jsonrpc: '2.0',
          error: { code: -32603, message: 'Internal server error' },
          id: null,
        });
      }
    }
  });

  // Legacy SSE endpoint
  app.get('/sse', async (req, res) => {
    try {
      const transport = new SSEServerTransport('/messages', res);
      transports.sse[transport.sessionId] = transport;
      
      res.on("close", () => {
        delete transports.sse[transport.sessionId];
        console.log(`SSE session closed: ${transport.sessionId}`);
      });
      
      await mcpServer.connect(transport);
      console.log(`SSE session: ${transport.sessionId}`);
    } catch (error) {
      console.error('SSE error:', error);
      if (!res.headersSent) {
        res.status(500).send('Failed to establish SSE connection');
      }
    }
  });

  // Legacy message endpoint
  app.post('/messages', async (req, res) => {
    try {
      const sessionId = req.query.sessionId;
      const transport = transports.sse[sessionId];
      
      if (transport) {
        await transport.handlePostMessage(req, res, req.body);
      } else {
        res.status(400).send('No transport found for sessionId');
      }
    } catch (error) {
      console.error('Message error:', error);
      if (!res.headersSent) {
        res.status(500).send('Internal server error');
      }
    }
  });

  // API docs
  app.get('/api/docs', (req, res) => {
    res.json({
      server: "MCP Voice Agent Timezone Server",
      version: "1.0.0",
      description: "Model Context Protocol server for voice agents providing timezone and business hours functionality",
      endpoints: {
        "/mcp": "Modern Streamable HTTP MCP endpoint",
        "/sse": "Legacy SSE connection endpoint", 
        "/messages": "Legacy message endpoint for SSE clients",
        "/health": "Health check endpoint"
      },
      tools: [
        { name: "getBusinessTime", description: "Get current local time for a business location" },
        { name: "checkBusinessHours", description: "Check if business is currently open" },
        { name: "getTimezoneInfo", description: "Get detailed timezone information" }
      ],
      supportedRegions: ["US", "Canada"],
      businessTypes: ["dental", "medical", "general"]
    });
  });

  // 404 handler
  app.use((req, res) => {
    res.status(404).json({
      error: 'Not found',
      availableEndpoints: ['/mcp', '/sse', '/messages', '/health', '/api/docs']
    });
  });

  return app;
}

// ============================================================================
// MAIN APPLICATION
// ============================================================================

async function main() {
  try {
    console.log('🚀 Starting MCP Voice Agent Timezone Server...');
    
    const port = parseInt(process.env.PORT || '3000', 10);
    const mcpServer = createMcpServer();
    const app = createExpressServer(mcpServer, port);
    
    const server = app.listen(port, '0.0.0.0', () => {
      console.log(`✅ Server running on port ${port}`);
      console.log(`📍 Health: http://localhost:${port}/health`);
      console.log(`📚 Docs: http://localhost:${port}/api/docs`);
      console.log(`🔗 MCP: http://localhost:${port}/mcp`);
      console.log(`📡 SSE: http://localhost:${port}/sse`);
      console.log('🎯 Ready for voice agent connections!');
    });

    // Graceful shutdown
    const shutdown = (signal) => {
      console.log(`\n💫 Received ${signal}, shutting down...`);
      server.close((err) => {
        if (err) {
          console.error('❌ Shutdown error:', err);
          process.exit(1);
        }
        console.log('✅ Server shut down successfully');
        process.exit(0);
      });
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
    
    process.on('uncaughtException', (error) => {
      console.error('💥 Uncaught Exception:', error);
      shutdown('uncaughtException');
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