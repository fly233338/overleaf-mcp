import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const packageJson = JSON.parse(readFileSync('package.json', 'utf8'));
const binPath = packageJson.bin['overleaf-mcp'];
const binSource = readFileSync(binPath.replace(/^\.\//, '').replace(/^dist\\/, 'dist/'), 'utf8');

if (!binSource.startsWith('#!/usr/bin/env node')) {
  throw new Error('published bin is missing its node shebang');
}

const packCommand = process.platform === 'win32' ? process.env.ComSpec ?? 'cmd.exe' : 'npm';
const packArgs = process.platform === 'win32'
  ? ['/d', '/s', '/c', 'npm.cmd pack --dry-run --json --ignore-scripts']
  : ['pack', '--dry-run', '--json', '--ignore-scripts'];
const raw = execFileSync(packCommand, packArgs, {
  encoding: 'utf8',
  stdio: ['ignore', 'pipe', 'inherit'],
});
const report = JSON.parse(raw);
const files = report[0]?.files?.map((file) => file.path) ?? [];
const forbidden = files.filter((file) =>
  /^(?:docs\/|test\/|tests\/|vitest\.config|tsconfig|AGENTS\.md|\.env|projects\.json)/i.test(file),
);

if (forbidden.length > 0) {
  throw new Error(`package contains forbidden files: ${forbidden.join(', ')}`);
}

for (const required of ['dist/bin.js', 'dist/index.js', 'LICENSE', 'README.md']) {
  if (!files.includes(required)) {
    throw new Error(`package is missing ${required}`);
  }
}
