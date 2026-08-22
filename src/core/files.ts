import { getSectionContent, parseSections } from '../latex/sections.js';
import type { Section } from '../types.js';
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

  async readFile(filePath: string, projectName?: string): Promise<string> {
    return this.projects.getProject(projectName).transport.readFile(filePath);
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
    return this.projects
      .getProject(projectName)
      .transport.writeSection(filePath, sectionTitle, newContent, commitMessage);
  }
}
