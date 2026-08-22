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
      name: project.name,
      projectId: project.projectId,
    }));
  }

  getProject(projectName = 'default'): SelectedProject {
    const project = this.config.projects[projectName];
    if (!project) {
      throw new Error(`Project "${projectName}" not found in configuration`);
    }

    let transport = this.transports.get(projectName);
    if (!transport) {
      transport = this.transportFactory(project, this.transportOptions);
      this.transports.set(projectName, transport);
    }

    return { id: projectName, config: project, transport };
  }

}
