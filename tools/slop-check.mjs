// `npm run slop`: check every piece of copy in src/content/cv.json against the
// BRAND.md copy rules. Exits with code 1 if anything breaks a rule (errors only).
import { readFileSync } from 'node:fs';
import { checkAll } from '../src/os/slop.mjs';

const cv = JSON.parse(readFileSync(new URL('../src/content/cv.json', import.meta.url), 'utf8'));
const results = checkAll(cv);
const colour = { error: '\x1b[31m', warn: '\x1b[33m', info: '\x1b[36m' };
const count = { error: 0, warn: 0, info: 0 };

for (const { path, issues } of results) {
  console.log(`\x1b[2m${path}\x1b[0m`);
  for (const i of issues) {
    count[i.level]++;
    console.log(`  ${colour[i.level]}${i.level.padEnd(5)}\x1b[0m ${i.message}`);
  }
}
console.log(`\n${count.error} errors, ${count.warn} warnings, ${count.info} notes`);
process.exit(count.error ? 1 : 0);
