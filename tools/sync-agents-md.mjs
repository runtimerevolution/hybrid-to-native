#!/usr/bin/env node
/**
 * sync-agents-md.mjs — copy the shared blocks of the workspace AGENTS.md into each native repo's AGENTS.md.
 *
 * Why: Codex, Copilot's cloud agent and other single-repo tools never read files above a repo's git root, so
 * ios/AGENTS.md and android/AGENTS.md must carry the golden rules and conventions themselves.
 *
 * Usage:
 *   node tools/sync-agents-md.mjs [--targets ios/AGENTS.md,android/AGENTS.md] [--check]
 *
 * Blocks are delimited in the source and in targets by:
 *   <!-- shared:begin NAME -->  …  <!-- shared:end NAME -->
 * A target that lacks a block gets it appended at the end. --check exits 1 if any target would change.
 */
import fs from 'node:fs';
import path from 'node:path';
import { WORKSPACE, parseArgs, printHelp } from './lib/common.mjs';

const args = parseArgs(process.argv.slice(2), ['help', 'check']);
if (args.help) { printHelp(import.meta.url); process.exit(0); }
const root = path.resolve(args.workspace ?? WORKSPACE);
const source = fs.readFileSync(path.join(root, 'AGENTS.md'), 'utf8');
const targets = String(args.targets ?? 'ios/AGENTS.md,android/AGENTS.md').split(',').map((t) => path.resolve(root, t.trim()));
const BLOCK = /<!-- shared:begin (\S+) -->\n([\s\S]*?)<!-- shared:end \1 -->/g;
const NOTE = '<!-- synced from the workspace AGENTS.md by tools/sync-agents-md.mjs: edit it there, not here -->\n';

const blocks = new Map([...source.matchAll(BLOCK)].map((m) => [m[1], m[2]]));
if (!blocks.size) { console.error('✖ no <!-- shared:begin NAME --> blocks in AGENTS.md'); process.exit(1); }

let changed = 0;
for (const target of targets) {
  const rel = path.relative(root, target);
  if (!fs.existsSync(target)) {
    console.warn(`! ${rel} not found. Create it from templates/repo-AGENTS-${rel.split('/')[0]}.md`);
    if (args.check) changed++;
    continue;
  }
  const before = fs.readFileSync(target, 'utf8');
  const done = new Set();
  let after = before.replace(BLOCK, (all, name) => {
    if (!blocks.has(name)) return all;
    done.add(name);
    return `<!-- shared:begin ${name} -->\n${NOTE}${blocks.get(name)}<!-- shared:end ${name} -->`;
  });
  for (const [name, content] of blocks) {
    if (!done.has(name)) after = `${after.replace(/\s*$/, '')}\n\n<!-- shared:begin ${name} -->\n${NOTE}${content}<!-- shared:end ${name} -->\n`;
  }
  if (after === before) { console.log(`✔ ${rel} in sync`); continue; }
  changed++;
  if (args.check) console.log(`✖ ${rel} out of sync`);
  else { fs.writeFileSync(target, after); console.log(`✔ updated ${rel}`); }
}
if (args.check && changed) { console.error('✖ run: node tools/sync-agents-md.mjs'); process.exit(1); }
