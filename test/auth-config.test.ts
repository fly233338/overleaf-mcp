import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { resolveGitToken } from '../src/auth/git-token.js';
import { loadProjectsConfig } from '../src/config.js';

async function tempDirectory(): Promise<string> {
  return mkdtemp(path.join(os.tmpdir(), 'overleaf-mcp-test-'));
}

describe('git token resolution', () => {
  it('prefers the direct token and trims it', async () => {
    const result = await resolveGitToken({
      env: {
        OVERLEAF_GIT_TOKEN: ' direct-token\n',
        OVERLEAF_GIT_TOKEN_FILE: 'token.txt',
      },
      readTokenFile: async () => 'file-token',
    });

    expect(result).toEqual({ token: 'direct-token', source: 'OVERLEAF_GIT_TOKEN' });
  });

  it('reads and trims a token file', async () => {
    const result = await resolveGitToken({
      env: { OVERLEAF_GIT_TOKEN_FILE: 'token.txt' },
      readTokenFile: async (filePath) => {
        expect(filePath).toBe('token.txt');
        return ' file-token\r\n';
      },
    });

    expect(result).toEqual({ token: 'file-token', source: 'OVERLEAF_GIT_TOKEN_FILE' });
  });

  it('treats an unreadable token file as an unavailable implicit candidate', async () => {
    const warnings: string[] = [];
    const result = await resolveGitToken({
      env: { OVERLEAF_GIT_TOKEN_FILE: 'missing-token.txt' },
      readTokenFile: async () => {
        throw new Error('ENOENT');
      },
      onWarning: (message) => warnings.push(message),
    });

    expect(result).toBeUndefined();
    expect(warnings.join('\n')).not.toContain('file-token');
  });
});

describe('project configuration loading', () => {
  it('uses environment single-project configuration before files', async () => {
    const root = await tempDirectory();
    const configDir = path.join(root, 'config');
    const cwd = path.join(root, 'cwd');
    const packageDir = path.join(root, 'package');
    await Promise.all([
      mkdir(configDir, { recursive: true }),
      mkdir(cwd, { recursive: true }),
      mkdir(packageDir, { recursive: true }),
    ]);
    await writeFile(path.join(cwd, 'projects.json'), JSON.stringify({ projects: {} }));

    const config = await loadProjectsConfig({
      env: {
        OVERLEAF_PROJECT_ID: 'env-project',
        OVERLEAF_PROJECT_NAME: 'Env project',
        OVERLEAF_GIT_TOKEN: 'env-secret',
      },
      configDir,
      cwd,
      packageDir,
      onDiagnostic: () => undefined,
    });

    expect(config).toEqual({
      projects: {
        default: { name: 'Env project', projectId: 'env-project', gitToken: 'env-secret' },
      },
    });
  });

  it('loads the first valid implicit candidate and normalizes its values', async () => {
    const root = await tempDirectory();
    const configDir = path.join(root, 'config');
    await mkdir(configDir, { recursive: true });
    await writeFile(
      path.join(configDir, 'projects.json'),
      JSON.stringify({ projects: { paper: { name: ' Paper ', projectId: 'paper-id', gitToken: ' token ' } } }),
    );

    const config = await loadProjectsConfig({
      env: {},
      configDir,
      cwd: path.join(root, 'cwd'),
      packageDir: path.join(root, 'package'),
    });

    expect(config.projects.paper).toEqual({ name: 'Paper', projectId: 'paper-id', gitToken: 'token' });
  });

  it('treats an explicit missing configuration as an error', async () => {
    await expect(
      loadProjectsConfig({
        env: { OVERLEAF_PROJECTS_CONFIG: 'missing-projects.json' },
        readConfigFile: async () => {
          throw new Error('ENOENT');
        },
      }),
    ).rejects.toThrow('could not be read');
  });

  it('rejects invalid project shapes without exposing token values', async () => {
    const raw = JSON.stringify({ projects: { paper: { projectId: 'paper-id', gitToken: 'secret-token' } } });

    await expect(
      loadProjectsConfig({
        env: { OVERLEAF_PROJECTS_CONFIG: 'projects.json' },
        readConfigFile: async () => raw,
      }),
    ).resolves.toEqual({
      projects: { paper: { name: 'paper', projectId: 'paper-id', gitToken: 'secret-token' } },
    });

    const invalid = JSON.stringify({ projects: { paper: { name: 'Paper', projectId: 'bad id', gitToken: 'secret-token' } } });
    await expect(
      loadProjectsConfig({
        env: { OVERLEAF_PROJECTS_CONFIG: 'projects.json' },
        readConfigFile: async () => invalid,
      }),
    ).rejects.toThrowError(/contains whitespace/);
    await expect(
      loadProjectsConfig({
        env: { OVERLEAF_PROJECTS_CONFIG: 'projects.json' },
        readConfigFile: async () => invalid,
      }),
    ).rejects.not.toThrow('secret-token');
  });

  it('does not read a token back through ordinary configuration loading', async () => {
    const root = await tempDirectory();
    const tokenPath = path.join(root, 'token.txt');
    await writeFile(tokenPath, 'secret-token\n');
    const token = await readFile(tokenPath, 'utf8');
    const config = await loadProjectsConfig({
      env: { OVERLEAF_PROJECT_ID: 'project', OVERLEAF_GIT_TOKEN_FILE: tokenPath },
      configDir: path.join(root, 'config'),
      onDiagnostic: () => undefined,
    });

    expect(config.projects.default.gitToken).toBe(token.trim());
  });

  it('validates the environment project id without exposing the token', async () => {
    await expect(
      loadProjectsConfig({
        env: {
          OVERLEAF_PROJECT_ID: 'bad project id',
          OVERLEAF_GIT_TOKEN: 'secret-token',
        },
        onDiagnostic: () => undefined,
      }),
    ).rejects.toThrow(/projectId.*whitespace/);
    await expect(
      loadProjectsConfig({
        env: {
          OVERLEAF_PROJECT_ID: 'bad project id',
          OVERLEAF_GIT_TOKEN: 'secret-token',
        },
        onDiagnostic: () => undefined,
      }),
    ).rejects.not.toThrow('secret-token');
  });
});
