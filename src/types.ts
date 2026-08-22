export interface ProjectConfig {
  name: string;
  projectId: string;
  gitToken: string;
}

export interface ProjectsConfig {
  projects: Record<string, ProjectConfig>;
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
