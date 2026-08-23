import { describe, expect, it, vi } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';

import type { FileService } from '../src/core/files.js';
import type { ProjectService } from '../src/core/project.js';
import { createServer } from '../src/server.js';
import { createToolRegistry } from '../src/tools/index.js';

function fakeServices(fileOverrides: Record<string, unknown> = {}) {
  const projectService = {
    listProjects: vi.fn(() => [{ id: 'default', name: 'Paper', projectId: 'project-id' }]),
  } as unknown as ProjectService;
  const fileService = {
    listFiles: vi.fn(async () => ['main.tex']),
    previewFile: vi.fn(async () => ({
      filePath: 'main.tex',
      lineCount: 2,
      items: [{ type: 'section', title: 'Intro', startLine: 1, endLine: 2 }],
    })),
    searchText: vi.fn(async () => []),
    readFile: vi.fn(async () => 'content'),
    replaceText: vi.fn(async () => ''),
    writeFile: vi.fn(async () => ''),
    writeSection: vi.fn(async () => ''),
    ...fileOverrides,
  } as unknown as FileService;

  return { projectService, fileService };
}

function expectTextResult(result: { content: Array<{ type: string; text?: string }> }, text: string): void {
  expect(result).toEqual({ content: [{ type: 'text', text }] });
}

describe('MCP tool registry', () => {
  it('keeps the complete ordered compatibility catalog', () => {
    const registry = createToolRegistry(fakeServices());
    expect(registry.definitions.map((tool) => tool.name)).toEqual([
      'list_projects',
      'list_files',
      'preview_file',
      'search_text',
      'read_file',
      'replace_text',
      'write_file',
      'write_section',
    ]);
    expect(registry.definitions).toMatchSnapshot();
  });

  it('forwards all handler arguments and returns text results', async () => {
    const services = fakeServices();
    const registry = createToolRegistry(services);

    expectTextResult(
      await registry.handlers.list_projects({}),
      '[\n  {\n    "id": "default",\n    "name": "Paper",\n    "projectId": "project-id"\n  }\n]',
    );

    expectTextResult(await registry.handlers.list_files({ projectName: 'second', extension: '.md' }), 'main.tex');
    expect(services.fileService.listFiles).toHaveBeenCalledWith('second', '.md');
    expectTextResult(await registry.handlers.list_files({ projectName: 'second', extension: '' }), 'main.tex');
    expect(services.fileService.listFiles).toHaveBeenLastCalledWith('second', '.tex');
    expectTextResult(await registry.handlers.list_files({ projectName: 'second', extension: 'all' }), 'main.tex');
    expect(services.fileService.listFiles).toHaveBeenLastCalledWith('second', 'all');

    expectTextResult(
      await registry.handlers.preview_file({ filePath: 'chapters/one.tex', projectName: 'second' }),
      '{\n  "filePath": "main.tex",\n  "lineCount": 2,\n  "items": [\n    {\n      "type": "section",\n      "title": "Intro",\n      "startLine": 1,\n      "endLine": 2\n    }\n  ]\n}',
    );
    expect(services.fileService.previewFile).toHaveBeenCalledWith('chapters/one.tex', 'second');

    services.fileService.searchText.mockResolvedValue([
      { filePath: 'chapters/one.tex', line: 2, text: 'Needle' },
    ]);
    expectTextResult(
      await registry.handlers.search_text({
        query: 'needle',
        projectName: 'second',
        extension: '.md',
        caseSensitive: true,
        maxResults: 5,
      }),
      '[\n  {\n    "filePath": "chapters/one.tex",\n    "line": 2,\n    "text": "Needle"\n  }\n]',
    );
    expect(services.fileService.searchText).toHaveBeenCalledWith('needle', 'second', '.md', true, 5);

    expectTextResult(
      await registry.handlers.read_file({ filePath: 'chapters/one.tex', projectName: 'second' }),
      'content',
    );
    expect(services.fileService.readFile).toHaveBeenCalledWith('chapters/one.tex', 'second', undefined, undefined);

    expectTextResult(
      await registry.handlers.read_file({
        filePath: 'chapters/one.tex',
        projectName: 'second',
        startLine: 2,
        endLine: 3,
      }),
      'content',
    );
    expect(services.fileService.readFile).toHaveBeenLastCalledWith('chapters/one.tex', 'second', 2, 3);
    await expect(
      registry.handlers.read_file({ filePath: 'chapters/one.tex', startLine: 1.5 }),
    ).rejects.toThrow('integer');

    expectTextResult(
      await registry.handlers.replace_text({
        filePath: 'chapters/one.tex',
        oldText: 'old text',
        newText: '',
        commitMessage: 'delete old text',
        projectName: 'second',
      }),
      'Text replaced and pushed successfully.',
    );
    expect(services.fileService.replaceText).toHaveBeenCalledWith(
      'chapters/one.tex',
      'old text',
      '',
      'delete old text',
      'second',
    );

    expectTextResult(
      await registry.handlers.write_file({
        filePath: 'chapters/one.tex',
        content: 'new file',
        commitMessage: 'write chapter',
        projectName: 'second',
      }),
      'File written and pushed successfully.',
    );
    expect(services.fileService.writeFile).toHaveBeenCalledWith(
      'chapters/one.tex',
      'new file',
      'write chapter',
      'second',
    );

    expectTextResult(
      await registry.handlers.write_section({
        filePath: 'chapters/one.tex',
        sectionTitle: 'Intro',
        newContent: '\\section{Intro}\nUpdated',
        commitMessage: 'update chapter',
        projectName: 'second',
      }),
      'Section written and pushed successfully.',
    );
    expect(services.fileService.writeSection).toHaveBeenCalledWith(
      'chapters/one.tex',
      'Intro',
      '\\section{Intro}\nUpdated',
      'update chapter',
      'second',
    );
  });
});

describe('MCP server boundary', () => {
  it('serves tools over MCP and returns masked errors for unknown tools', async () => {
    const services = fakeServices({
      readFile: vi.fn(async () => {
        throw new Error('https://git:secret-token@git.overleaf.com/project-id');
      }),
      replaceText: vi.fn(async (_filePath: string, oldText: string) => {
        if (oldText === 'missing') {
          throw new Error('oldText was not found');
        }
        throw new Error('oldText is not unique; provide longer context');
      }),
    });
    const server = createServer(services);
    const client = new Client({ name: 'test-client', version: '1.0.0' }, { capabilities: {} });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

    await server.connect(serverTransport);
    await client.connect(clientTransport);

    const listed = await client.listTools();
    expect(listed.tools).toHaveLength(8);

    for (const removedTool of ['get_sections', 'get_section_content']) {
      const removed = await client.callTool({ name: removedTool, arguments: {} });
      expect(removed.isError).toBe(true);
      expect((removed.content[0] as { text: string }).text).toBe(`Error: Unknown tool: ${removedTool}`);
    }

    const removedSummary = await client.callTool({ name: 'status_summary', arguments: {} });
    expect(removedSummary.isError).toBe(true);
    expect((removedSummary.content[0] as { text: string }).text).toBe(
      'Error: Unknown tool: status_summary',
    );

    const missingReplacement = await client.callTool({
      name: 'replace_text',
      arguments: {
        filePath: 'main.tex',
        oldText: 'missing',
        newText: 'new',
        commitMessage: 'replace text',
      },
    });
    expect(missingReplacement.isError).toBe(true);
    expect((missingReplacement.content[0] as { text: string }).text).toBe('Error: oldText was not found');

    const duplicateReplacement = await client.callTool({
      name: 'replace_text',
      arguments: {
        filePath: 'main.tex',
        oldText: 'duplicate',
        newText: 'new',
        commitMessage: 'replace text',
      },
    });
    expect(duplicateReplacement.isError).toBe(true);
    expect((duplicateReplacement.content[0] as { text: string }).text).toContain('not unique');

    const failed = await client.callTool({ name: 'read_file', arguments: { filePath: 'main.tex' } });
    expect(failed.isError).toBe(true);
    expect(failed.content[0]).toMatchObject({ type: 'text' });
    expect((failed.content[0] as { text: string }).text).toContain('https://git:***@');
    expect((failed.content[0] as { text: string }).text).not.toContain('secret-token');

    const unknown = await client.callTool({ name: 'unknown_tool', arguments: {} });
    expect(unknown.isError).toBe(true);
    expect((unknown.content[0] as { text: string }).text).toBe('Error: Unknown tool: unknown_tool');

    const invalidRange = await client.callTool({
      name: 'read_file',
      arguments: { filePath: 'main.tex', startLine: '2' },
    });
    expect(invalidRange.isError).toBe(true);
    expect((invalidRange.content[0] as { text: string }).text).toBe('Error: Expected an integer tool argument');

    await client.close();
    await server.close();
  });
});
