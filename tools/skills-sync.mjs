#!/usr/bin/env node
/**
 * skills-sync.mjs — vendor third-party agent skills at pinned commits (skills/lock.json → .claude/skills/).
 *
 * Usage:
 *   node tools/skills-sync.mjs                 # fetch pinned commits, install/refresh vendored skills, remove unlisted ones
 *   node tools/skills-sync.mjs --check         # offline CI check: installed copies match the lock (content, commit AND lock
 *                                              # entry), nothing missing or extra, .agents/skills matches, agent preloads valid
 *   node tools/skills-sync.mjs --outdated      # compare each pin with the upstream default branch (needs network)
 *   node tools/skills-sync.mjs --links         # only rebuild .agents/skills from the installed skills (offline). On Windows this
 *                                              # needs symlink support (Developer Mode + git core.symlinks=true)
 *   node tools/skills-sync.mjs --bump <source-id> [--to <tag|branch|sha>]   # move a pin; then run sync and review the diff
 *
 * For each enabled skill in the lock the tool copies the upstream folder and then:
 *   - rewrites frontmatter: name = installAs, adds `paths` (activation scope) and `disable-model-invocation` if set
 *   - inserts a short "Kit note" under the frontmatter pointing to the precedence rules (guidelines/14-platform-skills.md)
 *   - applies `replace` rules and `extraFiles`, drops `exclude` globs, adds LICENSE + SOURCE.md (provenance)
 * Skills with "enabled": false stay documented in the lock but aren't installed.
 * .agents/skills (read by Codex, Cursor, Gemini…, which ignore Claude-only fields) gets links to the model-invocable skills
 * only, so on-demand skills can't be triggered implicitly by those tools.
 * Needs `git` for fetching; checkouts are cached in .skills-cache/ (gitignored). Node 18+, no dependencies.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { WORKSPACE, parseArgs, printHelp, toPosix, splitFrontMatter, parseFrontMatter, today } from './lib/common.mjs';

const args = parseArgs(process.argv.slice(2), ['help', 'check', 'outdated', 'links']);
if (args.help) { printHelp(import.meta.url); process.exit(0); }
const root = path.resolve(args.workspace ?? WORKSPACE);
const lockPath = path.join(root, 'skills', 'lock.json');
const installedPath = path.join(root, 'skills', 'installed.json');
const lock = JSON.parse(fs.readFileSync(lockPath, 'utf8'));
const installDir = path.resolve(root, lock.installDir ?? '.claude/skills');
const agentsDir = path.resolve(root, lock.agentsSkillsDir ?? '.agents/skills');
const cacheRoot = path.join(root, '.skills-cache');
const IGNORED_FILES = new Set(['.DS_Store']);
const fail = (msg) => { console.error(`✖ ${msg}`); process.exit(1); };
const enabled = (sk) => sk.enabled !== false;
const WINDOWS_LINKS_HINT = 'On Windows, git checks symlinks out as plain text files unless symlinks are enabled: turn on Developer Mode, '
  + 'run `git config core.symlinks true` in this repo, then `git checkout -- .agents` (or re-clone). Everything else works without them.';

if (args.bump) bump(String(args.bump), args.to);
else if (args.links) syncAgentsLinks(false);
else if (args.outdated) outdated();
else if (args.check) check();
else sync();

// ---------- commands ----------
function sync() {
  const previous = readInstalled();
  // 1. fetch everything first, so a network/git failure leaves the workspace untouched
  const checkouts = new Map();
  for (const src of lock.sources.filter((s) => s.skills.some(enabled))) checkouts.set(src.id, fetchCommit(src));
  // 2. build every skill in memory (validates frontmatter) before writing anything
  const built = [];
  for (const src of lock.sources) for (const sk of src.skills.filter(enabled)) built.push({ src, sk, files: buildSkill(src, sk, checkouts.get(src.id)) });
  const names = new Set(built.map((b) => b.sk.installAs));
  if (names.size !== built.length) fail('two lock entries share the same installAs');
  for (const { sk } of built) {
    const dest = path.join(installDir, sk.installAs);
    if (fs.existsSync(dest) && !previous[sk.installAs]) fail(`${toPosix(path.relative(root, dest))} exists but wasn't vendored by skills-sync (a kit playbook or hand-made skill?). Pick another installAs.`);
  }
  // 3. write
  const installed = {};
  for (const { src, sk, files } of built) {
    const dest = path.join(installDir, sk.installAs);
    fs.rmSync(dest, { recursive: true, force: true });
    for (const [rel, content] of files) {
      fs.mkdirSync(path.dirname(path.join(dest, rel)), { recursive: true });
      fs.writeFileSync(path.join(dest, rel), content);
    }
    installed[sk.installAs] = { source: src.id, commit: src.commit, entry: entryHash(src, sk), hash: hashFiles(files) };
    console.log(`✔ ${sk.installAs}  ←  ${src.id}@${src.commit.slice(0, 7)} (${files.size} files)`);
  }
  for (const name of Object.keys(previous)) {
    if (!installed[name]) { fs.rmSync(path.join(installDir, name), { recursive: true, force: true }); console.log(`✔ removed ${name} (no longer in lock)`); }
  }
  fs.writeFileSync(installedPath, JSON.stringify({ note: 'GENERATED by tools/skills-sync.mjs — DO NOT EDIT', skills: installed }, null, 2) + '\n');
  syncAgentsLinks(false);
  for (const p of checkAgentRefs()) console.warn(`! ${p}`);
  console.log(`done: ${Object.keys(installed).length} vendored skill(s). Review with: git diff -- ${toPosix(path.relative(root, installDir))}`);
}

function check() {
  const installed = readInstalled();
  const problems = [];
  const expected = new Map();
  for (const src of lock.sources) for (const sk of src.skills.filter(enabled)) expected.set(sk.installAs, { src, sk });
  for (const [name, { src, sk }] of expected) {
    const rec = installed[name];
    if (!rec) { problems.push(`${name}: not installed (run node tools/skills-sync.mjs)`); continue; }
    if (rec.commit !== src.commit) problems.push(`${name}: installed from ${rec.commit.slice(0, 7)}, lock pins ${src.commit.slice(0, 7)}`);
    if (rec.entry !== entryHash(src, sk)) problems.push(`${name}: lock entry changed since the last sync (mode, paths, replace…); run node tools/skills-sync.mjs`);
    const dir = path.join(installDir, name);
    if (!fs.existsSync(dir)) { problems.push(`${name}: folder missing`); continue; }
    if (hashFiles(readDir(dir)) !== rec.hash) problems.push(`${name}: files differ from the vendored copy (local edits? change skills/lock.json instead)`);
  }
  for (const name of Object.keys(installed)) if (!expected.has(name)) problems.push(`${name}: installed but not in skills/lock.json`);
  problems.push(...syncAgentsLinks(true), ...checkAgentRefs());
  if (problems.length) { console.error(problems.map((p) => `✖ ${p}`).join('\n')); process.exit(1); }
  console.log(`✔ ${expected.size} vendored skill(s) match skills/lock.json; .agents/skills and agent preloads OK`);
}

function outdated() {
  for (const src of lock.sources) {
    let head;
    try { head = git(['ls-remote', src.repo, 'HEAD']).split(/\s+/)[0]; } catch (e) { head = `error: ${String(e.message).split('\n')[0]}`; }
    const same = head.startsWith(src.commit);
    console.log(`${same ? '✔' : '•'} ${src.id.padEnd(22)} pinned ${src.commit.slice(0, 7)} (${src.ref ?? 'sha'})  upstream HEAD ${head.slice(0, 7)}${same ? '' : `  → review ${src.repo}/compare/${src.commit.slice(0, 7)}...${head.slice(0, 7)}, then --bump ${src.id}`}`);
  }
}

function bump(id, to) {
  const src = lock.sources.find((s) => s.id === id) ?? fail(`no source "${id}" in skills/lock.json`);
  let sha = to && /^[0-9a-f]{40}$/.test(to) ? to : null;
  if (!sha) {
    const refs = new Map(git(['ls-remote', src.repo]).trim().split('\n').filter(Boolean).map((l) => { const [s, r] = l.split(/\s+/); return [r, s]; }));
    const candidates = to ? [`refs/tags/${to}^{}`, `refs/tags/${to}`, `refs/heads/${to}`] : ['HEAD'];
    const hit = candidates.find((c) => refs.has(c)) ?? fail(`could not resolve ${to ?? 'HEAD'} exactly on ${src.repo} (tried ${candidates.join(', ')})`);
    sha = refs.get(hit);
  }
  const old = src.commit;
  Object.assign(src, { commit: sha, ref: to ?? `default branch @ ${today()}`, pinnedOn: today() });
  writeLock();
  console.log(`✔ ${id}: ${old.slice(0, 7)} → ${sha.slice(0, 7)}`);
  console.log(`  upstream changes: ${src.repo.replace(/\.git$/, '')}/compare/${old}...${sha}`);
  console.log('  next: node tools/skills-sync.mjs, review the diff, re-check the notes in guidelines/14 §4, log a trial in decisions/skills-evaluations.md');
}

// ---------- building a vendored skill ----------
function buildSkill(src, sk, checkout) {
  const from = path.join(checkout, sk.path);
  if (!fs.existsSync(path.join(from, 'SKILL.md'))) fail(`${src.id}: ${sk.path}/SKILL.md not found at ${src.commit.slice(0, 7)}`);
  const exclude = (sk.exclude ?? []).map(globToRe);
  const files = new Map();
  for (const [rel, buf] of readDir(from)) if (!exclude.some((re) => re.test(rel))) files.set(rel, buf);
  for (const x of sk.extraFiles ?? []) {
    const abs = path.join(checkout, x.from);
    if (!fs.existsSync(abs)) fail(`${src.id}: extraFiles source ${x.from} not found`);
    if (fs.statSync(abs).isFile()) files.set(x.to, fs.readFileSync(abs));
    else for (const [rel, buf] of readDir(abs)) files.set(toPosix(path.join(x.to, rel)), buf);
  }
  const upstream = parseFrontMatter(splitFrontMatter(files.get('SKILL.md').toString('utf8')).fm).name ?? path.basename(sk.path);
  for (const [rel, buf] of files) {
    if (!/\.(md|txt)$/.test(rel)) continue;
    let text = buf.toString('utf8');
    for (const r of sk.replace ?? []) {
      if (r.file && r.file !== rel) continue;
      if (r.required && !text.includes(r.from)) fail(`${src.id}/${sk.installAs}: replace rule text not found in ${rel} (upstream changed?): ${r.from.slice(0, 60)}`);
      text = text.split(r.from).join(r.to);
    }
    if (rel === 'SKILL.md') text = rewriteSkillMd(text, src, sk);
    files.set(rel, Buffer.from(text));
  }
  const licenseFile = path.join(checkout, src.licenseFile ?? 'LICENSE');
  if (fs.existsSync(licenseFile) && !files.has('LICENSE')) files.set('LICENSE', fs.readFileSync(licenseFile));
  files.set('SOURCE.md', Buffer.from([
    `# Source`, '',
    `Vendored by \`tools/skills-sync.mjs\` from \`skills/lock.json\`. **Don't edit files here.** Change the lock and re-sync.`, '',
    `| | |`, `|---|---|`,
    `| Upstream | ${src.repo} |`, `| Path | \`${sk.path}\` |`, `| Commit | \`${src.commit}\` (${src.ref ?? 'sha'}) |`,
    `| License | ${src.license ?? 'see LICENSE'} |`, `| Upstream name | \`${upstream}\` |`,
    `| Mode | ${sk.disableModelInvocation ? 'on demand (human invokes /' + sk.installAs + ')' : 'model-invocable'}${sk.paths?.length ? `, scoped to ${sk.paths.join(', ')}` : ''} |`,
    `| Kit notes | ${sk.note ?? 'guidelines/14-platform-skills.md'} |`, '',
  ].join('\n')));
  return new Map([...files.entries()].sort(([a], [b]) => a.localeCompare(b)));
}

function rewriteSkillMd(text, src, sk) {
  const where = `${src.id}/${sk.installAs}`;
  const { fm, body, hasFm } = splitFrontMatter(text);
  if (!hasFm) fail(`${where}: SKILL.md has no frontmatter`);
  const managed = new Set(['name', 'paths', 'disable-model-invocation']);
  const keyOf = (line) => line.match(/^["']?([A-Za-z_][\w-]*)["']?\s*:/)?.[1];
  const lines = fm.split('\n');
  const kept = [];
  for (let i = 0; i < lines.length; i++) {
    const key = keyOf(lines[i]);
    if (key && managed.has(key)) {
      // skip the value's continuation: indented lines, list items, and blank lines followed by more of them
      while (i + 1 < lines.length && (/^\s+\S/.test(lines[i + 1]) || /^\s*-\s/.test(lines[i + 1]) || (!lines[i + 1].trim() && /^\s+\S/.test(lines[i + 2] ?? '')))) i++;
      continue;
    }
    kept.push(lines[i]);
  }
  const head = [`name: ${sk.installAs}`, ...kept];
  if (sk.paths?.length) head.push(`paths:`, ...sk.paths.map((p) => `  - "${p}"`));
  if (sk.disableModelInvocation) head.push('disable-model-invocation: true');
  // validate: no duplicate top-level keys, no orphan lines
  const seen = new Set();
  for (const line of head) {
    if (!line.trim() || /^\s/.test(line) || /^#/.test(line)) continue;
    const key = keyOf(line);
    if (!key) fail(`${where}: frontmatter line not understood after rewrite: "${line.slice(0, 60)}"`);
    if (seen.has(key)) fail(`${where}: duplicate frontmatter key "${key}" after rewrite`);
    seen.add(key);
    const value = line.slice(line.indexOf(':') + 1).trim();
    if (value && !/^["'>|[{&*!]/.test(value) && (/:\s/.test(value) || /\s#/.test(value))) {
      fail(`${where}: frontmatter "${key}" is a plain YAML scalar containing ": " or " #" (invalid YAML). Adjust the replace rule.`);
    }
  }
  const note = [
    `> **Kit note** (added by \`tools/skills-sync.mjs\`): third-party skill \`${src.id}\` @ \`${src.commit.slice(0, 7)}\`.`,
    `> In this workspace the approved spec and contract, then the kit guidelines and ADRs, take precedence over this skill.`,
    `> Known overrides for this skill: \`${sk.note ?? 'guidelines/14-platform-skills.md'}\`. When advice here conflicts with them,`,
    `> follow the kit and propose a guideline change instead of deviating.`,
  ].join('\n');
  return `---\n${head.join('\n')}\n---\n\n${note}\n\n${body.replace(/^\n+/, '')}`;
}

// ---------- .agents/skills: links to model-invocable skills only ----------
function syncAgentsLinks(checkOnly) {
  const problems = [];
  const want = fs.existsSync(installDir)
    ? fs.readdirSync(installDir, { withFileTypes: true }).filter((d) => d.isDirectory() && fs.existsSync(path.join(installDir, d.name, 'SKILL.md')))
      .map((d) => d.name).filter((n) => !isOnDemand(n)).sort()
    : [];
  const target = (n) => toPosix(path.relative(agentsDir, path.join(installDir, n)));
  if (checkOnly) {
    const st = fs.lstatSync(agentsDir, { throwIfNoEntry: false });
    if (!st || !st.isDirectory() || st.isSymbolicLink()) return [`${toPosix(path.relative(root, agentsDir))}: missing or not a folder of links (run node tools/skills-sync.mjs)`];
    const have = fs.readdirSync(agentsDir).sort();
    let plainFiles = 0;
    for (const n of want) {
      const st = fs.lstatSync(path.join(agentsDir, n), { throwIfNoEntry: false });
      if (!st) problems.push(`.agents/skills/${n}: missing link`);
      else if (!st.isSymbolicLink()) { plainFiles += st.isFile(); problems.push(`.agents/skills/${n}: a plain ${st.isFile() ? 'file' : 'folder'}, not a link`); }
      else if (toPosix(fs.readlinkSync(path.join(agentsDir, n))) !== target(n)) problems.push(`.agents/skills/${n}: link points somewhere else (expected ${target(n)})`);
    }
    for (const n of have) if (!want.includes(n)) problems.push(`.agents/skills/${n}: should not be exposed (on-demand or removed skill)`);
    if (plainFiles) problems.push(WINDOWS_LINKS_HINT);
    return problems;
  }
  const st = fs.lstatSync(agentsDir, { throwIfNoEntry: false });
  if (st?.isSymbolicLink()) fs.unlinkSync(agentsDir);
  fs.mkdirSync(agentsDir, { recursive: true });
  for (const n of fs.readdirSync(agentsDir)) if (!want.includes(n)) fs.rmSync(path.join(agentsDir, n), { recursive: true, force: true });
  for (const n of want) {
    const link = path.join(agentsDir, n);
    if (fs.lstatSync(link, { throwIfNoEntry: false })) fs.rmSync(link, { recursive: true, force: true });
    try { fs.symlinkSync(target(n), link, 'dir'); } // 'dir' matters on Windows only
    catch (e) {
      if (e.code === 'EPERM' || e.code === 'EACCES') fail(`can't create symlinks in ${toPosix(path.relative(root, agentsDir))}. ${WINDOWS_LINKS_HINT}`);
      throw e;
    }
  }
  console.log(`✔ ${toPosix(path.relative(root, agentsDir))}: ${want.length} link(s) (model-invocable skills only)`);
  return problems;
}

/** Every `skills:` entry in .claude/agents/*.md must name an installed skill that can be preloaded. */
function checkAgentRefs() {
  const dir = path.join(root, '.claude', 'agents');
  const problems = [];
  if (!fs.existsSync(dir)) return problems;
  for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.md'))) {
    const meta = parseFrontMatter(splitFrontMatter(fs.readFileSync(path.join(dir, f), 'utf8')).fm);
    for (const s of [].concat(meta.skills || []).filter(Boolean)) {
      if (!fs.existsSync(path.join(installDir, s, 'SKILL.md'))) problems.push(`.claude/agents/${f}: preloads skill "${s}", which is not installed`);
      else if (isOnDemand(s)) problems.push(`.claude/agents/${f}: preloads "${s}", which has disable-model-invocation: true and can't be preloaded`);
    }
  }
  return problems;
}

function isOnDemand(name) {
  const file = path.join(installDir, name, 'SKILL.md');
  if (!fs.existsSync(file)) return false;
  return String(parseFrontMatter(splitFrontMatter(fs.readFileSync(file, 'utf8')).fm)['disable-model-invocation']) === 'true';
}

// ---------- git ----------
function git(argv, cwd) {
  try { return execFileSync('git', argv, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }); }
  catch (e) { throw new Error(`git ${argv.join(' ')} failed: ${(e.stderr || e.message || '').toString().trim().split('\n').pop()}`); }
}
function fetchCommit(src) {
  if (!/^[0-9a-f]{40}$/.test(src.commit ?? '')) fail(`${src.id}: "commit" must be a full 40-character SHA`);
  const dir = path.join(cacheRoot, src.id);
  try {
    if (!fs.existsSync(path.join(dir, '.git'))) { fs.mkdirSync(dir, { recursive: true }); git(['init', '-q'], dir); git(['remote', 'add', 'origin', src.repo], dir); }
    else git(['remote', 'set-url', 'origin', src.repo], dir);
    try { git(['cat-file', '-e', `${src.commit}^{commit}`], dir); }
    catch {
      try { git(['fetch', '-q', '--depth', '1', 'origin', src.commit], dir); }
      catch { git(['fetch', '-q', 'origin'], dir); }
    }
    git(['checkout', '-q', '--force', src.commit], dir);
  } catch (e) { fail(`${src.id}: could not fetch ${src.repo} @ ${src.commit.slice(0, 7)}: ${e.message}. Nothing was changed.`); }
  const head = git(['rev-parse', 'HEAD'], dir).trim();
  if (head !== src.commit) fail(`${src.id}: checked out ${head}, expected ${src.commit}`);
  return dir;
}

// ---------- helpers ----------
function readDir(dir) {
  const out = new Map();
  const visit = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      if (e.name === '.git' || IGNORED_FILES.has(e.name)) continue;
      const p = path.join(d, e.name);
      if (e.isDirectory()) visit(p);
      else if (e.isFile()) out.set(toPosix(path.relative(dir, p)), fs.readFileSync(p));
    }
  };
  visit(dir);
  return out;
}
function readInstalled() {
  return fs.existsSync(installedPath) ? JSON.parse(fs.readFileSync(installedPath, 'utf8')).skills ?? {} : {};
}
function hashFiles(files) {
  const h = crypto.createHash('sha256');
  for (const [rel, buf] of [...files.entries()].sort(([a], [b]) => a.localeCompare(b))) h.update(rel).update('\0').update(buf).update('\0');
  return h.digest('hex').slice(0, 16);
}
function stable(v) {
  if (Array.isArray(v)) return `[${v.map(stable).join(',')}]`;
  if (v && typeof v === 'object') return `{${Object.keys(v).sort().map((k) => `${JSON.stringify(k)}:${stable(v[k])}`).join(',')}}`;
  return JSON.stringify(v);
}
function entryHash(src, sk) {
  return crypto.createHash('sha256').update(stable({ repo: src.repo, commit: src.commit, licenseFile: src.licenseFile ?? null, skill: sk })).digest('hex').slice(0, 16);
}
function globToRe(glob) {
  const re = glob.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*\*\/?/g, '\u0000').replace(/\*/g, '[^/]*').replace(/\u0000/g, '.*');
  return new RegExp(`^${re}$`);
}
/** Keep the lock readable: one line per skill entry. */
function writeLock() {
  const ind = (n) => ' '.repeat(n);
  const src = lock.sources.map((s) => {
    const { skills, ...rest } = s;
    const fields = Object.entries(rest).map(([k, v]) => `${ind(6)}${JSON.stringify(k)}: ${JSON.stringify(v)}`);
    const sks = skills.map((sk) => `${ind(8)}{ ${Object.entries(sk).map(([k, v]) => `${JSON.stringify(k)}: ${JSON.stringify(v)}`).join(', ')} }`);
    return `${ind(4)}{\n${fields.join(',\n')},\n${ind(6)}"skills": [\n${sks.join(',\n')}\n${ind(6)}]\n${ind(4)}}`;
  });
  const top = Object.entries(lock).filter(([k]) => k !== 'sources').map(([k, v]) => `${ind(2)}${JSON.stringify(k)}: ${JSON.stringify(v)}`);
  const out = `{\n${top.join(',\n')},\n${ind(2)}"sources": [\n${src.join(',\n')}\n${ind(2)}]\n}\n`;
  JSON.parse(out);
  fs.writeFileSync(lockPath, out);
}
