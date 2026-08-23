import type { CallToolResult, Tool } from '@modelcontextprotocol/sdk/types.js';

import type { FileService } from '../core/files.js';
import { optionalBoolean, optionalString, requiredString } from './files.js';

export const replaceTextTool: Tool = {
  name: 'replace_text',
  description:
    'Replace case-sensitive literal text in a file and push to Overleaf. By default oldText must occur exactly once; set replaceAll to replace every non-overlapping match.',
  inputSchema: {
    type: 'object',
    properties: {
      filePath: {
        type: 'string',
        description: 'Path to the file',
      },
      oldText: {
        type: 'string',
        description: 'Non-empty case-sensitive literal text that must occur exactly once',
      },
      newText: {
        type: 'string',
        description: 'Replacement text (may be empty to delete the match)',
      },
      replaceAll: {
        type: 'boolean',
        default: false,
        description: 'Replace every non-overlapping match (optional, defaults to false)',
      },
      commitMessage: {
        type: 'string',
        description: 'Git commit message',
      },
      projectName: {
        type: 'string',
        description: 'Project identifier (optional, defaults to "default")',
      },
    },
    required: ['filePath', 'oldText', 'newText', 'commitMessage'],
  },
};

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

export async function handleReplaceText(
  fileService: FileService,
  args: Record<string, unknown>,
): Promise<CallToolResult> {
  const result = await fileService.replaceText(
    requiredString(args.filePath),
    requiredString(args.oldText),
    requiredString(args.newText),
    requiredString(args.commitMessage),
    optionalString(args.projectName),
    optionalBoolean(args.replaceAll),
  );
  return textResult(result || 'Text replaced and pushed successfully.');
}

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
