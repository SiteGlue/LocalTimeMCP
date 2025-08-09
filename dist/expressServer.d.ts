import express from "express";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
/**
 * Creates Express server with MCP support for both Streamable HTTP and SSE transports
 */
export declare function createExpressServer(mcpServer: McpServer, port?: number): express.Application;
//# sourceMappingURL=expressServer.d.ts.map