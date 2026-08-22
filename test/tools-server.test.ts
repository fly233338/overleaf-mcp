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
    readFile: vi.fn(async () => 'content'),
    getSections: vi.fn(async () => []),
    getSectionContent: vi.fn(async () => 'section'),
    statusSummary: vi.fn(async () => ({ totalFiles: 1, mainFile: 'main.tex', totalSections: 0, files: ['main.tex'] })),
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
      'read_file',
      'get_sections',
      'get_section_content',
      'status_summary',
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

    expectTextResult(
      await registry.handlers.read_file({ filePath: 'chapters/one.tex', projectName: 'second' }),
      'content',
    );
    expect(services.fileService.readFile).toHaveBeenCalledWith('chapters/one.tex', 'second');

    expectTextResult(
      await registry.handlers.get_sections({ filePath: 'chapters/one.tex', projectName: 'second' }),
      '[]',
    );
    expect(services.fileService.getSections).toHaveBeenCalledWith('chapters/one.tex', 'second');

    expectTextResult(
      await registry.handlers.get_section_content({
        filePath: 'chapters/one.tex',
        sectionTitle: 'Intro',
        projectName: 'second',
      }),
      'section',
    );
    expect(services.fileService.getSectionContent).toHaveBeenCalledWith('chapters/one.tex', 'Intro', 'second');

    expectTextResult(await registry.handlers.status_summary({ projectName: 'second' }), '{\n  "totalFiles": 1,\n  "mainFile": "main.tex",\n  "totalSections": 0,\n  "files": [\n    "main.tex"\n  ]\n}');
    expect(services.fileService.statusSummary).toHaveBeenCalledWith('second');

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
    });
    const server = createServer(services);
    const client = new Client({ name: 'test-client', version: '1.0.0' }, { capabilities: {} });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

    await server.connect(serverTransport);
    await client.connect(clientTransport);

    const listed = await client.listTools();
    expect(listed.tools).toHaveLength(8);

    const failed = await client.callTool({ name: 'read_file', arguments: { filePath: 'main.tex' } });
    expect(failed.isError).toBe(true);
    expect(failed.content[0]).toMatchObject({ type: 'text' });
    expect((failed.content[0] as { text: string }).text).toContain('https://git:***@');
    expect((failed.content[0] as { text: string }).text).not.toContain('secret-token');

    const unknown = await client.callTool({ name: 'unknown_tool', arguments: {} });
    expect(unknown.isError).toBe(true);
    expect((unknown.content[0] as { text: string }).text).toBe('Error: Unknown tool: unknown_tool');

    await client.close();
    await server.close();
  });
});
