// Build the release bundle. Publishing/uploading is a separate action.
import { readFileSync, readdirSync, lstatSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { zipSync, strToU8 } from 'fflate';

const root = join(import.meta.dirname, '..'), files = {};
function include(path) {
  const absolute = join(root, path), info = lstatSync(absolute);
  if (info.isSymbolicLink()) throw Error('Release inputs cannot be symlinks.');
  if (info.isDirectory()) for (const name of readdirSync(absolute).sort()) include(path + '/' + name);
  else files['aipets-claude/' + path] = readFileSync(absolute);
}
for (const path of ['README.md', 'LICENSE', 'ASSETS.md', 'docs', '.claude-plugin/marketplace.json',
  'plugin/.claude-plugin/plugin.json', 'plugin/hooks', 'plugin/luna']) include(path);
for (const name of Object.keys(files)) {
  if (/(?:^|\/)(?:\.env[^/]*|node_modules|\.local)(?:\/|$)/.test(name)) throw Error('Private or unbuilt release input.');
}
const sourceCommit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
const dirty = Boolean(execFileSync('git', ['status', '--porcelain'], { cwd: root, encoding: 'utf8' }).trim());
if (dirty) throw Error('Commit the release inputs before packaging.');
files['aipets-claude/release.json'] = strToU8(JSON.stringify({ version: '0.6.1', sourceCommit, dirty,
  status: 'public-beta', files: Object.fromEntries(Object.entries(files).map(([name, bytes]) =>
    [name, createHash('sha256').update(bytes).digest('hex')])) }, null, 2) + '\n');
const bytes = zipSync(files, { level: 6, mtime: new Date('2026-01-01T00:00:00Z') });
const out = join(root, '.local/releases'); mkdirSync(out, { recursive: true });
writeFileSync(join(out, 'aipets-claude-0.6.1-beta.zip'), bytes);
console.log(JSON.stringify({ file: '.local/releases/aipets-claude-0.6.1-beta.zip', bytes: bytes.length,
  sha256: createHash('sha256').update(bytes).digest('hex'), sourceCommit, dirty, entries: Object.keys(files).length }));
