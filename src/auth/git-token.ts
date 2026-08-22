import { readFile } from 'node:fs/promises';

import { ConfigurationError } from '../errors.js';

export interface GitTokenResolution {
  token: string;
  source: 'OVERLEAF_GIT_TOKEN' | 'OVERLEAF_GIT_TOKEN_FILE';
}

export interface GitTokenOptions {
  env?: NodeJS.ProcessEnv;
  readTokenFile?: (filePath: string) => Promise<string>;
}

export async function resolveGitToken(options: GitTokenOptions = {}): Promise<GitTokenResolution | undefined> {
  const env = options.env ?? process.env;
  const direct = env.OVERLEAF_GIT_TOKEN?.trim();
  if (direct) {
    return { token: direct, source: 'OVERLEAF_GIT_TOKEN' };
  }

  const tokenFile = env.OVERLEAF_GIT_TOKEN_FILE?.trim();
  if (!tokenFile) {
    return undefined;
  }

  const readTokenFile = options.readTokenFile ?? ((filePath: string) => readFile(filePath, 'utf8'));
  try {
    const token = (await readTokenFile(tokenFile)).trim();
    if (!token) {
      throw new ConfigurationError(
        `[overleaf-mcp] OVERLEAF_GIT_TOKEN_FILE="${tokenFile}" is empty`,
      );
    }
    return { token, source: 'OVERLEAF_GIT_TOKEN_FILE' };
  } catch (error: unknown) {
    if (error instanceof ConfigurationError) {
      throw error;
    }
    throw new ConfigurationError(
      `[overleaf-mcp] OVERLEAF_GIT_TOKEN_FILE="${tokenFile}" could not be read`,
    );
  }
}
