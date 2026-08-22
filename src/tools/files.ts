import type { CallToolResult, Tool } from '@modelcontextprotocol/sdk/types.js';

import type { FileService } from '../core/files.js';

export const listFilesTool: Tool = {
  name: 'list_files',
  description: 'List files in an Overleaf project',
  inputSchema: {
    type: 'object',
    properties: {
      projectName: {
        type: 'string',
        description: 'Project identifier (optional, defaults to "default")',
      },
      extension: {
        type: 'string',
        description: 'File extension filter (optional, e.g., ".tex")',
      },
    },
  },
};

export const readFileTool: Tool = {
  name: 'read_file',
  description: 'Read a file from an Overleaf project',
  inputSchema: {
    type: 'object',
    properties: {
      filePath: {
        type: 'string',
        description: 'Path to the file',
      },
      projectName: {
        type: 'string',
        description: 'Project identifier (optional)',
      },
    },
    required: ['filePath'],
  },
};

export const statusSummaryTool: Tool = {
  name: 'status_summary',
  description: 'Get a comprehensive project status summary',
  inputSchema: {
    type: 'object',
    properties: {
      projectName: {
        type: 'string',
        description: 'Project identifier (optional)',
      },
    },
  },
};

export async function handleListFiles(
  fileService: FileService,
  args: Record<string, unknown>,
): Promise<CallToolResult> {
  const extension = optionalString(args.extension);
  const files = await fileService.listFiles(optionalString(args.projectName), extension || '.tex');
  return textResult(files.join('\n'));
}

export async function handleReadFile(
  fileService: FileService,
  args: Record<string, unknown>,
): Promise<CallToolResult> {
  const content = await fileService.readFile(requiredString(args.filePath), optionalString(args.projectName));
  return textResult(content);
}

export async function handleStatusSummary(
  fileService: FileService,
  args: Record<string, unknown>,
): Promise<CallToolResult> {
  const summary = await fileService.statusSummary(optionalString(args.projectName));
  return textResult(JSON.stringify(summary, null, 2));
}

export function optionalString(value: unknown): string | undefined {
  return value === undefined ? undefined : requiredStringValue(value);
}

export function requiredString(value: unknown): string {
  return requiredStringValue(value);
}

function requiredStringValue(value: unknown): string {
  if (typeof value !== 'string') {
    throw new Error('Expected a string tool argument');
  }
  return value;
}

function textResult(text: string): CallToolResult {
  return { content: [{ type: 'text', text }] };
}
