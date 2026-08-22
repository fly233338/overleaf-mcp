import { readFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { resolveGitToken } from './auth/git-token.js';
import { ConfigurationError } from './errors.js';
import type { ProjectConfig, ProjectsConfig } from './types.js';

export interface ConfigLoadOptions {
  env?: NodeJS.ProcessEnv;
  cwd?: string;
  configDir?: string;
  packageDir?: string;
  homeDir?: string;
  platform?: NodeJS.Platform;
  readConfigFile?: (filePath: string) => Promise<string>;
  onDiagnostic?: (message: string) => void;
}

interface RawProject {
  name?: unknown;
  projectId?: unknown;
  gitToken?: unknown;
}

interface RawConfig {
  projects?: unknown;
}

export function userConfigDir(
  env: NodeJS.ProcessEnv = process.env,
  platform: NodeJS.Platform = process.platform,
  homeDir: string = os.homedir(),
): string {
  if (platform === 'win32' && env.APPDATA) {
    return path.join(env.APPDATA, 'overleaf-mcp');
  }

  return path.join(env.XDG_CONFIG_HOME || path.join(homeDir, '.config'), 'overleaf-mcp');
}

export async function loadProjectsConfig(options: ConfigLoadOptions = {}): Promise<ProjectsConfig> {
  const env = options.env ?? process.env;
  const cwd = options.cwd ?? process.cwd();
  const configDir = options.configDir ?? userConfigDir(env, options.platform, options.homeDir);
  const packageDir = options.packageDir ?? path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const readConfigFile = options.readConfigFile ?? ((filePath: string) => readFile(filePath, 'utf8'));
  const onDiagnostic = options.onDiagnostic ?? ((message: string) => console.error(message));

  const tokenResolution = await resolveGitToken({
    env,
    onWarning: onDiagnostic,
  });
  const projectId = env.OVERLEAF_PROJECT_ID?.trim();

  if (projectId && tokenResolution) {
    const shadowCandidates = [
      env.OVERLEAF_PROJECTS_CONFIG,
      path.join(configDir, 'projects.json'),
      path.join(cwd, 'projects.json'),
      path.join(packageDir, 'projects.json'),
    ].filter((candidate): candidate is string => Boolean(candidate));

    for (const candidate of shadowCandidates) {
      if (await canReadJson(candidate, readConfigFile)) {
        onDiagnostic(
          `[overleaf-mcp] Using env vars (OVERLEAF_PROJECT_ID + ${tokenResolution.source}). ` +
            `Also found projects.json at ${candidate} — env vars take priority.`,
        );
        break;
      }
    }

    return validateConfig(
      {
        projects: {
          default: {
            name: env.OVERLEAF_PROJECT_NAME?.trim() || 'Overleaf Project',
            projectId,
            gitToken: tokenResolution.token,
          },
        },
      },
      'env vars',
    );
  }

  const explicitConfig = env.OVERLEAF_PROJECTS_CONFIG?.trim();
  if (explicitConfig) {
    const data = await readExplicitConfig(explicitConfig, readConfigFile);
    return validateConfig(data, `OVERLEAF_PROJECTS_CONFIG (${explicitConfig})`);
  }

  const fallbackCandidates = [
    { label: 'user config', filePath: path.join(configDir, 'projects.json') },
    { label: 'cwd', filePath: path.join(cwd, 'projects.json') },
    { label: 'package dir', filePath: path.join(packageDir, 'projects.json') },
  ];

  for (const candidate of fallbackCandidates) {
    const data = await tryReadJson(candidate.filePath, readConfigFile);
    if (data !== undefined) {
      return validateConfig(data, `${candidate.label} (${candidate.filePath})`);
    }
  }

  const candidateList = [...new Set(fallbackCandidates.map((candidate) => candidate.filePath))]
    .map((filePath) => `      ${filePath}`)
    .join('\n');
  throw new ConfigurationError(
    '[overleaf-mcp] No configuration found. Set OVERLEAF_PROJECT_ID together with ' +
      'OVERLEAF_GIT_TOKEN or OVERLEAF_GIT_TOKEN_FILE, set OVERLEAF_PROJECTS_CONFIG, ' +
      `or place projects.json at one of:\n${candidateList}`,
  );
}

async function readExplicitConfig(
  filePath: string,
  readConfigFile: (filePath: string) => Promise<string>,
): Promise<unknown> {
  let raw: string;
  try {
    raw = await readConfigFile(filePath);
  } catch (error: unknown) {
    throw new ConfigurationError(
      `[overleaf-mcp] OVERLEAF_PROJECTS_CONFIG="${filePath}" could not be read: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }

  try {
    return JSON.parse(raw) as unknown;
  } catch (error: unknown) {
    throw new ConfigurationError(
      `[overleaf-mcp] OVERLEAF_PROJECTS_CONFIG="${filePath}" is not valid JSON: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
}

async function tryReadJson(
  filePath: string,
  readConfigFile: (filePath: string) => Promise<string>,
): Promise<unknown | undefined> {
  try {
    return JSON.parse(await readConfigFile(filePath)) as unknown;
  } catch {
    return undefined;
  }
}

async function canReadJson(
  filePath: string,
  readConfigFile: (filePath: string) => Promise<string>,
): Promise<boolean> {
  return (await tryReadJson(filePath, readConfigFile)) !== undefined;
}

function validateConfig(data: unknown, sourceLabel: string): ProjectsConfig {
  if (!isRecord(data) || !isRecord((data as RawConfig).projects)) {
    throw new ConfigurationError(
      `[overleaf-mcp] config from ${sourceLabel} is missing the top-level "projects" object.`,
    );
  }

  const projects: Record<string, ProjectConfig> = {};
  for (const [key, value] of Object.entries((data as RawConfig).projects as Record<string, unknown>)) {
    if (!isRecord(value)) {
      throw new ConfigurationError(`[overleaf-mcp] project ${sourceLabel} → projects.${key} is invalid.`);
    }

    const project = value as RawProject;
    const projectId = typeof project.projectId === 'string' ? project.projectId.trim() : '';
    if (!projectId || /\s/.test(projectId)) {
      throw new ConfigurationError(
        `[overleaf-mcp] projectId from ${sourceLabel} → projects.${key} is empty or contains whitespace.`,
      );
    }

    const gitToken = typeof project.gitToken === 'string' ? project.gitToken.trim() : '';
    if (!gitToken || /\s/.test(gitToken)) {
      throw new ConfigurationError(
        `[overleaf-mcp] gitToken from ${sourceLabel} → projects.${key} is empty or contains whitespace.`,
      );
    }

    const name = typeof project.name === 'string' && project.name.trim() ? project.name.trim() : key;
    projects[key] = { name, projectId, gitToken };
  }

  return { projects };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
