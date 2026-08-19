#!/usr/bin/env node
import { runMcpServer } from './server.js';
export { createImprintCVMcpServer, runMcpServer } from './server.js';

runMcpServer().catch((err) => {
  process.stderr.write(`MCP server fatal error: ${(err as Error).message}\n`);
  process.exit(1);
});
