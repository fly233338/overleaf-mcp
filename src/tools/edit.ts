import type { CallToolResult, Tool } from '@modelcontextprotocol/sdk/types.js';

import type { FileService } from '../core/files.js';
import { optionalString, requiredString } from './files.js';

export const writeFileTool: Tool = {
  name: 'write_file',
  description: 'Write content to a file in an Overleaf project and push to Overleaf',
  inputSchema: {
    type: 'object',
    properties: {
      filePath: {
        type: 'string',
        description: 'Path to the file',
      },
      content: {
        type: 'string',
        description: 'Full file content to write',
      },
      commitMessage: {
        type: 'string',
        description: 'Git commit message',
      },
      projectName: {
        type: 'string',
        description: 'Project identifier (optional)',
      },
    },
    required: ['filePath', 'content', 'commitMessage'],
  },
};

export const writeSectionTool: Tool = {
  name: 'write_section',
  description:
    'Replace a single section in a LaTeX file and push to Overleaf. Safer than write_file for targeted edits — only the named section is replaced, leaving the rest of the file untouched.',
  inputSchema: {
    type: 'object',
    properties: {
      filePath: {
        type: 'string',
        description: 'Path to the file',
      },
      sectionTitle: {
        type: 'string',
        description: 'Title of the section to replace (must match exactly)',
      },
      newContent: {
        type: 'string',
        description: 'Full replacement content for the section, including the section heading',
      },
      commitMessage: {
        type: 'string',
        description: 'Git commit message',
      },
      projectName: {
        type: 'string',
        description: 'Project identifier (optional)',
      },
    },
    required: ['filePath', 'sectionTitle', 'newContent', 'commitMessage'],
  },
};

export async function handleWriteFile(
  fileService: FileService,
  args: Record<string, unknown>,
): Promise<CallToolResult> {
  const result = await fileService.writeFile(
    requiredString(args.filePath),
    requiredString(args.content),
    requiredString(args.commitMessage),
    optionalString(args.projectName),
  );
  return textResult(result || 'File written and pushed successfully.');
}

export async function handleWriteSection(
  fileService: FileService,
  args: Record<string, unknown>,
): Promise<CallToolResult> {
  const result = await fileService.writeSection(
    requiredString(args.filePath),
    requiredString(args.sectionTitle),
    requiredString(args.newContent),
    requiredString(args.commitMessage),
    optionalString(args.projectName),
  );
  return textResult(result || 'Section written and pushed successfully.');
}

function textResult(text: string): CallToolResult {
  return { content: [{ type: 'text', text }] };
}
