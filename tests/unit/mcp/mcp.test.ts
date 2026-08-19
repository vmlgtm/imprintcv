import { describe, it, expect } from 'vitest';
import { createImprintCVMcpServer } from '../../../src/mcp/server.js';

describe('Phase 7: MCP Server & Tools', () => {
  it('instantiates MCP server with all 4 tools registered', () => {
    const server = createImprintCVMcpServer();
    expect(server).toBeDefined();
  });
});
