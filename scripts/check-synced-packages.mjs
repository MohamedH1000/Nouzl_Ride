#!/usr/bin/env node
// Proves the synced nouzl_mobile packages were not edited here (spec 0001,
// Sync contract). Fails when a file's hash differs from packages/SYNCED.json,
// a listed file is missing, or a file was added to a synced package by hand.
// No dependencies, safe to run before `npm ci`.

import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { MANIFEST_NAME, listFiles, sha256 } from './synced-packages.mjs';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const packagesDir = join(repoRoot, 'packages');
const manifestPath = join(packagesDir, MANIFEST_NAME);

if (!existsSync(manifestPath)) {
  console.error(`check-synced-packages: packages/${MANIFEST_NAME} is missing. Run npm run sync:mobile.`);
  process.exit(1);
}

const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
const problems = [];
const listed = new Set();

for (const { path, sha256: expected } of manifest.files) {
  listed.add(path);
  const full = join(packagesDir, ...path.split('/'));
  if (!existsSync(full)) problems.push(`${path}: listed in ${MANIFEST_NAME} but missing`);
  else if (sha256(readFileSync(full)) !== expected) problems.push(`${path}: edited by hand (hash does not match)`);
}

for (const name of manifest.packages) {
  const dir = join(packagesDir, name);
  if (!existsSync(dir)) continue;
  for (const rel of listFiles(dir)) {
    const path = `${name}/${rel}`;
    if (!listed.has(path)) problems.push(`${path}: not in ${MANIFEST_NAME} (added by hand?)`);
  }
}

if (problems.length > 0) {
  console.error('check-synced-packages: FAILED');
  for (const p of problems) console.error(`  packages/${p}`);
  console.error('\nThese packages are copies of nouzl_mobile. Change them there, then run npm run sync:mobile.');
  process.exit(1);
}
console.log(
  `check-synced-packages: OK (${manifest.files.length} files from nouzl_mobile@${String(manifest.commit).slice(0, 7)})`,
);
