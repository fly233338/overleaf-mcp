import { describe, expect, it, vi } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';

import type { FileService } from '../src/core/files.js';
import type { ProjectService } from '../src/core/project.js';
import { createServer } from '../src/server.js';
import { createToolRegistry } from '../src/tools/index.js';

function fakeServices(fileOverrides: Record<string, unknown> = {}) {
  const projectService = {
    listProjects: () => [{ id: 'default', name: 'Paper', projectId: 'project-id' }],
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
    expect(new Set(registry.definitions.map((tool) => tool.name)).size).toBe(8);
    expect(registry.definitions).toMatchSnapshot();
  });

  it('converts core results into the compatibility text results', async () => {
    const services = fakeServices();
    const registry = createToolRegistry(services);

    await expect(registry.handlers.list_projects({})).resolves.toEqual({
      content: [{ type: 'text', text: '[\n  {\n    "id": "default",\n    "name": "Paper",\n    "projectId": "project-id"\n  }\n]' }],
    });
    await expect(registry.handlers.list_files({})).resolves.toEqual({
      content: [{ type: 'text', text: 'main.tex' }],
    });
    await expect(registry.handlers.status_summary({})).resolves.toEqual({
      content: [{ type: 'text', text: '{\n  "totalFiles": 1,\n  "mainFile": "main.tex",\n  "totalSections": 0,\n  "files": [\n    "main.tex"\n  ]\n}' }],
    });
  });
});

describe('MCP server boundary', () => {
  it('serves tools over MCP and returns masked errors for unknown tools', async () => {
    const services = fakeServices({
      readFile: vi.fn(async () => {
        throw new Error('https://git:secret-token@git.overleaf.com/project-id');
      }),
    });
    const server = createServer(services, { secrets: ['secret-token'] });
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
