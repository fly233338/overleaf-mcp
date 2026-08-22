import { readFile } from 'node:fs/promises';

export interface GitTokenResolution {
  token: string;
  source: 'OVERLEAF_GIT_TOKEN' | 'OVERLEAF_GIT_TOKEN_FILE';
}

export interface GitTokenOptions {
  env?: NodeJS.ProcessEnv;
  readTokenFile?: (filePath: string) => Promise<string>;
  onWarning?: (message: string) => void;
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
      return undefined;
    }
    return { token, source: 'OVERLEAF_GIT_TOKEN_FILE' };
  } catch (error: unknown) {
    options.onWarning?.(
      `[overleaf-mcp] OVERLEAF_GIT_TOKEN_FILE="${tokenFile}" could not be read: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
    return undefined;
  }
}

export const readGitToken = resolveGitToken;
