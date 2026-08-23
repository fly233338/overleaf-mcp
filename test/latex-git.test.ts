import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { getSectionContent, parseSections, replaceSection } from '../src/latex/sections.js';
import { GitTransport, type GitCommandRunner } from '../src/transports/git/git-transport.js';

describe('LaTeX section functions', () => {
  const document = String.raw`\documentclass{article}
\begin{document}
\section[Short]{Use of \emph{nested} braces}
Intro.
\subsection*{Details}
Details.
\section{Next}
Next body.
\end{document}`;

  it('parses supported starred, optional, and nested section titles', () => {
    expect(parseSections(document)).toEqual([
      { type: 'section', title: String.raw`Use of \emph{nested} braces`, index: 41 },
      { type: 'subsection', title: 'Details', index: 93 },
      { type: 'section', title: 'Next', index: 124 },
    ]);
  });

  it('reads a section through the next section command', () => {
    expect(getSectionContent(document, 'Use of \\emph{nested} braces')).toBe(
      String.raw`\section[Short]{Use of \emph{nested} braces}
Intro.
`,
    );
  });

  it('replaces a section and its nested subsections but preserves the next peer', () => {
    const replacement = String.raw`\section{Use of \emph{replacement}}
Replacement.`;
    expect(replaceSection(document, 'Use of \\emph{nested} braces', replacement)).toBe(
      String.raw`\documentclass{article}
\begin{document}
\section{Use of \emph{replacement}}
Replacement.

\section{Next}
Next body.
\end{document}`,
    );
  });

  it('replaces the last section up to end document and preserves the marker', () => {
    const replacement = String.raw`\section{Final}
Final body.`;
    expect(replaceSection(document, 'Next', replacement)).toBe(
      String.raw`\documentclass{article}
\begin{document}
\section[Short]{Use of \emph{nested} braces}
Intro.
\subsection*{Details}
Details.
\section{Final}
Final body.

\end{document}`,
    );
  });

  it('reports when a requested section does not exist', () => {
    expect(() => getSectionContent(document, 'Missing')).toThrow('Section "Missing" not found');
    expect(() => replaceSection(document, 'Missing', 'replacement')).toThrow('Section "Missing" not found');
  });
});

describe('GitTransport', () => {
  it('keeps file operations inside the repository and stages one target', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'overleaf-mcp-git-test-'));
    const repoPath = path.join(root, 'repo');
    await mkdir(path.join(repoPath, '.git'), { recursive: true });
    await mkdir(path.join(repoPath, 'chapters'), { recursive: true });
    await writeFile(path.join(repoPath, 'main.tex'), 'main');
    await writeFile(path.join(repoPath, 'chapters', 'one.tex'), 'one');
    await writeFile(path.join(repoPath, 'notes.txt'), 'notes');

    const calls: Array<{ args: readonly string[]; cwd: string }> = [];
    const runGit: GitCommandRunner = async (args, options) => {
      calls.push({ args, cwd: options.cwd });
      if (args[0] === 'push') {
        return { stdout: 'pushed\n', stderr: '' };
      }
      return { stdout: 'ok\n', stderr: '' };
    };
    const transport = new GitTransport(
      { projectId: 'project', gitToken: 'secret-token' },
      { repoPath, tempDir: root, runGit },
    );

    expect(await transport.listFiles()).toEqual([path.join('chapters', 'one.tex'), 'main.tex']);
    expect(await transport.readFile('main.tex')).toBe('main');
    expect(calls.map((call) => call.args)).toContainEqual(['pull']);
    expect(() => transport.resolveSafePath(path.join(repoPath, 'main.tex'))).toThrow('must be relative');
    expect(() => transport.resolveSafePath(path.join(root, 'outside'))).toThrow('must be relative');
    expect(() => transport.resolveSafePath('../outside')).toThrow('escapes the project directory');

    await expect(transport.writeFile('main.tex', 'updated', 'update main')).resolves.toBe('pushed\n');
    expect(await readFile(path.join(repoPath, 'main.tex'), 'utf8')).toBe('updated');
    expect(calls.map((call) => call.args)).toContainEqual(['add', '--', 'main.tex']);
    expect(calls.map((call) => call.args)).toContainEqual(['commit', '-m', 'update main']);
    expect(calls.map((call) => call.args)).toContainEqual(['push']);
  });

  it('searches nested text files in order, matches each line once, and pulls once', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'overleaf-mcp-git-test-'));
    const repoPath = path.join(root, 'repo');
    await mkdir(path.join(repoPath, '.git'), { recursive: true });
    await mkdir(path.join(repoPath, 'chapters', 'deep'), { recursive: true });
    await writeFile(path.join(repoPath, 'chapters', 'b.tex'), 'prefix\nNEEDLE in b');
    await writeFile(path.join(repoPath, 'chapters', 'a.tex'), 'needle needle\nNeedle in a');
    await writeFile(path.join(repoPath, 'chapters', 'deep', 'nested.tex'), 'needle deeper');
    await writeFile(path.join(repoPath, 'notes.md'), 'needle markdown');
    await writeFile(path.join(repoPath, 'z.tex'), 'NEEDLE in root\nno match');

    const calls: string[][] = [];
    const runGit: GitCommandRunner = async (args) => {
      calls.push([...args]);
      return { stdout: '', stderr: '' };
    };
    const transport = new GitTransport(
      { projectId: 'project', gitToken: 'secret-token' },
      { repoPath, tempDir: root, runGit },
    );

    await expect(transport.searchText('needle', '.tex', false, 10)).resolves.toEqual([
      { filePath: path.join('chapters', 'a.tex'), line: 1, text: 'needle needle' },
      { filePath: path.join('chapters', 'a.tex'), line: 2, text: 'Needle in a' },
      { filePath: path.join('chapters', 'b.tex'), line: 2, text: 'NEEDLE in b' },
      { filePath: path.join('chapters', 'deep', 'nested.tex'), line: 1, text: 'needle deeper' },
      { filePath: 'z.tex', line: 1, text: 'NEEDLE in root' },
    ]);
    expect(calls.filter((args) => args[0] === 'pull')).toHaveLength(1);

    await expect(transport.searchText('needle', '.tex', true, 10)).resolves.toEqual([
      { filePath: path.join('chapters', 'a.tex'), line: 1, text: 'needle needle' },
      { filePath: path.join('chapters', 'deep', 'nested.tex'), line: 1, text: 'needle deeper' },
    ]);
    await expect(transport.searchText('needle', '.md', false, 10)).resolves.toEqual([
      { filePath: 'notes.md', line: 1, text: 'needle markdown' },
    ]);
    await expect(transport.searchText('needle', '.tex', false, 2)).resolves.toHaveLength(2);
    expect(calls.filter((args) => args[0] === 'pull')).toHaveLength(4);
  });

  it('applies a generic updater after one pull and stages only its target', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'overleaf-mcp-git-test-'));
    const repoPath = path.join(root, 'repo');
    const target = path.join('chapters', 'one.tex');
    await mkdir(path.join(repoPath, '.git'), { recursive: true });
    await mkdir(path.join(repoPath, 'chapters'), { recursive: true });
    await writeFile(path.join(repoPath, target), 'before');

    const calls: string[][] = [];
    const runGit: GitCommandRunner = async (args) => {
      calls.push([...args]);
      return { stdout: '', stderr: '' };
    };
    const transport = new GitTransport(
      { projectId: 'project', gitToken: 'secret-token' },
      { repoPath, tempDir: root, runGit },
    );

    await transport.updateFile(target, 'update chapter', (content) => `${content} after`);

    expect(await readFile(path.join(repoPath, target), 'utf8')).toBe('before after');
    expect(calls).toEqual([
      ['pull'],
      ['add', '--', target],
      ['commit', '-m', 'update chapter'],
      ['push'],
    ]);
  });

  it('does not clone after a non-ENOENT repository access error', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'overleaf-mcp-git-test-'));
    const repoPath = `${root}${String.fromCharCode(0)}repo`;
    const mutableCalls: string[][] = [];
    const runGit: GitCommandRunner = async (args) => {
      mutableCalls.push([...args]);
      return { stdout: '', stderr: '' };
    };
    const transport = new GitTransport(
      { projectId: 'project', gitToken: 'secret-token' },
      { repoPath, tempDir: root, runGit },
    );

    await expect(transport.ensureRepository()).rejects.toThrow();
    expect(mutableCalls).toEqual([]);
  });

  it('maps pull conflicts and rejected pushes to safe user-facing errors', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'overleaf-mcp-git-test-'));
    const repoPath = path.join(root, 'repo');
    await mkdir(path.join(repoPath, '.git'), { recursive: true });
    await writeFile(path.join(repoPath, 'main.tex'), 'main');

    const conflictRunner: GitCommandRunner = async (args) => {
      if (args[0] === 'pull') {
        throw new Error('CONFLICT (content): merge conflict');
      }
      return { stdout: '', stderr: '' };
    };
    const conflictTransport = new GitTransport(
      { projectId: 'project', gitToken: 'secret-token' },
      { repoPath, tempDir: root, runGit: conflictRunner },
    );
    await expect(conflictTransport.writeFile('main.tex', 'updated', 'update')).rejects.toThrow(
      'Merge conflict while pulling',
    );

    const rejectedRunner: GitCommandRunner = async (args) => {
      if (args[0] === 'push') {
        throw new Error('remote rejected: non-fast-forward');
      }
      return { stdout: '', stderr: '' };
    };
    const rejectedTransport = new GitTransport(
      { projectId: 'project', gitToken: 'secret-token' },
      { repoPath, tempDir: root, runGit: rejectedRunner },
    );
    await expect(rejectedTransport.writeFile('main.tex', 'updated', 'update')).rejects.toThrow(
      'Push rejected, remote has new changes',
    );
  });

  it('uses safe arguments and masks tokens in Git failures', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'overleaf-mcp-git-test-'));
    const runGit: GitCommandRunner = async (args) => {
      if (args[0] === 'clone') {
        throw Object.assign(new Error('Command failed'), {
          stderr: 'fatal: https://git:secret-token@git.overleaf.com/project rejected',
        });
      }
      return { stdout: '', stderr: '' };
    };
    const transport = new GitTransport(
      { projectId: 'project', gitToken: 'secret-token' },
      { repoPath: path.join(root, 'repo'), tempDir: root, runGit },
    );

    await expect(transport.readFile('main.tex')).rejects.toThrow('***');
    await expect(transport.readFile('main.tex')).rejects.not.toThrow('secret-token');
  });
});
