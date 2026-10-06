#!/usr/bin/env node
/**
 * analytics-diff.mjs — compare two analytics event streams (e.g. hybrid vs iOS for the same Maestro flow).
 *
 * Usage:
 *   node tools/analytics-diff.mjs <expected.jsonl|log> <actual.jsonl|log> [--ignore ts,session_id] [--unordered] [--only a,b]
 *
 * Input: one event per line, either raw JSON or any log line containing `ANALYTICS {json}`.
 * Accepted JSON shapes: {"name": "...", "props": {...}} — also "event" for name and "properties"/"params" for props.
 * Reports missing events, extra events, and property differences on matched events. Exits 1 on any difference.
 */
import fs from 'node:fs';
import { parseArgs, printHelp } from './lib/common.mjs';

const args = parseArgs(process.argv.slice(2), ['help', 'unordered']);
if (args.help || args._.length !== 2) { printHelp(import.meta.url); process.exit(args.help ? 0 : 1); }
const ignore = new Set(String(args.ignore ?? '').split(',').filter(Boolean));
const only = args.only ? new Set(String(args.only).split(',')) : null;

const expected = read(args._[0]);
const actual = read(args._[1]);
const diffs = args.unordered ? diffUnordered(expected, actual) : diffOrdered(expected, actual);

console.log(`expected ${expected.length} event(s) · actual ${actual.length} event(s)`);
if (!diffs.length) { console.log('✔ event streams match'); process.exit(0); }
for (const d of diffs) console.log(d);
console.log(`✖ ${diffs.length} difference(s)`);
process.exit(1);

function read(file) {
  const events = [];
  fs.readFileSync(file, 'utf8').split('\n').forEach((line, i) => {
    const at = line.indexOf('ANALYTICS ');
    const json = at >= 0 ? line.slice(at + 'ANALYTICS '.length) : line.trim();
    if (!json.startsWith('{')) return;
    try {
      const o = JSON.parse(json);
      const name = o.name ?? o.event;
      if (!name || (only && !only.has(name))) return;
      const props = { ...(o.props ?? o.properties ?? o.params ?? {}) };
      for (const k of ignore) delete props[k];
      events.push({ name, props, line: i + 1 });
    } catch { /* not an event line */ }
  });
  return events;
}

function propDiff(e, a) {
  const out = [];
  for (const k of new Set([...Object.keys(e.props), ...Object.keys(a.props)])) {
    if (!(k in a.props)) out.push(`missing prop "${k}" (expected ${JSON.stringify(e.props[k])})`);
    else if (!(k in e.props)) out.push(`extra prop "${k}" = ${JSON.stringify(a.props[k])}`);
    else if (stable(e.props[k]) !== stable(a.props[k])) out.push(`prop "${k}": expected ${JSON.stringify(e.props[k])}, got ${JSON.stringify(a.props[k])}`);
  }
  return out;
}

function stable(v) {
  if (Array.isArray(v)) return `[${v.map(stable).join(',')}]`;
  if (v && typeof v === 'object') return `{${Object.keys(v).sort().map((k) => `${JSON.stringify(k)}:${stable(v[k])}`).join(',')}}`;
  return JSON.stringify(v);
}

function diffOrdered(exp, act) {
  // Longest common subsequence on event names, then compare props of aligned pairs.
  const n = exp.length, m = act.length;
  const dp = Array.from({ length: n + 1 }, () => new Uint32Array(m + 1));
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--)
    dp[i][j] = exp[i].name === act[j].name ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
  const out = [];
  let i = 0, j = 0;
  while (i < n || j < m) {
    if (i < n && j < m && exp[i].name === act[j].name) {
      for (const p of propDiff(exp[i], act[j])) out.push(`~ #${i + 1} ${exp[i].name}: ${p}  (expected line ${exp[i].line}, actual line ${act[j].line})`);
      i++; j++;
    } else if (j < m && (i === n || dp[i][j + 1] >= dp[i + 1][j])) {
      out.push(`+ extra event "${act[j].name}" ${stable(act[j].props)}  (actual line ${act[j].line})`); j++;
    } else {
      out.push(`- missing event "${exp[i].name}" ${stable(exp[i].props)}  (expected line ${exp[i].line})`); i++;
    }
  }
  return out;
}

function diffUnordered(exp, act) {
  const out = [];
  const pool = [...act];
  for (const e of exp) {
    const exact = pool.findIndex((a) => a.name === e.name && stable(a.props) === stable(e.props));
    const idx = exact >= 0 ? exact : pool.findIndex((a) => a.name === e.name);
    if (idx < 0) { out.push(`- missing event "${e.name}" ${stable(e.props)}  (expected line ${e.line})`); continue; }
    for (const p of propDiff(e, pool[idx])) out.push(`~ ${e.name}: ${p}  (expected line ${e.line}, actual line ${pool[idx].line})`);
    pool.splice(idx, 1);
  }
  for (const a of pool) out.push(`+ extra event "${a.name}" ${stable(a.props)}  (actual line ${a.line})`);
  return out;
}
