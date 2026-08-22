export interface ProjectConfig {
  name: string;
  projectId: string;
  gitToken: string;
}

export interface ProjectsConfig {
  projects: Record<string, ProjectConfig>;
}

export interface ProjectTransport {
  listFiles(extension?: string): Promise<string[]>;
  readFile(filePath: string): Promise<string>;
  writeFile(filePath: string, content: string, commitMessage: string): Promise<string>;
  updateFile(
    filePath: string,
    commitMessage: string,
    updater: (content: string) => string,
  ): Promise<string>;
}

export interface ProjectSummary {
  id: string;
  name: string;
  projectId: string;
}

export type SectionType = 'part' | 'chapter' | 'section' | 'subsection' | 'subsubsection';

export interface Section {
  title: string;
  type: SectionType;
  index: number;
}
