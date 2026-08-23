import { access, mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';

import { errorMessage, maskToken } from '../../errors.js';
import type { ProjectConfig, ProjectTransport, TextMatch } from '../../types.js';

const execFileAsync = promisify(execFile);

export interface GitCommandOptions {
  cwd: string;
  env: NodeJS.ProcessEnv;
}

export interface GitCommandResult {
  stdout: string;
  stderr: string;
}

export type GitCommandRunner = (
  args: readonly string[],
  options: GitCommandOptions,
) => Promise<GitCommandResult>;

export interface GitTransportOptions {
  tempDir?: string;
  repoPath?: string;
  env?: NodeJS.ProcessEnv;
  runGit?: GitCommandRunner;
}

export class GitTransport implements ProjectTransport {
  readonly projectId: string;
  readonly repoPath: string;

  private readonly gitToken: string;
  private readonly repoUrl: string;
  private readonly tempDir: string;
  private readonly env: NodeJS.ProcessEnv;
  private readonly runGit: GitCommandRunner;

  constructor(project: Pick<ProjectConfig, 'projectId' | 'gitToken'>, options: GitTransportOptions = {}) {
    this.projectId = project.projectId;
    this.gitToken = project.gitToken;
    this.tempDir = options.tempDir ?? os.tmpdir();
    this.repoPath = options.repoPath ?? path.join(this.tempDir, `overleaf-${this.projectId}`);
    this.repoUrl = `https://git:${this.gitToken}@git.overleaf.com/${this.projectId}`;
    this.env = { ...process.env, ...options.env, GIT_TERMINAL_PROMPT: '0' };
    this.runGit = options.runGit ?? defaultGitCommand;
  }

  async repositoryExists(): Promise<boolean> {
    try {
      await access(path.join(this.repoPath, '.git'));
      return true;
    } catch (error: unknown) {
      if (errorCode(error) === 'ENOENT') {
        return false;
      }
      throw error;
    }
  }

  async ensureRepository(): Promise<string> {
    if (await this.repositoryExists()) {
      return this.pull();
    }
    return this.clone();
  }

  async clone(): Promise<string> {
    await mkdir(this.tempDir, { recursive: true });
    const result = await this.execute(['clone', this.repoUrl, this.repoPath], this.tempDir);
    await this.execute(['config', 'user.email', 'mcp@overleaf-mcp.local'], this.repoPath);
    await this.execute(['config', 'user.name', 'Overleaf MCP'], this.repoPath);
    return result.stdout;
  }

  async pull(): Promise<string> {
    const result = await this.execute(['pull'], this.repoPath);
    return result.stdout;
  }

  resolveSafePath(filePath: string): string {
    if (path.isAbsolute(filePath)) {
      throw new Error(`filePath "${filePath}" must be relative to the project directory`);
    }
    const repoRoot = path.resolve(this.repoPath);
    const fullPath = path.resolve(repoRoot, filePath);
    const relative = path.relative(repoRoot, fullPath);
    if (relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
      throw new Error(`filePath "${filePath}" escapes the project directory`);
    }
    return fullPath;
  }

  async listFiles(extension = '.tex'): Promise<string[]> {
    await this.ensureRepository();
    return this.enumerateFiles(extension);
  }

  async searchText(
    query: string,
    extension: string,
    caseSensitive: boolean,
    maxResults: number,
  ): Promise<TextMatch[]> {
    await this.ensureRepository();
    const filePaths = await this.enumerateFiles(extension);
    filePaths.sort((left, right) => left.localeCompare(right));
    const results: TextMatch[] = [];
    const searchQuery = caseSensitive ? query : query.toLowerCase();

    for (const filePath of filePaths) {
      const content = await readFile(this.resolveSafePath(filePath), 'utf8');
      const lines = content.split(/\r\n|\n|\r/);
      for (const [index, text] of lines.entries()) {
        const searchableText = caseSensitive ? text : text.toLowerCase();
        if (searchableText.includes(searchQuery)) {
          results.push({ filePath, line: index + 1, text });
          if (results.length >= maxResults) {
            return results;
          }
        }
      }
    }

    return results;
  }

  private async enumerateFiles(extension = ''): Promise<string[]> {
    const results: string[] = [];

    const walk = async (directory: string): Promise<void> => {
      const entries = await readdir(directory, { withFileTypes: true });
      entries.sort((left, right) => left.name.localeCompare(right.name));
      for (const entry of entries) {
        if (entry.name === '.git' && entry.isDirectory()) {
          continue;
        }
        const fullPath = path.join(directory, entry.name);
        if (entry.isDirectory()) {
          await walk(fullPath);
        } else if (entry.isFile() && (!extension || entry.name.endsWith(extension))) {
          results.push(path.relative(this.repoPath, fullPath));
        }
      }
    };

    await walk(this.repoPath);
    return results;
  }

  async readFile(filePath: string): Promise<string> {
    await this.ensureRepository();
    const fullPath = this.resolveSafePath(filePath);
    return readFile(fullPath, 'utf8');
  }

  async writeFile(filePath: string, content: string, commitMessage: string): Promise<string> {
    this.assertCommitMessage(commitMessage);
    await this.synchronizeForWrite();
    const fullPath = this.resolveSafePath(filePath);
    await writeFile(fullPath, content, 'utf8');
    return this.commitAndPush(fullPath, commitMessage);
  }

  async updateFile(
    filePath: string,
    commitMessage: string,
    updater: (content: string) => string,
  ): Promise<string> {
    this.assertCommitMessage(commitMessage);
    await this.synchronizeForWrite();
    const fullPath = this.resolveSafePath(filePath);
    const currentContent = await readFile(fullPath, 'utf8');
    await writeFile(fullPath, updater(currentContent), 'utf8');
    return this.commitAndPush(fullPath, commitMessage);
  }

  private async synchronizeForWrite(): Promise<void> {
    try {
      await this.ensureRepository();
    } catch (error: unknown) {
      const message = errorMessage(error);
      if (message.includes('CONFLICT')) {
        throw new Error('Merge conflict while pulling. Resolve the conflict in Overleaf, then retry.');
      }
      throw error;
    }
  }

  private assertCommitMessage(commitMessage: string): void {
    if (!commitMessage.trim()) {
      throw new Error('commitMessage is required');
    }
  }

  private async commitAndPush(fullPath: string, commitMessage: string): Promise<string> {
    const relativePath = path.relative(this.repoPath, fullPath);
    try {
      await this.execute(['add', '--', relativePath], this.repoPath);
      await this.execute(['commit', '-m', commitMessage], this.repoPath);
      const result = await this.execute(['push'], this.repoPath);
      return result.stdout;
    } catch (error: unknown) {
      const message = errorMessage(error);
      if (message.includes('non-fast-forward') || message.includes('rejected')) {
        throw new Error('Push rejected, remote has new changes. Retry to pull and re-apply your write.');
      }
      throw error;
    }
  }

  private async execute(args: readonly string[], cwd: string): Promise<GitCommandResult> {
    try {
      return await this.runGit(args, { cwd, env: this.env });
    } catch (error: unknown) {
      const details = error as { stderr?: unknown; stdout?: unknown };
      const output = [errorMessage(error), details.stderr, details.stdout]
        .filter((part): part is unknown => part !== undefined && part !== '')
        .map((part) => String(part))
        .join('\n');
      throw new Error(maskToken(output, this.gitToken));
    }
  }
}

function errorCode(error: unknown): string | undefined {
  if (typeof error !== 'object' || error === null || !('code' in error)) {
    return undefined;
  }
  const code = error.code;
  return typeof code === 'string' ? code : undefined;
}

async function defaultGitCommand(
  args: readonly string[],
  options: GitCommandOptions,
): Promise<GitCommandResult> {
  const result = await execFileAsync('git', [...args], {
    cwd: options.cwd,
    env: options.env,
    windowsHide: true,
    encoding: 'utf8',
  });
  return {
    stdout: String(result.stdout),
    stderr: String(result.stderr),
  };
}
