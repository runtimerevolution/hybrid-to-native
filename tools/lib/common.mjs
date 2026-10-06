// Shared helpers for workspace tools (spec parsing, hashing, CLI args, file walking). Node 18+, no dependencies.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

export const WORKSPACE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
export const FEATURE_ID_RE = /^[A-Z][A-Z0-9]*(?:-[A-Z0-9]+)*$/;
export const AC_ID_GLOBAL = /\b([A-Z][A-Z0-9]*(?:-[A-Z0-9]+)*-AC\d{2,3})\b/g;
export const STATUSES = ['draft', 'approved', 'in-progress', 'implemented', 'verified', 'deferred', 'dropped'];
export const APPROVED_OR_LATER = new Set(['approved', 'in-progress', 'implemented', 'verified']);
const VOLATILE_KEYS = new Set(['status', 'approved_by', 'approved_hash', 'approved_acs', 'editorial_pending']);
const SKIP_DIRS = new Set(['node_modules', '.git', 'build', 'DerivedData', '.gradle', 'Pods', '.build', '.swiftpm', '.idea', '.cxx']);

export function parseArgs(argv, booleans = []) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) { out._.push(a); continue; }
    const [k, v] = a.slice(2).split(/=(.*)/s);
    if (v !== undefined) out[k] = v;
    else if (!booleans.includes(k) && i + 1 < argv.length && !argv[i + 1].startsWith('--')) out[k] = argv[++i];
    else out[k] = true;
  }
  return out;
}

export function printHelp(fileUrl) {
  const src = fs.readFileSync(fileURLToPath(fileUrl), 'utf8');
  console.log(src.slice(src.indexOf('/**'), src.indexOf('*/') + 2));
}

export function* walk(dir) {
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
  for (const e of entries) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { if (!SKIP_DIRS.has(e.name)) yield* walk(p); }
    else if (e.isFile()) yield p;
  }
}

export const toPosix = (p) => p.split(path.sep).join('/');

/** workspace.config.json `mode`: "migration" (hybrid → native, the default) or "new" (a new app, guideline 15). */
export function workspaceMode(root = WORKSPACE) {
  try { return JSON.parse(fs.readFileSync(path.join(root, 'workspace.config.json'), 'utf8')).mode === 'new' ? 'new' : 'migration'; }
  catch { return 'migration'; }
}

// ---------- specs ----------
export function splitFrontMatter(text) {
  const t = text.replace(/\r\n/g, '\n');
  if (!t.startsWith('---\n')) return { fm: '', body: t, hasFm: false };
  const end = t.indexOf('\n---', 3);
  if (end === -1) return { fm: '', body: t, hasFm: false };
  return { fm: t.slice(4, end), body: t.slice(end + 4).replace(/^\n/, ''), hasFm: true };
}

export function parseFrontMatter(fm) {
  const out = {};
  let lastKey = null;
  const clean = (v) => v.trim().replace(/^["']|["']$/g, '');
  for (const line of fm.split('\n')) {
    if (!line.trim() || line.trim().startsWith('#')) continue;
    const item = line.match(/^\s+-\s+(.*)$/);
    if (item && lastKey) {
      if (!Array.isArray(out[lastKey])) out[lastKey] = [];
      out[lastKey].push(clean(item[1].replace(/\s+#.*$/, '')));
      continue;
    }
    const kv = line.match(/^([A-Za-z_][\w-]*)\s*:\s*(.*)$/);
    if (!kv) continue;
    lastKey = kv[1];
    const v = kv[2].replace(/\s+#.*$/, '').trim();
    if (v === '') out[lastKey] = '';
    else if (v.startsWith('[') && v.endsWith(']')) out[lastKey] = v.slice(1, -1).split(',').map(clean).filter(Boolean);
    else out[lastKey] = clean(v);
  }
  return out;
}

export function setFrontMatter(text, updates) {
  const { fm, body, hasFm } = splitFrontMatter(text);
  if (!hasFm) throw new Error('spec has no front matter');
  const lines = fm.split('\n');
  for (const [k, v] of Object.entries(updates)) {
    const i = lines.findIndex((l) => new RegExp(`^${k}\\s*:`).test(l));
    const line = `${k}: ${v}`;
    if (i >= 0) lines[i] = line + (lines[i].match(/\s+#.*$/)?.[0] ?? '');
    else lines.push(line);
  }
  return `---\n${lines.join('\n')}\n---\n${body}`;
}

/**
 * Content hash of a spec, used for approval. Ignores status/approval bookkeeping and the "## Change log" section,
 * so logging a change never invalidates an approval, while any other edit does.
 */
export function specHash(text) { return hashOf(text, true); }
/** The hash as computed by kit ≤ 0.5.x (change log included). Still accepted for approvals recorded back then. */
export function legacySpecHash(text) { return hashOf(text, false); }
function hashOf(text, dropChangeLog) {
  const { fm, body } = splitFrontMatter(text);
  const kept = fm.split('\n').filter((l) => !VOLATILE_KEYS.has(l.match(/^([A-Za-z_][\w-]*)\s*:/)?.[1])).join('\n');
  const norm = (s) => s.replace(/[ \t]+$/gm, '').trim();
  const b = dropChangeLog ? removeSection(body, 'Change log') : body;
  return crypto.createHash('sha256').update(`${norm(kept)}\n---\n${norm(b)}`).digest('hex').slice(0, 12);
}

/** Text of a "## <heading>" section (without the heading line), or null. */
export function sectionText(body, heading) {
  const m = body.match(new RegExp(`^## ${heading.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*$`, 'm'));
  if (!m) return null;
  const rest = body.slice(m.index + m[0].length);
  const next = rest.search(/^## /m);
  return next < 0 ? rest : rest.slice(0, next);
}
function removeSection(body, heading) {
  const text = sectionText(body, heading);
  if (text == null) return body;
  const m = body.match(new RegExp(`^## ${heading}\\s*$`, 'm'));
  return body.slice(0, m.index) + body.slice(m.index + m[0].length + text.length);
}

/**
 * Acceptance criteria: list items starting with **<ID>-ACnn**. An AC runs until the next AC item or heading, so it may
 * span several lines and nested bullets. Optional markers anywhere in it:
 *   _Test level: unit + e2e_     _Platforms: ios_   (platform-scoped AC; default: the spec's platforms)
 */
export function parseAcs(body, id) {
  const lines = body.split('\n');
  const esc = id.replace(/[-]/g, '\\-');
  const re = new RegExp(`^\\s*[-*]\\s+(~~)?\\*\\*(${esc}-AC\\d{2,3})\\*\\*`);
  const anyAc = /^\s*[-*]\s+(~~)?\*\*[A-Z][A-Z0-9]*(?:-[A-Z0-9]+)*-AC\d{2,3}\*\*/;
  const acs = [];
  lines.forEach((line, i) => {
    const m = line.match(re);
    if (!m) return;
    let block = line;
    for (let j = i + 1; j < lines.length && !anyAc.test(lines[j]) && !/^#{1,6}\s/.test(lines[j]); j++) block += ' ' + lines[j];
    const level = block.match(/Test level:\s*([^_*|]+)/i)?.[1] ?? '';
    const plat = block.match(/Platforms?:\s*([^_*|]+)/i)?.[1] ?? '';
    acs.push({
      id: m[2],
      removed: !!m[1] || /\(removed\)/i.test(line),
      levels: level.toLowerCase().split(/[^a-z0-9]+/).filter((x) => ['unit', 'ui', 'e2e', 'manual'].includes(x)),
      platforms: plat.toLowerCase().split(/[^a-z]+/).filter((x) => x === 'ios' || x === 'android'),
      line: i + 1,
    });
  });
  return acs;
}

export function loadSpecs(root = WORKSPACE) {
  const dir = path.join(root, 'specs', 'features');
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => {
      const file = path.join(dir, d.name, 'spec.md');
      if (!fs.existsSync(file)) return null;
      const text = fs.readFileSync(file, 'utf8');
      const { fm, body } = splitFrontMatter(text);
      const meta = parseFrontMatter(fm);
      const id = meta.id || d.name;
      const hash = specHash(text);
      const legacy = legacySpecHash(text);
      return {
        id, folder: d.name, file, text, meta,
        title: meta.title ?? '', status: meta.status || 'draft', priority: meta.priority ?? '', wave: meta.wave ?? '',
        platforms: Array.isArray(meta.platforms) && meta.platforms.length ? meta.platforms : ['ios', 'android'],
        acs: parseAcs(body, id),
        hash, approvedHash: meta.approved_hash || null,
        hashOk: !meta.approved_hash || meta.approved_hash === hash || meta.approved_hash === legacy,
        legacyApproval: !!meta.approved_hash && meta.approved_hash !== hash && meta.approved_hash === legacy,
        approvedAcs: String(meta.approved_acs || '').split(',').map((x) => x.trim()).filter(Boolean),
        editorialPending: Number(meta.editorial_pending || 0),
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.id.localeCompare(b.id));
}

export function mdTable(headers, rows) {
  const esc = (v) => String(v ?? '').replace(/\|/g, '\\|').replace(/\n/g, ' ');
  if (!rows.length) return '_none_\n';
  return `| ${headers.join(' | ')} |\n|${headers.map(() => '---').join('|')}|\n${rows.map((r) => `| ${r.map(esc).join(' | ')} |`).join('\n')}\n`;
}

export const today = () => new Date().toISOString().slice(0, 10);
