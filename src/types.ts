export interface ProjectConfig {
  projectId: string;
  gitToken: string;
}

export interface ProjectsConfig {
  projects: Record<string, ProjectConfig>;
}

export interface TextMatch {
  filePath: string;
  line: number;
  text: string;
}

export interface ProjectTransport {
  listFiles(extension?: string): Promise<string[]>;
  searchText(query: string, extension: string, caseSensitive: boolean, maxResults: number): Promise<TextMatch[]>;
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

export interface PreviewHeadingItem {
  type: SectionType;
  title: string;
  startLine: number;
  endLine: number;
}

export interface PreviewReferenceItem {
  type: 'input' | 'include';
  target: string;
  startLine: number;
}

export interface PreviewFloatItem {
  type: 'figure' | 'table';
  startLine: number;
  endLine: number;
  caption?: string;
  label?: string;
}

export type PreviewItem = PreviewHeadingItem | PreviewReferenceItem | PreviewFloatItem;

export interface LatexFilePreview {
  lineCount: number;
  items: PreviewItem[];
}

export interface FilePreview extends LatexFilePreview {
  filePath: string;
}
