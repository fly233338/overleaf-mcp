import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { resolveGitToken } from '../src/auth/git-token.js';
import { loadProjectsConfig, userConfigDir } from '../src/config.js';

async function tempDirectory(): Promise<string> {
  return mkdtemp(path.join(os.tmpdir(), 'overleaf-mcp-test-'));
}

function errorWithCode(code: string, message = code): Error & { code: string } {
  return Object.assign(new Error(message), { code });
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

  it('fails when the explicit token file cannot be read', async () => {
    await expect(
      resolveGitToken({
        env: { OVERLEAF_GIT_TOKEN_FILE: 'missing-token.txt' },
        readTokenFile: async () => {
          throw errorWithCode('EACCES', 'permission denied: secret-token');
        },
      }),
    ).rejects.toThrow('OVERLEAF_GIT_TOKEN_FILE="missing-token.txt" could not be read');

    await expect(
      resolveGitToken({
        env: { OVERLEAF_GIT_TOKEN_FILE: 'missing-token.txt' },
        readTokenFile: async () => {
          throw errorWithCode('EACCES', 'permission denied: secret-token');
        },
      }),
    ).rejects.not.toThrow('secret-token');
  });

  it('fails when the explicit token file is empty', async () => {
    await expect(
      resolveGitToken({
        env: { OVERLEAF_GIT_TOKEN_FILE: 'empty-token.txt' },
        readTokenFile: async () => ' \r\n',
      }),
    ).rejects.toThrow('OVERLEAF_GIT_TOKEN_FILE="empty-token.txt" is empty');
  });
});

describe('project configuration loading', () => {
  it('uses direct environment configuration before files', async () => {
    const config = await loadProjectsConfig({
      env: {
        OVERLEAF_PROJECT_ID: 'env-project',
        OVERLEAF_PROJECT_NAME: 'Env project',
        OVERLEAF_GIT_TOKEN: 'env-secret',
      },
      readConfigFile: async () => {
        throw new Error('configuration files should not be read');
      },
    });

    expect(config).toEqual({
      projects: {
        default: { name: 'Env project', projectId: 'env-project', gitToken: 'env-secret' },
      },
    });
  });

  it('loads an explicit configuration before implicit candidates', async () => {
    const root = await tempDirectory();
    const explicitPath = path.join(root, 'explicit.json');
    const configDir = path.join(root, 'config');
    const cwd = path.join(root, 'cwd');
    const packageDir = path.join(root, 'package');
    const config = await loadProjectsConfig({
      env: { OVERLEAF_PROJECTS_CONFIG: explicitPath },
      configDir,
      cwd,
      packageDir,
      readConfigFile: async (filePath) => {
        expect(filePath).toBe(explicitPath);
        return JSON.stringify({
          projects: { explicit: { projectId: 'explicit-id', gitToken: 'explicit-token' } },
        });
      },
    });

    expect(config.projects.explicit).toEqual({
      name: 'explicit',
      projectId: 'explicit-id',
      gitToken: 'explicit-token',
    });
  });

  it('loads implicit candidates in user, cwd, then package order', async () => {
    const root = await tempDirectory();
    const configDir = path.join(root, 'config');
    const cwd = path.join(root, 'cwd');
    const packageDir = path.join(root, 'package');
    const candidates = [
      path.join(configDir, 'projects.json'),
      path.join(cwd, 'projects.json'),
      path.join(packageDir, 'projects.json'),
    ];
    const contents = new Map([
      [candidates[0], JSON.stringify({ projects: { user: { projectId: 'user-id', gitToken: 'user-token' } } })],
      [candidates[1], JSON.stringify({ projects: { cwd: { projectId: 'cwd-id', gitToken: 'cwd-token' } } })],
      [candidates[2], JSON.stringify({ projects: { package: { projectId: 'package-id', gitToken: 'package-token' } } })],
    ]);

    const readConfigFile = async (filePath: string): Promise<string> => {
      const content = contents.get(filePath);
      if (content) {
        return content;
      }
      throw errorWithCode('ENOENT');
    };

    await expect(loadProjectsConfig({ env: {}, configDir, cwd, packageDir, readConfigFile })).resolves.toMatchObject({
      projects: { user: { projectId: 'user-id' } },
    });
    contents.delete(candidates[0]);
    await expect(loadProjectsConfig({ env: {}, configDir, cwd, packageDir, readConfigFile })).resolves.toMatchObject({
      projects: { cwd: { projectId: 'cwd-id' } },
    });
    contents.delete(candidates[1]);
    await expect(loadProjectsConfig({ env: {}, configDir, cwd, packageDir, readConfigFile })).resolves.toMatchObject({
      projects: { package: { projectId: 'package-id' } },
    });
  });

  it('falls back only when an implicit candidate is missing', async () => {
    const root = await tempDirectory();
    const configDir = path.join(root, 'config');
    const cwd = path.join(root, 'cwd');
    const packageDir = path.join(root, 'package');
    const readPaths: string[] = [];

    await expect(
      loadProjectsConfig({
        env: {},
        configDir,
        cwd,
        packageDir,
        readConfigFile: async (filePath) => {
          readPaths.push(filePath);
          throw errorWithCode('ENOENT');
        },
      }),
    ).rejects.toThrow('No configuration found');

    expect(readPaths).toEqual([
      path.join(configDir, 'projects.json'),
      path.join(cwd, 'projects.json'),
      path.join(packageDir, 'projects.json'),
    ]);
  });

  it('fails immediately when an implicit candidate contains invalid JSON', async () => {
    const root = await tempDirectory();
    const configDir = path.join(root, 'config');
    const cwd = path.join(root, 'cwd');
    const packageDir = path.join(root, 'package');
    const userPath = path.join(configDir, 'projects.json');
    const cwdPath = path.join(cwd, 'projects.json');

    await expect(
      loadProjectsConfig({
        env: {},
        configDir,
        cwd,
        packageDir,
        readConfigFile: async (filePath) => {
          if (filePath === userPath) {
            return '{';
          }
          if (filePath === cwdPath) {
            return JSON.stringify({ projects: {} });
          }
          throw errorWithCode('ENOENT');
        },
      }),
    ).rejects.toThrow(`config file "${userPath}" is not valid JSON`);
  });

  it('fails immediately when an implicit candidate cannot be read', async () => {
    const root = await tempDirectory();
    const configDir = path.join(root, 'config');
    const userPath = path.join(configDir, 'projects.json');

    await expect(
      loadProjectsConfig({
        env: {},
        configDir,
        cwd: path.join(root, 'cwd'),
        packageDir: path.join(root, 'package'),
        readConfigFile: async () => {
          throw errorWithCode('EACCES', 'permission denied: secret-token');
        },
      }),
    ).rejects.toThrow(`config file "${userPath}" could not be read`);

    await expect(
      loadProjectsConfig({
        env: {},
        configDir,
        cwd: path.join(root, 'cwd'),
        packageDir: path.join(root, 'package'),
        readConfigFile: async () => {
          throw errorWithCode('EACCES', 'permission denied: secret-token');
        },
      }),
    ).rejects.not.toThrow('secret-token');
  });

  it('reports an error when every implicit candidate is missing', async () => {
    await expect(
      loadProjectsConfig({
        env: {},
        configDir: 'config',
        cwd: 'cwd',
        packageDir: 'package',
        readConfigFile: async () => {
          throw errorWithCode('ENOENT');
        },
      }),
    ).rejects.toThrow('No configuration found');
  });

  it('uses the platform-specific user configuration directory', () => {
    expect(userConfigDir({ APPDATA: 'C:\\Users\\tester\\AppData\\Roaming' }, 'win32', 'C:\\Users\\tester')).toBe(
      path.join('C:\\Users\\tester\\AppData\\Roaming', 'overleaf-mcp'),
    );
    expect(userConfigDir({ XDG_CONFIG_HOME: '/tmp/xdg' }, 'linux', '/home/tester')).toBe(
      path.join('/tmp/xdg', 'overleaf-mcp'),
    );
    expect(userConfigDir({}, 'linux', '/home/tester')).toBe(
      path.join('/home/tester', '.config', 'overleaf-mcp'),
    );
  });

  it('treats an explicit missing configuration as an error', async () => {
    await expect(
      loadProjectsConfig({
        env: { OVERLEAF_PROJECTS_CONFIG: 'missing-projects.json' },
        readConfigFile: async () => {
          throw errorWithCode('ENOENT');
        },
      }),
    ).rejects.toThrow('could not be read');
  });

  it('rejects invalid project shapes without exposing token values', async () => {
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

  it('loads a token file for direct environment configuration', async () => {
    const root = await tempDirectory();
    const tokenPath = path.join(root, 'token.txt');
    await writeFile(tokenPath, 'secret-token\n');
    const token = await readFile(tokenPath, 'utf8');
    const config = await loadProjectsConfig({
      env: { OVERLEAF_PROJECT_ID: 'project', OVERLEAF_GIT_TOKEN_FILE: tokenPath },
      configDir: path.join(root, 'config'),
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
      }),
    ).rejects.toThrow(/projectId.*whitespace/);
    await expect(
      loadProjectsConfig({
        env: {
          OVERLEAF_PROJECT_ID: 'bad project id',
          OVERLEAF_GIT_TOKEN: 'secret-token',
        },
      }),
    ).rejects.not.toThrow('secret-token');
  });
});
