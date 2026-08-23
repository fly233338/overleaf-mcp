import type { CallToolResult, Tool } from '@modelcontextprotocol/sdk/types.js';

import {
  handleListFiles,
  handleReadFile,
  handleSearchText,
  listFilesTool,
  readFileTool,
  searchTextTool,
} from './files.js';
import {
  handleReplaceText,
  handleWriteFile,
  handleWriteSection,
  replaceTextTool,
  writeFileTool,
  writeSectionTool,
} from './edit.js';
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
    searchTextTool,
    readFileTool,
    getSectionsTool,
    getSectionContentTool,
    replaceTextTool,
    writeFileTool,
    writeSectionTool,
  ] as const;

  const handlers: Record<string, ToolHandler> = {
    list_projects: async () => handleListProjects(services.projectService),
    list_files: (args) => handleListFiles(services.fileService, args),
    search_text: (args) => handleSearchText(services.fileService, args),
    read_file: (args) => handleReadFile(services.fileService, args),
    get_sections: (args) => handleGetSections(services.fileService, args),
    get_section_content: (args) => handleGetSectionContent(services.fileService, args),
    replace_text: (args) => handleReplaceText(services.fileService, args),
    write_file: (args) => handleWriteFile(services.fileService, args),
    write_section: (args) => handleWriteSection(services.fileService, args),
  };

  return { definitions, handlers };
}
