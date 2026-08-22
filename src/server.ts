import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  type CallToolResult,
} from '@modelcontextprotocol/sdk/types.js';

import { errorMessage, maskToken } from './errors.js';
import { createToolRegistry, type ToolServices } from './tools/index.js';

export function createServer(services: ToolServices): Server {
  const registry = createToolRegistry(services);
  const server = new Server(
    {
      name: 'overleaf-mcp-server',
      version: '1.0.0',
    },
    {
      capabilities: {
        tools: {},
      },
    },
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: [...registry.definitions],
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request): Promise<CallToolResult> => {
    try {
      const handler = registry.handlers[request.params.name];
      if (!handler) {
        throw new Error(`Unknown tool: ${request.params.name}`);
      }
      return await handler((request.params.arguments ?? {}) as Record<string, unknown>);
    } catch (error: unknown) {
      return {
        content: [
          {
            type: 'text',
            text: `Error: ${maskToken(errorMessage(error))}`,
          },
        ],
        isError: true,
      };
    }
  });

  return server;
}
