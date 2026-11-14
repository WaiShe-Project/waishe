// Dev-only: builds the embedded Barlow Condensed subsets in src/fonts/.
// The source TTFs (SIL OFL 1.1) come from the Google Fonts repository and are
// cached in node_modules/.cache/fonts/; only the woff2 subsets and OFL.txt are
// committed. The built Dashboard never fetches fonts.
//
// Usage: node scripts/build-fonts.mjs

import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import subsetFont from 'subset-font';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const CACHE = join(ROOT, 'node_modules/.cache/fonts');
const OUT = join(ROOT, 'src/fonts');
const SOURCE = 'https://raw.githubusercontent.com/google/fonts/main/ofl/barlowcondensed/';

const FACES = [
  { file: 'BarlowCondensed-Medium.ttf', out: 'barlow-condensed-500.woff2' },
  { file: 'BarlowCondensed-SemiBold.ttf', out: 'barlow-condensed-600.woff2' },
];

// Basic Latin (digits, %, letters for model names and VID:PID) plus the few
// symbols the UI prints next to numbers.
const BASIC_LATIN = Array.from({ length: 0x7f - 0x20 }, (_, i) => String.fromCodePoint(0x20 + i)).join('');
const EXTRA = '\u00a0\u00b0\u00d7\u2013\u2014\u2018\u2019\u201c\u201d\u2026\u2039\u203a';
const TEXT = BASIC_LATIN + EXTRA;

// Layout features worth keeping; `tnum` makes the numeral columns line up.
const FEATURES = ['kern', 'liga', 'calt', 'tnum', 'lnum', 'pnum', 'case'];

async function cached(name) {
  const path = join(CACHE, name);
  try {
    await stat(path);
  } catch {
    const res = await fetch(SOURCE + name);
    if (!res.ok) throw new Error(`download ${name}: HTTP ${res.status}`);
    await mkdir(CACHE, { recursive: true });
    await writeFile(path, Buffer.from(await res.arrayBuffer()));
  }
  return readFile(path);
}

await mkdir(OUT, { recursive: true });
for (const face of FACES) {
  const woff2 = await subsetFont(await cached(face.file), TEXT, { targetFormat: 'woff2', keepFeatures: FEATURES });
  await writeFile(join(OUT, face.out), woff2);
  console.log(`${face.out}: ${woff2.length} bytes`);
}
await writeFile(join(OUT, 'OFL.txt'), await cached('OFL.txt'));
console.log('OFL.txt copied');
