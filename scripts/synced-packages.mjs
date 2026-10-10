// Shared helpers for the nouzl_mobile package sync (spec 0001, Sync contract).
// Used by sync-mobile-packages.mjs (writes the copies) and
// check-synced-packages.mjs (proves nobody edited them here).
// No dependencies, Node 20 or later.

import { createHash } from 'node:crypto';
import { readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

/** The nouzl_mobile packages copied into this repo's packages/ folder. */
export const SYNCED_PACKAGES = ['theme', 'ui', 'i18n', 'auth', 'api', 'config', 'types'];

/** Written at packages/SYNCED.json; records where every copy came from. */
export const MANIFEST_NAME = 'SYNCED.json';

/** The malware marker from the 2026-09-16 force push. A copy carrying it is refused. */
export const MALWARE_MARKER = 'global.i=';

/** CRLF to LF, so a checkout with different line endings hashes the same. */
export function normalize(text) {
  return text.replace(/\r\n/g, '\n');
}

export function sha256(buffer) {
  // Text files hash on LF content; binary files hash on their raw bytes.
  const isText = !buffer.includes(0);
  const data = isText ? Buffer.from(normalize(buffer.toString('utf8')), 'utf8') : buffer;
  return createHash('sha256').update(data).digest('hex');
}

/** Every file under dir (posix relative paths), skipping node_modules. */
export function listFiles(dir, root = dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules') continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) out.push(...listFiles(full, root));
    else out.push(relative(root, full).split(sep).join('/'));
  }
  return out.sort();
}
