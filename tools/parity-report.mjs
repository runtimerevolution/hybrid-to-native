#!/usr/bin/env node
/**
 * parity-report.mjs — acceptance-criteria coverage across iOS, Android and shared e2e flows.
 *
 * Usage:
 *   node tools/parity-report.mjs [--feature AUTH-LOGIN] [--out parity/STATUS.md] [--json parity/status.json]
 *                                [--slice SLICE-01] [--ios ios] [--android android] [--e2e e2e] [--e2e-results e2e/results] [--strict]
 *
 * An AC marked `_Platforms: ios_` (or android) only needs a test on that platform. The report warns when such an AC's
 * spec doesn't explain the difference in its *Platform differences* section.
 *
 * Reads ACs from specs/features/<ID>/spec.md (lines like "- **AUTH-LOGIN-AC01** ...", with "Test level: ... e2e")
 * and finds AC IDs in test sources:
 *   iOS      *.swift under a path segment ending in "Tests" (e.g. Modules/Tests/..., AppUITests/...)
 *   Android  *.kt / *.java under src/<something>Test<something>/ (test, androidTest, testDebug, screenshotTest...)
 *   e2e      *.yaml / *.yml under the e2e directory (comments or tags)
 * --e2e-results <dir> reads Maestro JUnit reports named ios.xml / android.xml
 *   (maestro test --format junit --output e2e/results/<platform>.xml e2e) and shows pass/fail per platform.
 * --strict exits 1 when:
 *   - a feature with status implemented/verified has uncovered ACs, a missing e2e flow for an AC marked e2e,
 *     or a spec changed since approval;
 *   - a verified feature's e2e ACs have no passing Maestro result on each platform (needs --e2e-results);
 *   - tests reference AC IDs that no spec defines (typos). References to *removed* ACs are warnings only.
 */
import fs from 'node:fs';
import path from 'node:path';
import { WORKSPACE, AC_ID_GLOBAL, parseArgs, printHelp, loadSpecs, walk, toPosix, mdTable, sectionText, splitFrontMatter, parseFrontMatter } from './lib/common.mjs';

const args = parseArgs(process.argv.slice(2), ['help', 'strict']);
if (args.help) { printHelp(import.meta.url); process.exit(0); }
const root = path.resolve(args.workspace ?? WORKSPACE);
const dirs = {
  ios: path.resolve(root, args.ios ?? 'ios'),
  android: path.resolve(root, args.android ?? 'android'),
  e2e: path.resolve(root, args.e2e ?? 'e2e'),
};
const isTest = {
  ios: (rel) => rel.endsWith('.swift') && /(^|\/)[^/]*Tests(\/|\.swift$)/.test(rel),
  android: (rel) => /\.(kt|java)$/.test(rel) && /(^|\/)src\/[A-Za-z]*[Tt]est[A-Za-z]*\//.test(rel),
  e2e: (rel) => /\.ya?ml$/.test(rel),
};

// ---- collect AC references in test sources ----
const refs = new Map(); // acId -> { ios: [], android: [], e2e: [] }
const present = {};
for (const [platform, dir] of Object.entries(dirs)) {
  present[platform] = fs.existsSync(dir);
  if (!present[platform]) continue;
  for (const file of walk(dir)) {
    const rel = toPosix(path.relative(dir, file));
    if (!isTest[platform](rel)) continue;
    const text = fs.readFileSync(file, 'utf8');
    const lines = text.split('\n');
    lines.forEach((line, i) => {
      for (const m of line.matchAll(AC_ID_GLOBAL)) {
        if (!refs.has(m[1])) refs.set(m[1], { ios: [], android: [], e2e: [] });
        const where = `${toPosix(path.relative(root, file))}:${i + 1}`;
        const list = refs.get(m[1])[platform];
        if (!list.includes(where)) list.push(where);
      }
    });
  }
}

// ---- e2e results (Maestro JUnit) ----
const results = { ios: null, android: null };
if (args['e2e-results']) {
  for (const platform of ['ios', 'android']) {
    const file = path.resolve(root, args['e2e-results'], `${platform}.xml`);
    if (!fs.existsSync(file)) continue;
    results[platform] = new Map();
    const xml = fs.readFileSync(file, 'utf8');
    for (const m of xml.matchAll(/<testcase\b([^>]*?)(\/>|>([\s\S]*?)<\/testcase>)/g)) {
      const name = m[1].match(/\bname="([^"]*)"/)?.[1];
      if (name) results[platform].set(name, /<(failure|error)\b/.test(m[3] ?? '') ? 'fail' : 'pass');
    }
  }
}
const flowNames = (ref) => {
  const file = path.resolve(root, ref.replace(/:\d+$/, ''));
  const names = [path.basename(file).replace(/\.ya?ml$/, '')];
  const header = fs.existsSync(file) ? fs.readFileSync(file, 'utf8').split(/^---$/m)[0] : '';
  const declared = header.match(/^name:\s*["']?(.+?)["']?\s*$/m)?.[1];
  if (declared) names.push(declared);
  return names;
};
const e2eResult = (e2eRefs, platform) => {
  if (!results[platform] || !e2eRefs.length) return null;
  const outcomes = e2eRefs.map((r) => flowNames(r).map((n) => results[platform].get(n)).find(Boolean) ?? 'no result');
  return outcomes.includes('fail') ? 'fail' : outcomes.every((o) => o === 'pass') ? 'pass' : 'no result';
};

// ---- evaluate specs ----
const allSpecs = loadSpecs(root);
let sliceFeatures = null;
if (args.slice) {
  const f = path.join(root, 'specs', 'slices', `${args.slice}.md`);
  if (!fs.existsSync(f)) { console.error(`✖ no slice file ${path.relative(root, f)}`); process.exit(1); }
  sliceFeatures = [].concat(parseFrontMatter(splitFrontMatter(fs.readFileSync(f, 'utf8')).fm).features || []);
}
const specs = allSpecs.filter((s) => (!args.feature || s.id === args.feature) && (!sliceFeatures || sliceFeatures.includes(s.id)));
if (args.feature && !specs.length) { console.error(`✖ no spec ${args.feature}`); process.exit(1); }
const STRICT_STATUSES = new Set(['implemented', 'verified']);
const features = specs.map((s) => {
  const active = s.acs.filter((a) => !a.removed);
  const needs = { ios: s.platforms.includes('ios'), android: s.platforms.includes('android') };
  const row = { id: s.id, title: s.title, status: s.status, priority: s.priority, wave: s.wave, hashOk: s.hashOk, approved: !!s.approvedHash, acs: [] };
  row.warnings = [];
  for (const ac of active) {
    const r = refs.get(ac.id) ?? { ios: [], android: [], e2e: [] };
    const acNeeds = ac.platforms.length ? { ios: needs.ios && ac.platforms.includes('ios'), android: needs.android && ac.platforms.includes('android') } : needs;
    row.acs.push({
      id: ac.id, levels: ac.levels, scoped: ac.platforms.length ? ac.platforms.join('+') : null,
      ios: acNeeds.ios ? r.ios : null, android: acNeeds.android ? r.android : null,
      e2e: r.e2e, e2eRequired: ac.levels.includes('e2e'), manual: ac.levels.includes('manual'),
      e2eIos: acNeeds.ios ? e2eResult(r.e2e, 'ios') : null, e2eAndroid: acNeeds.android ? e2eResult(r.e2e, 'android') : null,
    });
  }
  const scoped = row.acs.filter((a) => a.scoped);
  if (scoped.length) {
    const diff = (sectionText(splitFrontMatter(s.text).body, 'Platform differences') ?? '').replace(/<!--[\s\S]*?-->/g, '').trim();
    if (!diff || /^(none|n\/a|-)\.?$/i.test(diff)) row.warnings.push(`${scoped.map((a) => a.id).join(', ')} apply to one platform only, but *Platform differences* doesn't explain why`);
  }
  const gap = (a, p) => a[p] !== null && a[p].length === 0 && !a.manual;
  row.missing = {
    ios: row.acs.filter((a) => gap(a, 'ios')).map((a) => a.id),
    android: row.acs.filter((a) => gap(a, 'android')).map((a) => a.id),
    e2e: row.acs.filter((a) => a.e2eRequired && a.e2e.length === 0).map((a) => a.id),
  };
  row.total = { ios: row.acs.filter((a) => a.ios !== null).length, android: row.acs.filter((a) => a.android !== null).length };
  row.covered = {
    ios: needs.ios ? row.total.ios - row.missing.ios.length : null,
    android: needs.android ? row.total.android - row.missing.android.length : null,
    e2e: row.acs.filter((a) => a.e2eRequired).length - row.missing.e2e.length,
    e2eRequired: row.acs.filter((a) => a.e2eRequired).length,
  };
  row.strictProblems = [];
  if (STRICT_STATUSES.has(s.status)) {
    if (row.missing.ios.length) row.strictProblems.push(`iOS missing ${row.missing.ios.join(', ')}`);
    if (row.missing.android.length) row.strictProblems.push(`Android missing ${row.missing.android.join(', ')}`);
    if (row.missing.e2e.length) row.strictProblems.push(`e2e missing ${row.missing.e2e.join(', ')}`);
    if (!s.approvedHash) row.strictProblems.push('never approved');
    else if (!s.hashOk) row.strictProblems.push('spec changed since approval');
  }
  if (s.status === 'verified') {
    for (const p of ['ios', 'android'].filter((x) => needs[x])) {
      if (!results[p]) { row.strictProblems.push(`no ${p} e2e results (pass --e2e-results)`); continue; }
      const notPassing = row.acs.filter((a) => a.e2eRequired && a[p === 'ios' ? 'e2eIos' : 'e2eAndroid'] !== 'pass').map((a) => a.id);
      if (notPassing.length) row.strictProblems.push(`${p} e2e not passing: ${notPassing.join(', ')}`);
    }
  }
  return row;
});

// ---- orphans: AC IDs in tests that no spec defines (or that were removed) ----
const defined = new Map();
for (const s of allSpecs) for (const a of s.acs) defined.set(a.id, a.removed ? 'removed' : 'active');
const orphans = [...refs.entries()]
  .filter(([ac]) => defined.get(ac) !== 'active')
  .map(([ac, r]) => ({ id: ac, removed: defined.get(ac) === 'removed', reason: defined.get(ac) === 'removed' ? 'AC was removed from spec (warning: delete or update the test)' : 'no spec defines it', where: [...r.ios, ...r.android, ...r.e2e] }));
const unknownRefs = orphans.filter((o) => !o.removed);

// ---- output ----
const pct = (n, d) => (d ? `${Math.round((100 * n) / d)}%` : '—');
const cell = (covered, total) => (covered === null ? 'n/a' : `${covered}/${total}${covered === total ? ' ✔' : ''}`);
const byStatus = {};
for (const f of features) byStatus[f.status] = (byStatus[f.status] ?? 0) + 1;
const totals = features.reduce((t, f) => {
  t.acs += f.acs.length;
  t.ios += f.covered.ios ?? 0; t.iosTotal += f.covered.ios === null ? 0 : f.total.ios;
  t.android += f.covered.android ?? 0; t.androidTotal += f.covered.android === null ? 0 : f.total.android;
  t.e2e += f.covered.e2e; t.e2eTotal += f.covered.e2eRequired;
  return t;
}, { acs: 0, ios: 0, iosTotal: 0, android: 0, androidTotal: 0, e2e: 0, e2eTotal: 0 });

let md = `# Parity status\n\n> Generated by \`tools/parity-report.mjs\` on ${new Date().toISOString()}. **Do not edit.**\n`;
md += `> Repos scanned: iOS ${present.ios ? '✔' : '✖ (not found)'} · Android ${present.android ? '✔' : '✖ (not found)'} · e2e ${present.e2e ? '✔' : '✖ (not found)'}`;
md += ` · e2e results: iOS ${results.ios ? '✔' : '—'} · Android ${results.android ? '✔' : '—'}\n\n`;
md += `**Features:** ${features.length} (${Object.entries(byStatus).map(([k, v]) => `${k} ${v}`).join(', ') || 'none'})  \n`;
md += `**AC coverage:** iOS ${totals.ios}/${totals.iosTotal} (${pct(totals.ios, totals.iosTotal)}) · Android ${totals.android}/${totals.androidTotal} (${pct(totals.android, totals.androidTotal)}) · e2e ${totals.e2e}/${totals.e2eTotal} (${pct(totals.e2e, totals.e2eTotal)})\n\n`;
md += mdTable(['Feature', 'Title', 'Status', 'Pri', 'Wave', 'ACs', 'iOS', 'Android', 'e2e', 'Spec'],
  features.map((f) => [f.id, f.title, f.status, f.priority, f.wave, f.acs.length, cell(f.covered.ios, f.total.ios), cell(f.covered.android, f.total.android),
    f.covered.e2eRequired ? cell(f.covered.e2e, f.covered.e2eRequired) : '—', !f.approved ? 'not approved' : f.hashOk ? 'approved ✔' : '✖ changed']));

const gaps = features.filter((f) => f.missing.ios.length || f.missing.android.length || f.missing.e2e.length);
if (gaps.length) {
  md += `\n## Gaps\n\n`;
  for (const f of gaps) {
    md += `### ${f.id} (${f.status})\n\n`;
    if (f.missing.ios.length) md += `- **iOS:** ${f.missing.ios.join(', ')}\n`;
    if (f.missing.android.length) md += `- **Android:** ${f.missing.android.join(', ')}\n`;
    if (f.missing.e2e.length) md += `- **e2e:** ${f.missing.e2e.join(', ')}\n`;
    md += '\n';
  }
}
if (args.feature) {
  md += `\n## ${args.feature}: AC detail\n\n`;
  const res = (v) => (v === null ? '—' : v === 'pass' ? '✔ pass' : v === 'fail' ? '✖ fail' : '? no result');
  md += mdTable(['AC', 'Levels', 'iOS tests', 'Android tests', 'e2e flows', 'e2e iOS', 'e2e Android'], features[0].acs.map((a) => [
    a.id, a.levels.join(', '), a.ios === null ? 'n/a' : a.ios.join('<br>') || '✖', a.android === null ? 'n/a' : a.android.join('<br>') || '✖',
    a.e2e.join('<br>') || (a.e2eRequired ? '✖' : '—'), res(a.e2eIos), res(a.e2eAndroid)]));
}
if (orphans.length) {
  md += `\n## Orphan AC references\n\nTests reference these IDs but no spec defines them as active. Unknown IDs fail \`--strict\` (fix the typo). Removed ACs are warnings (update the tests in the next change).\n\n`;
  md += mdTable(['AC', 'Reason', 'Where'], orphans.map((o) => [o.id, o.reason, o.where.slice(0, 3).join(', ')]));
}
const warned = features.filter((f) => f.warnings.length);
if (warned.length) {
  md += `\n## Warnings\n\n`;
  for (const f of warned) md += f.warnings.map((w) => `- **${f.id}**: ${w}\n`).join('');
}
const strictFailures = features.filter((f) => f.strictProblems.length);
if (strictFailures.length) {
  md += `\n## Blocking problems (implemented / verified features)\n\n`;
  for (const f of strictFailures) md += `- **${f.id}**: ${f.strictProblems.join('; ')}\n`;
}

if (args.out) { fs.mkdirSync(path.dirname(path.resolve(root, args.out)), { recursive: true }); fs.writeFileSync(path.resolve(root, args.out), md); console.log(`✔ wrote ${args.out}`); }
else process.stdout.write(md);
if (args.json) {
  fs.mkdirSync(path.dirname(path.resolve(root, args.json)), { recursive: true });
  fs.writeFileSync(path.resolve(root, args.json), JSON.stringify({ generatedAt: new Date().toISOString(), totals, features, orphans }, null, 2));
}
if (args.strict && (strictFailures.length || unknownRefs.length)) {
  console.error(`✖ parity check failed: ${strictFailures.length} feature(s) with blocking problems, ${unknownRefs.length} unknown AC reference(s)`);
  process.exit(1);
}
