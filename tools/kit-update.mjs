#!/usr/bin/env node
/**
 * kit-update.mjs — bring a migration workspace up to date with the kit, without touching the app's own work.
 *
 * Usage (from the workspace root):
 *   node tools/kit-update.mjs --status                   # kit version + kit files changed locally since the last update
 *   node tools/kit-update.mjs --from <kit-dir> [--force] # copy the newer kit into this workspace
 *   node tools/kit-update.mjs --stamp --from <kit-dir>   # record the baseline (init-workspace.sh does this)
 *
 * Kit-owned (replaced on update): AGENTS.md, CLAUDE.md, README.md, HOW_TO_UPDATE.md, KICKOFF.md, VERSION, guidelines/,
 * templates/, tools/, docs/, .claude/agents/, .claude/skills/, skills/, the kit's own ADRs and folder READMEs.
 * Workspace-owned (never touched): PROJECT.md, workspace.config.json, specs/, analysis/, contracts/, e2e/, parity/, decisions/ (other than
 * the kit ADRs), kit-feedback.md, hybrid/, ios/, android/.
 * If a kit-owned file was edited in this workspace, the update stops and lists it. Record it in kit-feedback.md
 * (that's how the kit learns), then re-run with --force.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { WORKSPACE, parseArgs, printHelp, toPosix } from './lib/common.mjs';

const args = parseArgs(process.argv.slice(2), ['help', 'status', 'stamp', 'force', 'post']);
if (args.help) { printHelp(import.meta.url); process.exit(0); }
const root = path.resolve(args.workspace ?? WORKSPACE);
const manifestPath = path.join(root, '.kit-manifest.json');
const versionPath = path.join(root, '.kit-version');
const fail = (m) => { console.error(`✖ ${m}`); process.exit(1); };

const OWNED_FILES = [
  'AGENTS.md', 'CLAUDE.md', 'README.md', 'HOW_TO_UPDATE.md', 'KICKOFF.md', 'VERSION',
  'contracts/README.md', 'e2e/README.md', 'analysis/README.md', 'specs/README.md', 'parity/README.md',
  'decisions/ADR-0001-native-stacks.md', 'decisions/ADR-0002-full-rewrite.md',
  'decisions/ADR-0016-platform-skills.md', 'decisions/ADR-0017-large-screens-and-foldables.md',
];
const OWNED_DIRS = ['guidelines', 'templates', 'tools', 'docs', '.claude/agents', '.claude/skills', 'skills'];
// Files the kit ships as starting points that each workspace then edits: never overwritten, only reported.
const REVIEW_MANUALLY = [
  'PROJECT.md', '.gitignore', 'decisions/README.md', 'decisions/divergences.md', 'decisions/skills-evaluations.md',
  'contracts/sync.config.json', 'contracts/deeplinks.md', 'contracts/flags.md', 'contracts/errors.md',
  'e2e/config.yaml', 'e2e/subflows/launch-clean.yaml', 'e2e/golden/README.md', 'specs/slices/.gitkeep',
];

if (args.status) status();
else if (args.post) post(requireKit());
else if (args.stamp) stamp(requireKit());
else if (args.from) update(requireKit());
else { printHelp(import.meta.url); process.exit(1); }

function status() {
  const v = readJson(versionPath);
  console.log(v ? `kit ${v.version}${v.kitCommit ? ` (${v.kitCommit.slice(0, 7)})` : ''}, from ${v.kitPath}, updated ${v.updatedAt}` : 'no .kit-version (run: node tools/kit-update.mjs --stamp --from <kit-dir>)');
  const changed = locallyModified();
  if (!changed.length) console.log('✔ no kit files changed locally');
  else { console.log(`• ${changed.length} kit file(s) changed locally (record them in kit-feedback.md):`); changed.forEach((f) => console.log(`  - ${f}`)); }
}

function stamp(kit) {
  writeManifest(ownedFiles(root));
  writeVersion(kit);
  console.log(`✔ recorded baseline: kit ${readVersion(kit)} (${Object.keys(readJson(manifestPath).files).length} kit files)`);
}

function update(kit) {
  if (!fs.existsSync(manifestPath)) fail('no .kit-manifest.json. Run --stamp --from <kit-dir> first (or re-create the workspace with init-workspace.sh)');
  const before = readVersion(root);
  const changed = locallyModified();
  if (changed.length && !args.force) {
    console.error(`✖ ${changed.length} kit file(s) were changed in this workspace since the last kit update:`);
    changed.forEach((f) => console.error(`  - ${f}`));
    fail('record them in kit-feedback.md (what and why, with the diff), then re-run with --force to overwrite them');
  }
  const old = readJson(manifestPath).files;
  const incoming = ownedFiles(kit);
  let added = 0, updated = 0, removed = 0;
  for (const rel of incoming) {
    const src = path.join(kit, rel), dst = path.join(root, rel);
    const st = fs.lstatSync(src);
    fs.mkdirSync(path.dirname(dst), { recursive: true });
    const existed = fs.lstatSync(dst, { throwIfNoEntry: false });
    if (st.isSymbolicLink()) {
      const target = fs.readlinkSync(src);
      if (existed?.isSymbolicLink() && fs.readlinkSync(dst) === target) continue;
      if (existed) fs.rmSync(dst, { recursive: true, force: true });
      // .agents/skills links. Without symlink support (Windows), skip: the post step's `skills-sync --links` explains the fix.
      try { fs.symlinkSync(target, dst, fs.statSync(src, { throwIfNoEntry: false })?.isDirectory() ? 'dir' : 'file'); }
      catch (e) { if (e.code === 'EPERM' || e.code === 'EACCES') { console.error(`! can't create symlink ${rel}`); continue; } throw e; }
    } else {
      const buf = fs.readFileSync(src);
      if (existed && !existed.isSymbolicLink() && Buffer.compare(buf, fs.readFileSync(dst)) === 0) continue;
      if (existed?.isSymbolicLink()) fs.unlinkSync(dst);
      fs.writeFileSync(dst, buf);
      fs.chmodSync(dst, st.mode);
    }
    existed ? updated++ : added++;
  }
  for (const rel of Object.keys(old)) {
    if (incoming.includes(rel)) continue;
    const dst = path.join(root, rel);
    if (fs.lstatSync(dst, { throwIfNoEntry: false })) { fs.rmSync(dst, { force: true }); removed++; }
  }
  writeManifest(incoming);
  writeVersion(kit);
  console.log(`✔ kit ${before ?? '?'} → ${readVersion(kit)}: ${added} added, ${updated} updated, ${removed} removed`);

  // The post-update steps run from the freshly copied version of this script, so new logic applies immediately.
  run(['tools/kit-update.mjs', '--post', '--from', kit]);
}

function post(kit) {
  // Starting points the workspace doesn't have yet are simply added; existing ones are only reported.
  for (const rel of REVIEW_MANUALLY) {
    const a = path.join(kit, rel), b = path.join(root, rel);
    if (fs.existsSync(a) && !fs.existsSync(b)) { fs.mkdirSync(path.dirname(b), { recursive: true }); fs.copyFileSync(a, b); console.log(`✔ added starting point ${rel}`); }
  }
  const review = REVIEW_MANUALLY.filter((rel) => {
    const a = path.join(kit, rel), b = path.join(root, rel);
    return fs.existsSync(a) && fs.existsSync(b) && Buffer.compare(fs.readFileSync(a), fs.readFileSync(b)) !== 0;
  });
  if (review.length) {
    console.log('• these starting-point files differ from the kit. Merge what applies by hand:');
    review.forEach((rel) => console.log(`  diff "${path.join(kit, rel)}" "${rel}"`));
  }
  run(['tools/skills-sync.mjs', '--links']);
  if (['ios', 'android'].some((d) => fs.existsSync(path.join(root, d, 'AGENTS.md')))) run(['tools/sync-agents-md.mjs']);
  run(['tools/skills-sync.mjs', '--check']);
}

// ---------- helpers ----------
function requireKit() {
  const kit = path.resolve(String(args.from ?? fail('pass --from <kit-dir>')));
  if (!fs.existsSync(path.join(kit, 'VERSION')) || !fs.existsSync(path.join(kit, 'tools', 'kit-update.mjs'))) fail(`${kit} doesn't look like the kit (no VERSION / tools/kit-update.mjs)`);
  if (kit === root && !args.stamp) fail(`you're in the kit folder itself (${root}). Run this from the app's workspace instead, e.g.:\n  cd ~/Projects/<app>-native && node tools/kit-update.mjs --from "${kit}"`);
  return kit;
}
function ownedFiles(base) {
  const out = [];
  for (const f of OWNED_FILES) if (fs.existsSync(path.join(base, f))) out.push(f);
  const visit = (dir) => {
    for (const e of fs.readdirSync(path.join(base, dir), { withFileTypes: true })) {
      if (e.name === '.DS_Store' || e.name === 'node_modules' || e.name === '.git') continue;
      const rel = toPosix(path.join(dir, e.name));
      if (e.isSymbolicLink() || e.isFile()) out.push(rel);
      else if (e.isDirectory()) visit(rel);
    }
  };
  for (const d of OWNED_DIRS) if (fs.existsSync(path.join(base, d))) visit(d);
  if (fs.existsSync(path.join(base, '.agents', 'skills'))) visit('.agents/skills');
  return out.sort();
}
function fingerprint(abs) {
  const st = fs.lstatSync(abs, { throwIfNoEntry: false });
  if (!st) return null;
  if (st.isSymbolicLink()) return `link:${fs.readlinkSync(abs)}`;
  if (!st.isFile()) return null;
  return crypto.createHash('sha256').update(fs.readFileSync(abs)).digest('hex').slice(0, 16);
}
function writeManifest(files) {
  const map = {};
  for (const rel of files) { const fp = fingerprint(path.join(root, rel)); if (fp) map[rel] = fp; }
  fs.writeFileSync(manifestPath, JSON.stringify({ note: 'GENERATED by tools/kit-update.mjs — fingerprints of kit-owned files as last copied', files: map }, null, 2) + '\n');
}
function locallyModified() {
  const m = readJson(manifestPath);
  if (!m) return [];
  return Object.entries(m.files).filter(([rel, fp]) => fingerprint(path.join(root, rel)) !== fp).map(([rel]) => rel);
}
function writeVersion(kit) {
  let kitCommit = null;
  try { kitCommit = execFileSync('git', ['-C', kit, 'rev-parse', 'HEAD'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(); } catch { /* kit not a git repo */ }
  fs.writeFileSync(versionPath, JSON.stringify({ version: readVersion(kit), kitPath: kit, kitCommit, updatedAt: new Date().toISOString() }, null, 2) + '\n');
}
function readVersion(base) {
  try { return fs.readFileSync(path.join(base, 'VERSION'), 'utf8').trim(); } catch { return null; }
}
function readJson(p) { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return null; } }
function run(argv) {
  try { process.stdout.write(execFileSync('node', argv, { cwd: root, encoding: 'utf8' })); }
  catch (e) { process.stdout.write(e.stdout ?? ''); console.error(`! node ${argv.join(' ')} reported problems (see above)`); }
}
