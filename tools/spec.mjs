#!/usr/bin/env node
/**
 * spec.mjs — manage feature specs in specs/features/<FEATURE-ID>/.
 *
 * Usage:
 *   node tools/spec.mjs new <FEATURE-ID> "<title>" [--priority P0] [--wave 1]
 *   node tools/spec.mjs approve <ID> [<ID>…] --by "<name>"     # or: approve --slice SLICE-01 --by "<name>"
 *   node tools/spec.mjs amend <ID> --editorial "<reason>" --by "<who>"   # wording-only edit to an approved spec
 *   node tools/spec.mjs status <ID> <draft|approved|in-progress|implemented|verified|deferred|dropped> [--force]
 *   node tools/spec.mjs check [<ID>]          # all specs: exit 1 if an approved+ spec changed since approval
 *                                              # one spec: also exit 1 unless it is approved (or later)
 *   node tools/spec.mjs list                   # status, AC count, approval hash, editorial amendments, unmet dependencies
 *
 * Approval stores a content hash (approved_hash) and the active AC IDs (approved_acs) in the front matter. Any later edit
 * changes the hash, so `check` (run in CI) catches specs edited without approval. The change log doesn't count.
 *  - Approving an already-approved, unchanged spec is a no-op.
 *  - Wording-only edits (same AC IDs) use `amend --editorial`. The spec stays approved, the change is logged, and the
 *    product owner acknowledges all amendments in batch by approving again (usually at the slice review).
 *  - Moving to implemented/verified requires pending editorial amendments to be acknowledged.
 */
import fs from 'node:fs';
import path from 'node:path';
import {
  WORKSPACE, FEATURE_ID_RE, STATUSES, APPROVED_OR_LATER, parseArgs, printHelp, loadSpecs, setFrontMatter,
  specHash, splitFrontMatter, parseFrontMatter, parseAcs, mdTable, today, workspaceMode,
} from './lib/common.mjs';

const args = parseArgs(process.argv.slice(2), ['help', 'force']);
const [cmd, id, extra] = args._;
const root = path.resolve(args.workspace ?? WORKSPACE);
const specFile = (fid) => path.join(root, 'specs', 'features', fid, 'spec.md');
const fail = (msg) => { console.error(`✖ ${msg}`); process.exit(1); };

if (args.help || !cmd) { printHelp(import.meta.url); process.exit(args.help ? 0 : 1); }

switch (cmd) {
  case 'new': cmdNew(); break;
  case 'approve': cmdApproveMany(); break;
  case 'amend': cmdAmend(); break;
  case 'status': cmdStatus(); break;
  case 'check': cmdCheck(); break;
  case 'list': cmdList(); break;
  default: fail(`unknown command "${cmd}" (try --help)`);
}

function cmdNew() {
  if (!id || !FEATURE_ID_RE.test(id) || !id.includes('-') || /-AC\d+$/.test(id)) fail('feature ID must look like AREA-NAME in upper case, e.g. AUTH-LOGIN');
  const title = extra ?? fail('missing "<title>"');
  const file = specFile(id);
  if (fs.existsSync(file)) fail(`${path.relative(root, file)} already exists`);
  const tpl = fs.readFileSync(path.join(root, 'templates', 'feature-spec.md'), 'utf8');
  let text = tpl.replaceAll('{{ID}}', id).replaceAll('{{TITLE}}', title).replaceAll('{{DATE}}', today());
  const newApp = workspaceMode(root) === 'new';
  if (newApp) text = forNewApp(text);
  const updates = {};
  if (args.priority) updates.priority = args.priority;
  if (args.wave) updates.wave = args.wave;
  if (Object.keys(updates).length) text = setFrontMatter(text, updates);
  fs.mkdirSync(path.join(path.dirname(file), 'assets', newApp ? 'design' : 'hybrid'), { recursive: true });
  fs.writeFileSync(file, text);
  console.log(`✔ created ${path.relative(root, file)} (status: draft)`);
  console.log(`  next: run the spec-feature playbook (/spec-feature ${id}) to fill it from ${newApp ? 'the product sources (analysis/sources/)' : 'hybrid evidence'}`);
}

/** New-app mode (guideline 15): evidence comes from product sources, not hybrid code. */
function forNewApp(text) {
  const swaps = [
    ['hybrid_sha:\nhybrid_refs: []\n', 'sources: []\n'],
    ['Cite hybrid evidence as `hybrid/<path>:<line>`.', 'Cite sources by their ID in analysis/sources/README.md, e.g. `prd:§3.2`, `figma:<node-id>`, `workshop:2026-10-02#D03`.'],
    ['Put screenshots in assets/hybrid/<state>.png.', 'Put design frames in assets/design/<state>.png (or link the Figma node).'],
    ['| iPad (only if the hybrid app supports it today) |', '| iPad (if the app is universal, PROJECT.md) |'],
    ['| Key / table (see analysis/data-at-rest.md) |', '| Key / table |'],
    ['_Evidence: hybrid/…:NN_', '_Evidence: <source ID>_'],
    ['_Evidence: hybrid/…_', '_Evidence: <source ID>_'],
    ["## Known hybrid issues (don't port blindly)\n\n| Issue | Evidence | Recommendation | Decision (product owner) |",
      '## Conflicts and gaps in the sources\n\n| Conflict or gap | Sources | Recommendation | Decision (product owner) |'],
  ];
  for (const [from, to] of swaps) {
    if (!text.includes(from)) fail(`templates/feature-spec.md changed: "${from.slice(0, 40)}…" not found (kit bug: record it in kit-feedback.md)`);
    text = text.replace(from, to);
  }
  return text;
}

function cmdApproveMany() {
  const by = args.by;
  if (!by || by === true) fail('pass --by "<approver name>"');
  let ids = args._.slice(1);
  if (args.slice) {
    const sliceFile = path.join(root, 'specs', 'slices', `${args.slice}.md`);
    if (!fs.existsSync(sliceFile)) fail(`no slice file ${path.relative(root, sliceFile)}`);
    ids = [...ids, ...[].concat(parseFrontMatter(splitFrontMatter(fs.readFileSync(sliceFile, 'utf8')).fm).features || [])];
  }
  if (!ids.length) fail('name one or more feature IDs, or --slice <SLICE-ID>');
  for (const fid of [...new Set(ids)]) cmdApprove(fid, by);
}

function cmdApprove(fid, by) {
  const file = specFile(fid);
  if (!fs.existsSync(file)) fail(`no spec at ${path.relative(root, file)}`);
  let text = fs.readFileSync(file, 'utf8');
  const spec = loadSpecs(root).find((x) => x.folder === fid);
  const activeAcs = () => parseAcs(splitFrontMatter(text).body, fid).filter((a) => !a.removed).map((a) => a.id).join(',');
  // Already approved and unchanged: no-op (records the AC snapshot / new hash format silently if missing)
  if (spec && APPROVED_OR_LATER.has(spec.status) && spec.approvedHash && spec.hashOk && !spec.editorialPending && !args.force) {
    if (spec.legacyApproval || !spec.approvedAcs.length) {
      fs.writeFileSync(file, setFrontMatter(text, { approved_hash: specHash(text), approved_acs: activeAcs() }));
      console.log(`✔ ${fid} already approved; recorded its AC snapshot (no change to the spec)`);
    } else console.log(`✔ ${fid} already approved and unchanged (hash ${spec.hash}); nothing to do`);
    return;
  }
  // Approved, only editorial amendments pending: this approval acknowledges them, status unchanged
  if (spec && APPROVED_OR_LATER.has(spec.status) && spec.hashOk && spec.editorialPending) {
    text = appendChangeLog(text, `Acknowledged ${spec.editorialPending} editorial amendment(s)`, by);
    fs.writeFileSync(file, setFrontMatter(text, { approved_by: `"${by}"`, approved_hash: specHash(text), approved_acs: activeAcs(), editorial_pending: 0 }));
    console.log(`✔ ${fid}: ${spec.editorialPending} editorial amendment(s) acknowledged by ${by}; status stays ${spec.status}`);
    return;
  }
  const { body } = splitFrontMatter(text);
  const openQuestions = unansweredQuestions(body);
  if (openQuestions.length && !args.force) fail(`${openQuestions.length} open question(s) without an answer:\n  - ${openQuestions.join('\n  - ')}\n  Resolve them or pass --force.`);
  if (/\{\{ID\}\}|Given …, when …, then …/.test(text.replace(/<!--[\s\S]*?-->/g, '')) && !args.force) fail('spec still contains template placeholders (pass --force to approve anyway)');
  const ff = emptyFormFactors(body);
  if (ff.length && !args.force) fail(`Form factors section incomplete (ADR-0017): no layout for ${ff.join(', ')}. Write "same as phone" if nothing changes, or pass --force.`);
  text = appendChangeLog(text, `Approved`, by);
  text = setFrontMatter(text, { status: 'approved', approved_by: `"${by}"`, approved_hash: specHash(text), approved_acs: activeAcs(), editorial_pending: 0 });
  fs.writeFileSync(file, text);
  console.log(`✔ ${fid} approved by ${by} (hash ${specHash(text)})`);
}

function cmdAmend() {
  const file = requireSpec();
  const reason = args.editorial;
  if (!reason || reason === true) fail('pass --editorial "<what changed and why>" (only wording-only amendments are supported)');
  const by = args.by;
  if (!by || by === true) fail('pass --by "<who made the edit>"');
  const spec = loadSpecs(root).find((x) => x.folder === id);
  if (!spec || !APPROVED_OR_LATER.has(spec.status) || !spec.approvedHash) fail(`${id} isn't approved; edit it freely and approve it`);
  if (spec.hashOk) fail(`${id} hasn't changed since approval; nothing to amend`);
  if (!spec.approvedAcs.length) fail(`${id} was approved before AC snapshots existed. Ask the approver to re-approve it once (spec.mjs approve ${id} --by …)`);
  const now = spec.acs.filter((a) => !a.removed).map((a) => a.id);
  const added = now.filter((a) => !spec.approvedAcs.includes(a));
  const gone = spec.approvedAcs.filter((a) => !now.includes(a));
  if (added.length || gone.length) fail(`not editorial: acceptance criteria changed (${[...added.map((a) => `+${a}`), ...gone.map((a) => `-${a}`)].join(', ')}). This needs a real approval: spec.mjs approve ${id} --by "<approver>"`);
  let text = fs.readFileSync(file, 'utf8');
  const pending = spec.editorialPending + 1;
  text = appendChangeLog(text, `Editorial: ${reason} (awaiting acknowledgement)`, by);
  fs.writeFileSync(file, setFrontMatter(text, { approved_hash: specHash(text), editorial_pending: pending }));
  console.log(`✔ ${id}: editorial amendment recorded (${pending} pending acknowledgement); status stays ${spec.status}`);
  console.log(`  the product owner acknowledges them with: node tools/spec.mjs approve ${id} --by "<name>" (or --slice <SLICE-ID>)`);
}

function cmdStatus() {
  const file = requireSpec();
  const status = extra;
  if (!STATUSES.includes(status)) fail(`status must be one of: ${STATUSES.join(', ')}`);
  const text = fs.readFileSync(file, 'utf8');
  const meta = parseFrontMatter(splitFrontMatter(text).fm);
  const spec = loadSpecs(root).find((x) => x.folder === id);
  if (status === 'approved') fail('use `spec.mjs approve <ID> --by "<name>"` to approve (it records the hash)');
  if (['in-progress', 'implemented', 'verified'].includes(status) && !args.force) {
    if (!meta.approved_hash) fail(`${id} has never been approved`);
    if (!spec.hashOk) fail(`${id} changed since approval (hash ${spec.hash} ≠ ${meta.approved_hash}). Wording only? spec.mjs amend ${id} --editorial "<reason>" --by "<who>". Otherwise re-approve.`);
    if (['implemented', 'verified'].includes(status) && spec.editorialPending) fail(`${id} has ${spec.editorialPending} editorial amendment(s) awaiting acknowledgement: spec.mjs approve ${id} --by "<product owner>"`);
  }
  fs.writeFileSync(file, setFrontMatter(text, { status }));
  console.log(`✔ ${id}: ${meta.status || 'draft'} → ${status}`);
}

function cmdCheck() {
  const specs = loadSpecs(root).filter((s) => !id || s.id === id);
  if (id && !specs.length) fail(`no spec ${id}`);
  const problems = [];
  for (const s of specs) {
    if (s.folder !== s.id) problems.push(`${s.id}: folder name "${s.folder}" ≠ id`);
    if (!STATUSES.includes(s.status)) problems.push(`${s.id}: unknown status "${s.status}"`);
    if (!APPROVED_OR_LATER.has(s.status)) {
      if (id) problems.push(`${s.id}: status ${s.status}, not approved`);
      continue;
    }
    if (!s.approvedHash) problems.push(`${s.id}: status ${s.status} but never approved`);
    else if (!s.hashOk) problems.push(`${s.id}: changed since approval (now ${s.hash}, approved ${s.approvedHash})`);
  }
  if (problems.length) { console.error(problems.map((p) => `✖ ${p}`).join('\n')); process.exit(1); }
  console.log(`✔ ${specs.length} spec(s) OK`);
}

function cmdList() {
  const specs = loadSpecs(root);
  const byId = new Map(specs.map((s) => [s.id, s]));
  const DONE = new Set(['implemented', 'verified']);
  const deps = (s) => [].concat(s.meta.depends_on || []).filter(Boolean)
    .map((d) => (DONE.has(byId.get(d)?.status) ? d : `${d} ✖${byId.has(d) ? ` (${byId.get(d).status})` : ' (no spec)'}`)).join(', ');
  const rows = specs.map((s) => [s.id, s.title, s.status, s.priority, s.wave, s.acs.filter((a) => !a.removed).length, deps(s) || '—',
    !APPROVED_OR_LATER.has(s.status) ? '—' : !s.approvedHash ? '✖ not approved' : !s.hashOk ? `✖ changed (${s.hash} ≠ ${s.approvedHash})`
      : `✔ ${s.hash}${s.editorialPending ? ` (+${s.editorialPending} editorial to acknowledge)` : ''}`]);
  process.stdout.write(mdTable(['ID', 'Title', 'Status', 'Priority', 'Wave', 'ACs', 'Depends on (✖ = not implemented)', 'Approval / hash'], rows));
}

// ---------- helpers ----------
function requireSpec() {
  if (!id) fail('missing <FEATURE-ID>');
  const file = specFile(id);
  if (!fs.existsSync(file)) fail(`no spec at ${path.relative(root, file)}`);
  return file;
}

function section(body, heading) {
  const start = body.search(new RegExp(`^## ${heading}\\s*$`, 'm'));
  if (start < 0) return null;
  const rest = body.slice(start + 3);
  const next = rest.search(/^## /m);
  return { start, end: next < 0 ? body.length : start + 3 + next, text: next < 0 ? rest : rest.slice(0, next) };
}

function unansweredQuestions(body) {
  const sec = section(body, 'Open questions');
  if (!sec) return [];
  return sec.text.split('\n')
    .filter((l) => /^\|\s*\d+\s*\|/.test(l))
    .map((l) => l.split('|').slice(1, -1).map((c) => c.trim()))
    .filter((cells) => cells[1] && !cells[3])
    .map((cells) => `#${cells[0]} ${cells[1]}`);
}

function emptyFormFactors(body) {
  const sec = section(body, 'Form factors and adaptive layout');
  if (!sec) return ['(section missing)'];
  return sec.text.replace(/<!--[\s\S]*?-->/g, '').split('\n')
    .filter((l) => /^\|/.test(l) && !/^\|\s*-/.test(l) && !/^\|\s*Form factor\s*\|/.test(l))
    .map((l) => l.split('|').slice(1, -1).map((c) => c.trim()))
    .filter((cells) => cells[0] && !cells[1])
    .map((cells) => cells[0]);
}

function appendChangeLog(text, change, by) {
  const { fm, body } = splitFrontMatter(text);
  const sec = section(body, 'Change log');
  const row = `| ${today()} | ${change} | ${by} |`;
  const newBody = sec
    ? body.slice(0, sec.end).replace(/\s*$/, '') + `\n${row}\n` + (sec.end < body.length ? '\n' + body.slice(sec.end) : '')
    : body.replace(/\s*$/, '') + `\n\n## Change log\n\n| Date | Change | By |\n|---|---|---|\n${row}\n`;
  return `---\n${fm}\n---\n${newBody}`;
}
