import type { CallToolResult, Tool } from '@modelcontextprotocol/sdk/types.js';

import { handleListFiles, handleReadFile, handleStatusSummary, listFilesTool, readFileTool, statusSummaryTool } from './files.js';
import { handleWriteFile, handleWriteSection, writeFileTool, writeSectionTool } from './edit.js';
import { handleGetSectionContent, handleGetSections, getSectionContentTool, getSectionsTool } from './sections.js';
import { handleListProjects, listProjectsTool } from './projects.js';
import type { FileService } from '../core/files.js';
import type { ProjectService } from '../core/project.js';

export interface ToolServices {
  projectService: ProjectService;
  fileService: FileService;
}

export type ToolHandler = (args: Record<string, unknown>) => Promise<CallToolResult>;

export interface ToolRegistry {
  definitions: readonly Tool[];
  handlers: Readonly<Record<string, ToolHandler>>;
}

export function createToolRegistry(services: ToolServices): ToolRegistry {
  const definitions = [
    listProjectsTool,
    listFilesTool,
    readFileTool,
    getSectionsTool,
    getSectionContentTool,
    statusSummaryTool,
    writeFileTool,
    writeSectionTool,
  ] as const;

  const handlers: Record<string, ToolHandler> = {
    list_projects: async () => handleListProjects(services.projectService),
    list_files: (args) => handleListFiles(services.fileService, args),
    read_file: (args) => handleReadFile(services.fileService, args),
    get_sections: (args) => handleGetSections(services.fileService, args),
    get_section_content: (args) => handleGetSectionContent(services.fileService, args),
    status_summary: (args) => handleStatusSummary(services.fileService, args),
    write_file: (args) => handleWriteFile(services.fileService, args),
    write_section: (args) => handleWriteSection(services.fileService, args),
  };

  return { definitions, handlers };
}
