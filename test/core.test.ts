import { describe, expect, it, vi } from 'vitest';

import { FileService } from '../src/core/files.js';
import { ProjectService } from '../src/core/project.js';
import type { ProjectTransport } from '../src/types.js';

function fakeTransport(files: Record<string, string> = {}): ProjectTransport & {
  listFiles: ReturnType<typeof vi.fn>;
  searchText: ReturnType<typeof vi.fn>;
  readFile: ReturnType<typeof vi.fn>;
  writeFile: ReturnType<typeof vi.fn>;
  updateFile: ReturnType<typeof vi.fn>;
} {
  const contents = new Map(Object.entries(files));
  return {
    listFiles: vi.fn(async () => [...contents.keys()]),
    searchText: vi.fn(async () => []),
    readFile: vi.fn(async (filePath: string) => contents.get(filePath) ?? ''),
    writeFile: vi.fn(async (filePath: string, content: string) => {
      contents.set(filePath, content);
      return 'file written';
    }),
    updateFile: vi.fn(async (filePath: string, _commitMessage: string, updater: (content: string) => string) => {
      const updated = updater(contents.get(filePath) ?? '');
      contents.set(filePath, updated);
      return 'file updated';
    }),
  };
}

describe('project and file services', () => {
  it('selects configured projects and caches each transport lifecycle', async () => {
    const defaultTransport = fakeTransport({ 'main.tex': '\\section{Intro}\nBody' });
    const secondTransport = fakeTransport({ 'second.tex': 'second' });
    const factory = vi.fn((project: { projectId: string }) =>
      project.projectId === 'project' ? defaultTransport : secondTransport,
    );
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
    expect(() => projects.getProject('missing')).toThrow('Project "missing" not found');
  });

  it('summarizes the selected project and limits the displayed files', async () => {
    const projectFiles = [...Array.from({ length: 11 }, (_, index) => `chapter-${index + 1}.tex`), 'main.tex'];
    const selectedTransport = fakeTransport(
      Object.fromEntries(projectFiles.map((filePath) => [filePath, filePath === 'main.tex' ? '\\section{Intro}\nBody' : 'content'])),
    );
    const otherTransport = fakeTransport({ 'other.tex': 'other' });
    const projects = new ProjectService(
      {
        projects: {
          paper: { name: 'Paper', projectId: 'paper-id', gitToken: 'paper-secret' },
          other: { name: 'Other', projectId: 'other-id', gitToken: 'other-secret' },
        },
      },
      {
        transportFactory: (project) =>
          project.projectId === 'paper-id' ? selectedTransport : otherTransport,
      },
    );
    const files = new FileService(projects);

    await expect(files.statusSummary('paper')).resolves.toEqual({
      totalFiles: 12,
      mainFile: 'main.tex',
      totalSections: 1,
      files: projectFiles.slice(0, 10),
    });
    expect(selectedTransport.listFiles).toHaveBeenCalledWith('.tex');
    expect(selectedTransport.readFile).toHaveBeenCalledWith('main.tex');
    expect(otherTransport.listFiles).not.toHaveBeenCalled();
    expect(otherTransport.readFile).not.toHaveBeenCalled();
  });

  it('forwards file operations to the selected project transport', async () => {
    const defaultTransport = fakeTransport({ 'main.tex': '\\section{Intro}\nOld' });
    const secondTransport = fakeTransport({ 'chapters/one.tex': 'second' });
    const projects = new ProjectService(
      {
        projects: {
          default: { name: 'Paper', projectId: 'project', gitToken: 'secret-token' },
          second: { name: 'Second', projectId: 'second', gitToken: 'second-secret' },
        },
      },
      {
        transportFactory: (project) =>
          project.projectId === 'project' ? defaultTransport : secondTransport,
      },
    );
    const files = new FileService(projects);

    await expect(files.listFiles('second')).resolves.toEqual(['chapters/one.tex']);
    await expect(files.readFile('chapters/one.tex', 'second')).resolves.toBe('second');
    await expect(files.writeFile('chapters/one.tex', 'updated', 'write it', 'second')).resolves.toBe('file written');
    expect(secondTransport.writeFile).toHaveBeenCalledWith('chapters/one.tex', 'updated', 'write it');

    await expect(files.writeSection('main.tex', 'Intro', '\\section{Intro}\nNew', 'section edit')).resolves.toBe(
      'file updated',
    );
    expect(defaultTransport.updateFile).toHaveBeenCalledWith('main.tex', 'section edit', expect.any(Function));
    const updater = defaultTransport.updateFile.mock.calls[0][2] as (content: string) => string;
    expect(updater('\\section{Intro}\nOld\n\\section{Next}\nNext')).toBe(
      '\\section{Intro}\nNew\n\n\\section{Next}\nNext',
    );
  });

  it('replaces exactly one literal text match in the selected project', async () => {
    const defaultTransport = fakeTransport({ 'main.tex': 'default' });
    const secondTransport = fakeTransport({
      'abstract.txt': 'before old text after',
      'chapters/one.tex': 'before\nold text\nafter',
    });
    const projects = new ProjectService(
      {
        projects: {
          default: { name: 'Paper', projectId: 'project', gitToken: 'secret-token' },
          second: { name: 'Second', projectId: 'second', gitToken: 'second-secret' },
        },
      },
      {
        transportFactory: (project) =>
          project.projectId === 'project' ? defaultTransport : secondTransport,
      },
    );
    const files = new FileService(projects);

    await expect(
      files.replaceText('chapters/one.tex', 'before\nold text', 'updated', 'replace text', 'second'),
    ).resolves.toBe('file updated');
    expect(secondTransport.updateFile).toHaveBeenCalledWith(
      'chapters/one.tex',
      'replace text',
      expect.any(Function),
    );
    const updater = secondTransport.updateFile.mock.calls[0][2] as (content: string) => string;
    expect(updater('before\nold text\nafter')).toBe('updated\nafter');

    await expect(
      files.replaceText('abstract.txt', 'old text', 'new text', 'replace single line', 'second'),
    ).resolves.toBe('file updated');
    await expect(files.readFile('abstract.txt', 'second')).resolves.toBe('before new text after');
    expect(defaultTransport.updateFile).not.toHaveBeenCalled();
  });

  it('allows deleting a unique match and rejects unsafe replacements without changing content', async () => {
    const transport = fakeTransport({ 'main.tex': 'ababa' });
    const projects = new ProjectService(
      {
        projects: {
          default: { name: 'Paper', projectId: 'project', gitToken: 'secret-token' },
        },
      },
      { transportFactory: () => transport },
    );
    const files = new FileService(projects);

    await expect(files.replaceText('main.tex', 'bab', '', 'delete text')).resolves.toBe('file updated');
    await expect(files.readFile('main.tex')).resolves.toBe('aa');

    await expect(files.replaceText('main.tex', '', 'new', 'empty old text')).rejects.toThrow('oldText');
    await expect(files.replaceText('main.tex', 'aa', 'aa', 'same text')).rejects.toThrow('differ');
    expect(transport.updateFile).toHaveBeenCalledTimes(1);

    await expect(files.replaceText('main.tex', 'missing', 'new', 'missing text')).rejects.toThrow('not found');
    await expect(files.readFile('main.tex')).resolves.toBe('aa');

    await transport.writeFile('main.tex', 'repeat repeat', 'reset');
    await expect(files.replaceText('main.tex', 'repeat', 'new', 'duplicate text')).rejects.toThrow('not unique');
    await expect(files.readFile('main.tex')).resolves.toBe('repeat repeat');

    await transport.writeFile('main.tex', 'aaa', 'reset overlap');
    await expect(files.replaceText('main.tex', 'aa', 'new', 'overlapping text')).rejects.toThrow('not unique');
    await expect(files.readFile('main.tex')).resolves.toBe('aaa');
  });

  it('searches the selected project with defaults and explicit options', async () => {
    const defaultTransport = fakeTransport();
    const secondTransport = fakeTransport();
    const matches = [{ filePath: 'chapters/one.tex', line: 2, text: 'Needle' }];
    secondTransport.searchText.mockResolvedValue(matches);
    const projects = new ProjectService(
      {
        projects: {
          default: { name: 'Paper', projectId: 'project', gitToken: 'secret-token' },
          second: { name: 'Second', projectId: 'second', gitToken: 'second-secret' },
        },
      },
      {
        transportFactory: (project) =>
          project.projectId === 'project' ? defaultTransport : secondTransport,
      },
    );
    const files = new FileService(projects);

    await expect(files.searchText('intro')).resolves.toEqual([]);
    expect(defaultTransport.searchText).toHaveBeenCalledWith('intro', '.tex', false, 100);

    await expect(files.searchText('Needle', 'second', '.md', true, 3)).resolves.toEqual(matches);
    expect(secondTransport.searchText).toHaveBeenCalledWith('Needle', '.md', true, 3);

    await expect(files.searchText('')).rejects.toThrow('query');
    await expect(files.searchText('query', undefined, '')).rejects.toThrow('extension');
    await expect(files.searchText('query', undefined, '.tex', false, 0)).rejects.toThrow('positive integer');
    await expect(files.searchText('query', undefined, '.tex', false, 1.5)).rejects.toThrow('positive integer');
  });

  it('reads complete files unchanged and selects inclusive line ranges', async () => {
    const content = 'one\r\ntwo\rthree\nfour';
    const transport = fakeTransport({
      'notes.txt': content,
      'terminated-lf.txt': 'one\n',
      'terminated-crlf.txt': 'one\r\n',
      'terminated-cr.txt': 'one\r',
      'blank-line.txt': 'one\n\n',
      'empty.txt': '',
    });
    const projects = new ProjectService(
      {
        projects: {
          default: { name: 'Paper', projectId: 'project', gitToken: 'secret-token' },
        },
      },
      { transportFactory: () => transport },
    );
    const files = new FileService(projects);

    await expect(files.readFile('notes.txt')).resolves.toBe(content);
    await expect(files.readFile('notes.txt', undefined, 2, 3)).resolves.toBe('two\nthree');
    await expect(files.readFile('notes.txt', undefined, 2)).resolves.toBe('two\nthree\nfour');
    await expect(files.readFile('notes.txt', undefined, undefined, 2)).resolves.toBe('one\ntwo');
    await expect(files.readFile('notes.txt', undefined, 3, 99)).resolves.toBe('three\nfour');

    await expect(files.readFile('notes.txt', undefined, 0, 2)).rejects.toThrow('startLine');
    await expect(files.readFile('notes.txt', undefined, 1.5, 2)).rejects.toThrow('startLine');
    await expect(files.readFile('notes.txt', undefined, 1, 0)).rejects.toThrow('endLine');
    await expect(files.readFile('notes.txt', undefined, 1, 2.5)).rejects.toThrow('endLine');
    await expect(files.readFile('notes.txt', undefined, 3, 2)).rejects.toThrow('greater than');
    await expect(files.readFile('notes.txt', undefined, 5)).rejects.toThrow('beyond');

    await expect(files.readFile('terminated-lf.txt')).resolves.toBe('one\n');
    await expect(files.readFile('terminated-lf.txt', undefined, 2)).rejects.toThrow('beyond');
    await expect(files.readFile('terminated-crlf.txt', undefined, 2)).rejects.toThrow('beyond');
    await expect(files.readFile('terminated-cr.txt', undefined, 2)).rejects.toThrow('beyond');
    await expect(files.readFile('blank-line.txt', undefined, 2, 2)).resolves.toBe('');
    await expect(files.readFile('empty.txt', undefined, 1)).rejects.toThrow('beyond');
  });
});
