import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const directory = 'apps/web-spa/dist';
const html = readFileSync(join(directory, 'index.html'), 'utf8');
const metadata = JSON.parse(readFileSync(join(directory, 'build-info.json'), 'utf8'));
if (
  metadata.webProfile !== 'web-spa' ||
  metadata.compiler !== 'on' ||
  metadata.base !== '/' ||
  metadata.developmentAdapter !== false ||
  !/^[a-f0-9]{64}$/.test(metadata.sourceSha256) ||
  !/^[a-f0-9]{64}$/.test(metadata.lockSha256)
)
  throw new Error('Invalid SPA build metadata');

const assets = [...html.matchAll(/(?:src|href)="(\/assets\/[^"]+)"/g)].map((match) => match[1]);
if (
  !assets.some((asset) => asset.endsWith('.js')) ||
  !assets.some((asset) => asset.endsWith('.css')) ||
  assets.some((asset) => !existsSync(join(directory, asset.slice(1))))
)
  throw new Error('Missing root-relative SPA assets');
for (const name of ['OCR-A-NOTICE.txt', 'OCR-B-NOTICE.txt', 'BWIP-JS-MIT.txt'])
  if (!existsSync(join(directory, 'licenses', name)))
    throw new Error('Missing SPA redistribution notice ' + name);
if (existsSync(join(directory, '404.html')))
  throw new Error('A top-level 404.html disables the Pages SPA fallback');
console.log('SPA bundle verified.');
