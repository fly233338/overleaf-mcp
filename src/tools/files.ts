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

export const searchTextTool: Tool = {
  name: 'search_text',
  description: 'Search project text files and return matching lines',
  inputSchema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'Literal text to search for',
      },
      projectName: {
        type: 'string',
        description: 'Project identifier (optional)',
      },
      extension: {
        type: 'string',
        description: 'File extension filter (optional, defaults to ".tex")',
      },
      caseSensitive: {
        type: 'boolean',
        description: 'Whether matching should be case-sensitive (optional)',
      },
      maxResults: {
        type: 'integer',
        minimum: 1,
        description: 'Maximum number of matching lines (optional, defaults to 100)',
      },
    },
    required: ['query'],
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
      startLine: {
        type: 'integer',
        minimum: 1,
        description: 'First 1-based line to read (optional)',
      },
      endLine: {
        type: 'integer',
        minimum: 1,
        description: 'Last 1-based line to read (optional)',
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

export async function handleSearchText(
  fileService: FileService,
  args: Record<string, unknown>,
): Promise<CallToolResult> {
  const matches = await fileService.searchText(
    requiredString(args.query),
    optionalString(args.projectName),
    optionalString(args.extension),
    optionalBoolean(args.caseSensitive),
    optionalInteger(args.maxResults),
  );
  return textResult(JSON.stringify(matches, null, 2));
}

export async function handleReadFile(
  fileService: FileService,
  args: Record<string, unknown>,
): Promise<CallToolResult> {
  const content = await fileService.readFile(
    requiredString(args.filePath),
    optionalString(args.projectName),
    optionalInteger(args.startLine),
    optionalInteger(args.endLine),
  );
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

function optionalBoolean(value: unknown): boolean | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (typeof value !== 'boolean') {
    throw new Error('Expected a boolean tool argument');
  }
  return value;
}

function optionalInteger(value: unknown): number | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (typeof value !== 'number' || !Number.isInteger(value)) {
    throw new Error('Expected an integer tool argument');
  }
  return value;
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
