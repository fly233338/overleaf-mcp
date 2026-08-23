import { getSectionContent, parseSections, replaceSection } from '../latex/sections.js';
import type { Section, TextMatch } from '../types.js';
import { ProjectService } from './project.js';

export interface StatusSummary {
  totalFiles: number;
  mainFile: string | undefined;
  totalSections: number;
  files: string[];
}

export class FileService {
  constructor(private readonly projects: ProjectService) {}

  async listFiles(projectName?: string, extension = '.tex'): Promise<string[]> {
    return this.projects.getProject(projectName).transport.listFiles(extension);
  }

  async searchText(
    query: string,
    projectName?: string,
    extension = '.tex',
    caseSensitive = false,
    maxResults = 100,
  ): Promise<TextMatch[]> {
    if (typeof query !== 'string' || query.length === 0) {
      throw new Error('query must not be empty');
    }
    if (typeof extension !== 'string' || extension.length === 0) {
      throw new Error('extension must not be empty');
    }
    if (!Number.isInteger(maxResults) || maxResults < 1) {
      throw new Error('maxResults must be a positive integer');
    }

    return this.projects.getProject(projectName).transport.searchText(query, extension, caseSensitive, maxResults);
  }

  async readFile(filePath: string, projectName?: string, startLine?: number, endLine?: number): Promise<string> {
    const content = await this.projects.getProject(projectName).transport.readFile(filePath);
    if (startLine === undefined && endLine === undefined) {
      return content;
    }

    assertPositiveInteger(startLine, 'startLine');
    assertPositiveInteger(endLine, 'endLine');

    const lines = content.split(/\r\n|\n|\r/);
    const firstLine = startLine ?? 1;
    const lastLine = endLine ?? lines.length;
    if (firstLine > lines.length) {
      throw new Error('startLine is beyond the end of the file');
    }
    if (firstLine > lastLine) {
      throw new Error('startLine must not be greater than endLine');
    }

    return lines.slice(firstLine - 1, Math.min(lastLine, lines.length)).join('\n');
  }

  async getSections(filePath: string, projectName?: string): Promise<Section[]> {
    const content = await this.readFile(filePath, projectName);
    return parseSections(content);
  }

  async getSectionContent(filePath: string, sectionTitle: string, projectName?: string): Promise<string> {
    const content = await this.readFile(filePath, projectName);
    return getSectionContent(content, sectionTitle);
  }

  async statusSummary(projectName?: string): Promise<StatusSummary> {
    const files = await this.listFiles(projectName);
    const mainFile = files.find((filePath) => filePath.includes('main.tex')) ?? files[0];
    const sections = mainFile ? await this.getSections(mainFile, projectName) : [];

    return {
      totalFiles: files.length,
      mainFile,
      totalSections: sections.length,
      files: files.slice(0, 10),
    };
  }

  async writeFile(filePath: string, content: string, commitMessage: string, projectName?: string): Promise<string> {
    return this.projects.getProject(projectName).transport.writeFile(filePath, content, commitMessage);
  }

  async writeSection(
    filePath: string,
    sectionTitle: string,
    newContent: string,
    commitMessage: string,
    projectName?: string,
  ): Promise<string> {
    const transport = this.projects.getProject(projectName).transport;
    return transport.updateFile(filePath, commitMessage, (content) =>
      replaceSection(content, sectionTitle, newContent),
    );
  }
}

function assertPositiveInteger(value: number | undefined, name: string): void {
  if (value !== undefined && (!Number.isInteger(value) || value < 1)) {
    throw new Error(`${name} must be a positive integer`);
  }
}
