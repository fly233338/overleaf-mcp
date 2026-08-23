import type { CallToolResult, Tool } from '@modelcontextprotocol/sdk/types.js';

import type { FileService } from '../core/files.js';
import { optionalString, requiredString } from './files.js';

export const previewFileTool: Tool = {
  name: 'preview_file',
  description: 'Preview the structure and line ranges of a LaTeX file',
  inputSchema: {
    type: 'object',
    properties: {
      filePath: {
        type: 'string',
        description: 'Path to the LaTeX file',
      },
      projectName: {
        type: 'string',
        description: 'Project identifier (optional, defaults to "default")',
      },
    },
    required: ['filePath'],
  },
};

export async function handlePreviewFile(
  fileService: FileService,
  args: Record<string, unknown>,
): Promise<CallToolResult> {
  const preview = await fileService.previewFile(
    requiredString(args.filePath),
    optionalString(args.projectName),
  );
  return { content: [{ type: 'text', text: JSON.stringify(preview, null, 2) }] };
}
