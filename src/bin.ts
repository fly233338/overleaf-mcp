#!/usr/bin/env node

import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { pathToFileURL } from 'node:url';

import { loadProjectsConfig } from './config.js';
import { ConfigurationCreatedError, errorMessage, maskToken } from './errors.js';
import { FileService } from './core/files.js';
import { ProjectService } from './core/project.js';
import { createServer } from './server.js';

export async function main(): Promise<void> {
  let config;
  try {
    config = await loadProjectsConfig();
  } catch (error: unknown) {
    if (error instanceof ConfigurationCreatedError) {
      console.error(error.message);
      return;
    }
    throw error;
  }
  const projectService = new ProjectService(config);
  const fileService = new FileService(projectService);
  const server = createServer({ projectService, fileService });
  await server.connect(new StdioServerTransport());
  console.error('Overleaf MCP server running on stdio');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error: unknown) => {
    console.error(`[overleaf-mcp] Fatal error: ${maskToken(errorMessage(error))}`);
    process.exitCode = 1;
  });
}
