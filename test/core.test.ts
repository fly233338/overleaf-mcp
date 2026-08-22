import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { describe, expect, it, vi } from 'vitest';

import { FileService } from '../src/core/files.js';
import { ProjectService } from '../src/core/project.js';
import { GitTransport } from '../src/transports/git/git-transport.js';

describe('project and file services', () => {
  it('selects the default project and caches its transport lifecycle', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'overleaf-mcp-core-test-'));
    const repoPath = path.join(root, 'repo');
    await mkdir(path.join(repoPath, '.git'), { recursive: true });
    await writeFile(path.join(repoPath, 'main.tex'), '\\section{Intro}\nBody');
    const transport = new GitTransport(
      { projectId: 'project', gitToken: 'secret-token' },
      { repoPath, tempDir: root, runGit: async () => ({ stdout: '', stderr: '' }) },
    );
    const factory = vi.fn(() => transport);
    const projects = new ProjectService(
      {
        projects: {
          default: { name: 'Paper', projectId: 'project', gitToken: 'secret-token' },
          second: { name: 'Second', projectId: 'second', gitToken: 'second-secret' },
        },
      },
      { transportFactory: factory },
    );
    const files = new FileService(projects);

    expect(projects.listProjects()).toEqual([
      { id: 'default', name: 'Paper', projectId: 'project' },
      { id: 'second', name: 'Second', projectId: 'second' },
    ]);
    expect(projects.getProject().transport).toBe(projects.getProject('default').transport);
    expect(factory).toHaveBeenCalledTimes(1);
    await expect(files.getSections('main.tex')).resolves.toEqual([
      { type: 'section', title: 'Intro', index: 0 },
    ]);
    expect(projects.getSecrets()).toEqual(['secret-token', 'second-secret']);
    expect(() => projects.getProject('missing')).toThrow('Project "missing" not found');
  });
});
