#!/usr/bin/env node

export async function main(): Promise<void> {
  console.error('[overleaf-mcp] server implementation is not initialized');
}

if (import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  main().catch((error: unknown) => {
    console.error(`[overleaf-mcp] ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  });
}
