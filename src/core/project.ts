import { GitTransport, type GitTransportOptions } from '../transports/git/git-transport.js';
import type { ProjectConfig, ProjectSummary, ProjectsConfig, ProjectTransport } from '../types.js';

export interface ProjectServiceOptions {
  transportOptions?: GitTransportOptions;
  transportFactory?: (project: ProjectConfig, options: GitTransportOptions) => ProjectTransport;
}

export interface SelectedProject {
  id: string;
  config: ProjectConfig;
  transport: ProjectTransport;
}

export class ProjectService {
  private readonly config: ProjectsConfig;
  private readonly transportOptions: GitTransportOptions;
  private readonly transportFactory: (project: ProjectConfig, options: GitTransportOptions) => ProjectTransport;
  private readonly transports = new Map<string, ProjectTransport>();

  constructor(config: ProjectsConfig, options: ProjectServiceOptions = {}) {
    this.config = config;
    this.transportOptions = options.transportOptions ?? {};
    this.transportFactory = options.transportFactory ?? ((project, transportOptions) => new GitTransport(project, transportOptions));
  }

  listProjects(): ProjectSummary[] {
    return Object.entries(this.config.projects).map(([id, project]) => ({
      id,
      name: id,
      projectId: project.projectId,
    }));
  }

  getProject(projectName?: string): SelectedProject {
    const selectedName = projectName ?? Object.keys(this.config.projects)[0] ?? 'default';
    const project = this.config.projects[selectedName];
    if (!project) {
      throw new Error(`Project "${selectedName}" not found in configuration`);
    }

    let transport = this.transports.get(selectedName);
    if (!transport) {
      transport = this.transportFactory(project, this.transportOptions);
      this.transports.set(selectedName, transport);
    }

    return { id: selectedName, config: project, transport };
  }

}
