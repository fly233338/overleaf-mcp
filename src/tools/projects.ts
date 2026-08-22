import type { CallToolResult, Tool } from '@modelcontextprotocol/sdk/types.js';

import type { ProjectService } from '../core/project.js';

export const listProjectsTool: Tool = {
  name: 'list_projects',
  description: 'List all configured Overleaf projects',
  inputSchema: {
    type: 'object',
    properties: {},
  },
};

export async function handleListProjects(projects: ProjectService): Promise<CallToolResult> {
  return textResult(JSON.stringify(projects.listProjects(), null, 2));
}

function textResult(text: string): CallToolResult {
  return { content: [{ type: 'text', text }] };
}
