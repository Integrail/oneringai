import { access, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const packagePath = fileURLToPath(new URL('../package.json', import.meta.url));
const packageRoot = fileURLToPath(new URL('..', import.meta.url));
const manifest = JSON.parse(await readFile(packagePath, 'utf8'));
const required = new Set([manifest.main, manifest.module, manifest.types]);

for (const target of Object.values(manifest.exports ?? {})) {
  if (typeof target === 'string') required.add(target);
  else if (target && typeof target === 'object') {
    for (const path of Object.values(target)) {
      if (typeof path === 'string') required.add(path);
    }
  }
}

const missing = [];
for (const path of required) {
  if (typeof path !== 'string') continue;
  try {
    await access(new URL(path, `file://${packageRoot}/`));
  } catch {
    missing.push(path);
  }
}

if (missing.length > 0) {
  throw new Error(`Package exports reference missing files:\n${missing.join('\n')}`);
}

console.log(`Verified ${required.size} package export files`);
