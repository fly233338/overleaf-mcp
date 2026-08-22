import type { CallToolResult, Tool } from '@modelcontextprotocol/sdk/types.js';

import type { FileService } from '../core/files.js';
import { optionalString, requiredString } from './files.js';

export const getSectionsTool: Tool = {
  name: 'get_sections',
  description: 'Get all sections from a LaTeX file',
  inputSchema: {
    type: 'object',
    properties: {
      filePath: {
        type: 'string',
        description: 'Path to the LaTeX file',
      },
      projectName: {
        type: 'string',
        description: 'Project identifier (optional)',
      },
    },
    required: ['filePath'],
  },
};

export const getSectionContentTool: Tool = {
  name: 'get_section_content',
  description: 'Get content of a specific section',
  inputSchema: {
    type: 'object',
    properties: {
      filePath: {
        type: 'string',
        description: 'Path to the LaTeX file',
      },
      sectionTitle: {
        type: 'string',
        description: 'Title of the section',
      },
      projectName: {
        type: 'string',
        description: 'Project identifier (optional)',
      },
    },
    required: ['filePath', 'sectionTitle'],
  },
};

export async function handleGetSections(
  fileService: FileService,
  args: Record<string, unknown>,
): Promise<CallToolResult> {
  const sections = await fileService.getSections(requiredString(args.filePath), optionalString(args.projectName));
  return textResult(JSON.stringify(sections, null, 2));
}

export async function handleGetSectionContent(
  fileService: FileService,
  args: Record<string, unknown>,
): Promise<CallToolResult> {
  const content = await fileService.getSectionContent(
    requiredString(args.filePath),
    requiredString(args.sectionTitle),
    optionalString(args.projectName),
  );
  return textResult(content);
}

function textResult(text: string): CallToolResult {
  return { content: [{ type: 'text', text }] };
}
