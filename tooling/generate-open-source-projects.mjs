import { execFile } from 'node:child_process';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const modules = path.join(root, 'node_modules');
const output = path.join(root, 'packages/shared/src/open-source-projects.ts');

const names = [];
for (const entry of await readdir(modules)) {
  if (entry.startsWith('.')) continue;
  if (entry.startsWith('@')) {
    for (const name of await readdir(path.join(modules, entry))) names.push(`${entry}/${name}`);
  } else {
    names.push(entry);
  }
}

const projects = new Map();
let packageCount = 0;
for (const name of names) {
  if (name.startsWith('@astmatrix/') || name.startsWith('@toyshop/')) continue;
  let manifest;
  try {
    manifest = JSON.parse(await readFile(path.join(modules, name, 'package.json'), 'utf8'));
  } catch {
    continue;
  }
  const repository =
    typeof manifest.repository === 'string' ? manifest.repository : manifest.repository?.url;
  if (!repository || !manifest.license) throw new Error(`Missing license or repository: ${name}`);
  const normalized = repository
    .replace(/^git\+/, '')
    .replace(/^git:\/\//, 'https://')
    .replace(/^git@github\.com:/, 'https://github.com/')
    .replace(/\.git$/, '')
    .replace(/^([\w.-]+\/[\w.-]+)$/, 'https://github.com/$1');
  const url = new URL(normalized);
  if (url.hostname !== 'github.com') throw new Error(`Unsupported repository: ${name}`);
  const segments = url.pathname.split('/').filter(Boolean);
  if (segments.length < 2) throw new Error(`Invalid repository: ${name}`);
  const projectUrl = `https://github.com/${segments[0]}/${segments[1]}`;
  const project = projects.get(projectUrl) ?? { licenses: new Set(), packages: [] };
  project.licenses.add(manifest.license === 'MIT License' ? 'MIT' : manifest.license);
  project.packages.push(name);
  projects.set(projectUrl, project);
  packageCount++;
}

// Projects credited manually because they are not installed npm dependencies.
const curatedProjects = [
  {
    url: 'https://github.com/EIHRTeam/AstMatrix',
    license: 'Apache-2.0',
    packages: [],
  },
];
for (const project of curatedProjects) {
  const existing = projects.get(project.url) ?? { licenses: new Set(), packages: [] };
  existing.licenses.add(project.license);
  for (const name of project.packages)
    if (!existing.packages.includes(name)) existing.packages.push(name);
  projects.set(project.url, existing);
}

const entries = [...projects.entries()]
  .sort(([a], [b]) => a.localeCompare(b, 'en'))
  .map(([url, { licenses, packages }]) => ({
    name: url.slice('https://github.com/'.length),
    url,
    license: [...licenses].sort().join(', '),
    packages: packages.sort(),
  }));
const source = `// Generated from installed third-party package manifests and curated credits by tooling/generate-open-source-projects.mjs.\n// Regenerate after a dependency update with: node tooling/generate-open-source-projects.mjs\nexport const openSourceProjects = ${JSON.stringify(entries, null, 2)} as const;\n`;
await writeFile(output, source);
await promisify(execFile)(path.join(modules, '.bin/oxfmt'), [output]);
console.log(`Wrote ${entries.length} open-source projects covering ${packageCount} packages.`);
