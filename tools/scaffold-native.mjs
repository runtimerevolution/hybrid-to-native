#!/usr/bin/env node
/**
 * scaffold-native.mjs — create the iOS and/or Android project from the kit templates (templates/native/).
 *
 * Usage (from the workspace root):
 *   node tools/scaffold-native.mjs --name "Shop" --bundle-id com.acme.shop [--platform ios|android|both]
 *        [--ident Shop] [--package com.acme.shop] [--ios-min 17.0] [--min-sdk 26]
 *        [--devices iphone|universal] [--phone-orientation all|portrait] [--simulator "iPhone 17"]
 *        [--dry-run] [--force] [--no-generate]
 *
 *   --name       display name (contracts/strings `app.name` is seeded with it if missing)
 *   --bundle-id  iOS bundle ID and Android applicationId. Migrations: must equal the shipped hybrid IDs (guideline 11)
 *   --ident      Swift/Kotlin type prefix and Xcode target name (default: --name without spaces/punctuation)
 *   --package    Kotlin package / Android namespace (default: --bundle-id). Doesn't need to equal applicationId
 *   --devices    iOS device family (default universal: ADR-0017, every screen works at any size)
 *   --phone-orientation  phones allow landscape or not (PROJECT.md § Working agreements, ADR-0017 §4; default all)
 *   --dry-run    list what would be written; --force overwrite files that already exist in ios/ or android/
 *   --no-generate  skip contracts-sync, xcodegen, the Gradle wrapper and git init
 *
 * What it does, per platform:
 *   1. refuses if ios/ or android/ already holds a project (Package.swift, *.xcodeproj, project.yml, settings.gradle*)
 *   2. copies templates/native/<platform> with the tokens filled in ({{NAME}} in files, __NAME__ in paths)
 *   3. seeds contracts/strings/en.json (app.name, common.refresh) and points contracts/sync.config.json at the
 *      Android package, then runs contracts-sync for that platform
 *   4. iOS: xcodegen generate (if installed). Android: Gradle wrapper (if `gradle` is installed), with checksum
 *   5. AGENTS.md + CLAUDE.md from templates/repo-AGENTS-<platform>.md (if missing), sync-agents-md, git init (no commit)
 *   6. writes .kit-template.json (kit version + the values used), so later template changes can be compared
 */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import os from 'node:os';
import { WORKSPACE, parseArgs, printHelp, walk, toPosix } from './lib/common.mjs';

const args = parseArgs(process.argv.slice(2), ['help', 'dry-run', 'force', 'no-generate']);
if (args.help) { printHelp(import.meta.url); process.exit(0); }
const root = path.resolve(args.workspace ?? WORKSPACE);
const fail = (m) => { console.error(`✖ ${m}`); process.exit(1); };
const say = (m) => console.log(m);
const dry = Boolean(args['dry-run']);

const GRADLE_VERSION = '9.8.0';
const SNAPSHOT_TESTING_VERSION = '1.19.6';
const ORIENT_ALL = 'UIInterfaceOrientationPortrait UIInterfaceOrientationLandscapeLeft UIInterfaceOrientationLandscapeRight';

const name = args.name && String(args.name).trim();
const bundleId = args['bundle-id'] && String(args['bundle-id']).trim();
if (!name || !bundleId) { printHelp(import.meta.url); fail('--name and --bundle-id are required'); }
if (/["\\$`{}<>]/.test(name)) fail('--name: no quotes, backslashes, $, `, braces or angle brackets (it goes into Swift, Kotlin and YAML strings)');
const ID_RE = /^[a-zA-Z][a-zA-Z0-9_]*(\.[a-zA-Z][a-zA-Z0-9_]*)+$/;
if (!ID_RE.test(bundleId)) fail(`--bundle-id ${bundleId}: use reverse-DNS with letters, digits and _ (Android applicationId rules)`);
if (/^com\.example\b|^org\.reactjs|^com\.facebook/.test(bundleId)) say(`! --bundle-id ${bundleId} looks like a placeholder. Fine for a test run, never for a store build`);
const ident = String(args.ident ?? name.replace(/[^A-Za-z0-9]+(.)?/g, (_, c) => (c ? c.toUpperCase() : '')).replace(/^[a-z]/, (c) => c.toUpperCase()));
if (!/^[A-Z][A-Za-z0-9]*$/.test(ident)) fail(`--ident ${ident}: must start with an upper-case letter, letters and digits only`);
const pkg = String(args.package ?? bundleId).toLowerCase();
if (!ID_RE.test(pkg)) fail(`--package ${pkg}: not a valid Kotlin package`);
const KOTLIN_HARD_KW = new Set(['as', 'break', 'class', 'continue', 'do', 'else', 'false', 'for', 'fun', 'if', 'in', 'interface', 'is', 'null', 'object', 'package', 'return', 'super', 'this', 'throw', 'true', 'try', 'typealias', 'typeof', 'val', 'var', 'when', 'while']);
const badSeg = pkg.split('.').find((s) => KOTLIN_HARD_KW.has(s));
if (badSeg) fail(`--package ${pkg}: "${badSeg}" is a Kotlin keyword; pass --package with another segment`);
const platforms = { ios: ['ios'], android: ['android'], both: ['ios', 'android'] }[args.platform ?? 'both'] ?? fail('--platform must be ios, android or both');
const orientation = String(args['phone-orientation'] ?? 'all');
if (!['all', 'portrait'].includes(orientation)) fail('--phone-orientation must be all or portrait');
const devices = String(args.devices ?? 'universal');
if (!['iphone', 'universal'].includes(devices)) fail('--devices must be iphone or universal');

const tokens = {
  APP_NAME: name,
  APP_IDENT: ident,
  BUNDLE_ID: bundleId,
  APPLICATION_ID: bundleId,
  PACKAGE: pkg,
  IOS_MIN: String(args['ios-min'] ?? '17.0'),
  DEVICE_FAMILY: devices === 'iphone' ? '1' : '1,2',
  IPHONE_ORIENTATIONS: orientation === 'all' ? ORIENT_ALL : 'UIInterfaceOrientationPortrait',
  SNAPSHOT_TESTING_VERSION,
  SIMULATOR: String(args.simulator ?? 'iPhone 17'),
  MIN_SDK: String(args['min-sdk'] ?? '26'),
  TARGET_SDK: '36',
  COMPILE_SDK: '37', // newest AndroidX needs it; targetSdk moves separately (behaviour changes, ADR)
};
if (!/^\d+\.\d+$/.test(tokens.IOS_MIN)) fail('--ios-min must look like 17.0');
if (!/^\d+$/.test(tokens.MIN_SDK)) fail('--min-sdk must be an API level, e.g. 26');
const pathTokens = { __APP_IDENT__: ident, __PACKAGE_PATH__: pkg.replace(/\./g, '/') };

const PROJECT_MARKERS = { ios: ['Package.swift', 'project.yml', 'Project.swift', 'Podfile'], android: ['settings.gradle', 'settings.gradle.kts', 'build.gradle', 'build.gradle.kts'] };
const kitVersion = (() => { try { return fs.readFileSync(path.join(root, 'VERSION'), 'utf8').trim(); } catch { return '?'; } })();
const results = [];

for (const platform of platforms) scaffold(platform);
if (!dry && !args['no-generate']) node(['tools/sync-agents-md.mjs']);
if (!dry) {
  say('');
  for (const r of results) say(`✔ ${r}`);
  say(`\nNext: build and run both apps (commands in each repo's AGENTS.md), record the layout-matrix references, commit them.`);
}

function scaffold(platform) {
  const tpl = path.join(root, 'templates', 'native', platform);
  if (!fs.existsSync(tpl)) fail(`templates/native/${platform} not found (kit older than 0.7.0?)`);
  const repo = path.join(root, platform);
  const existing = fs.existsSync(repo) ? fs.readdirSync(repo) : [];
  const marker = existing.find((f) => PROJECT_MARKERS[platform].includes(f) || f.endsWith('.xcodeproj') || f.endsWith('.xcworkspace'));
  if (marker && !args.force) fail(`${platform}/ already holds a project (${marker}). scaffold-native only creates new ones`);

  // 1. plan the copy
  const plan = [];
  for (const abs of walk(tpl)) {
    let rel = toPosix(path.relative(tpl, abs));
    if (path.basename(rel) === '.DS_Store') continue;
    for (const [t, v] of Object.entries(pathTokens)) rel = rel.split(t).join(v);
    plan.push({ src: abs, rel });
  }
  const clashes = plan.filter((p) => fs.existsSync(path.join(repo, p.rel))).map((p) => p.rel);
  if (clashes.length && !args.force) fail(`${platform}/ already has ${clashes.length} file(s) the template writes (${clashes.slice(0, 5).join(', ')}${clashes.length > 5 ? ', …' : ''}). Re-run with --force to overwrite them`);
  if (dry) { say(`${platform}/ (${plan.length} files):`); plan.forEach((p) => say(`  ${p.rel}${clashes.includes(p.rel) ? '  (overwrite)' : ''}`)); return; }

  // 2. copy with tokens filled in
  for (const { src, rel } of plan) {
    const dst = path.join(repo, rel);
    fs.mkdirSync(path.dirname(dst), { recursive: true });
    const buf = fs.readFileSync(src);
    if (buf.includes(0)) { fs.copyFileSync(src, dst); continue; } // binary
    let text = buf.toString('utf8').replace(/\{\{([A-Z0-9_]+)\}\}/g, (m, k) => (k in tokens ? tokens[k] : m));
    if (rel.endsWith('.kt')) text = sortKotlinImports(text); // where {{PACKAGE}} imports sort depends on the package
    const left = text.match(/\{\{[A-Z0-9_]+\}\}/);
    if (left) fail(`template token ${left[0]} in ${platform}/${rel} has no value (kit bug: record it in kit-feedback.md)`);
    fs.writeFileSync(dst, text);
    fs.chmodSync(dst, fs.statSync(src).mode);
  }
  results.push(`${platform}/: ${plan.length} files from templates/native/${platform}`);

  // 3. contracts
  seedContracts(platform);
  if (args['no-generate']) return writeStamp(platform, repo);
  node(['tools/contracts-sync.mjs', '--platform', platform]);

  // 4. platform generators
  if (platform === 'ios') {
    if (has('xcodegen')) { run('xcodegen', ['generate', '--quiet'], repo); results.push(`ios/${ident}.xcodeproj generated by XcodeGen`); }
    else say('! xcodegen not installed: brew install xcodegen, then run `xcodegen generate` in ios/');
  } else gradleWrapper(repo);

  // 5. agent instructions + git
  seedAgentsMd(platform, repo);
  if (!fs.existsSync(path.join(repo, '.git'))) { run('git', ['init', '-q', '-b', 'main'], repo); results.push(`${platform}/: git init (branch main, nothing committed)`); }
  writeStamp(platform, repo);
}

function seedContracts(platform) {
  const stringsDir = path.join(root, 'contracts', 'strings');
  const en = path.join(stringsDir, 'en.json');
  fs.mkdirSync(stringsDir, { recursive: true });
  const data = fs.existsSync(en) ? JSON.parse(fs.readFileSync(en, 'utf8')) : {};
  const nested = Object.values(data).some((v) => v && typeof v === 'object');
  const added = [];
  for (const [key, value] of [['app.name', name], ['common.refresh', 'Refresh']]) {
    if (key in data || getPath(data, key) !== undefined) continue;
    if (nested) setPath(data, key, value); else data[key] = value;
    added.push(key);
  }
  if (added.length) { fs.writeFileSync(en, JSON.stringify(data, null, 2) + '\n'); results.push(`contracts/strings/en.json: added ${added.join(', ')}`); }

  const ev = path.join(root, 'contracts', 'analytics', 'events.json');
  if (!fs.existsSync(ev)) { fs.mkdirSync(path.dirname(ev), { recursive: true }); fs.writeFileSync(ev, JSON.stringify({ events: [] }, null, 2) + '\n'); }

  if (platform !== 'android') return;
  const cfgPath = path.join(root, 'contracts', 'sync.config.json');
  const cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
  const a = (cfg.android ??= { root: 'android' }).analytics ??= {};
  const want = { to: `core/analytics/src/main/kotlin/${pkg.replace(/\./g, '/')}/core/analytics/generated/AnalyticsEvent.kt`, package: `${pkg}.core.analytics.generated` };
  const isDefault = !a.package || a.package === 'com.example.app.core.analytics.generated';
  if (isDefault && (a.to !== want.to || a.package !== want.package)) {
    Object.assign(a, want);
    fs.writeFileSync(cfgPath, JSON.stringify(cfg, null, 2) + '\n');
    results.push(`contracts/sync.config.json: Android analytics → package ${want.package}`);
  } else if (a.package !== want.package) say(`! contracts/sync.config.json android.analytics.package is ${a.package}; the template expects ${want.package}. Check it`);
}

function gradleWrapper(repo) {
  if (fs.existsSync(path.join(repo, 'gradlew')) && !args.force) return;
  if (!has('gradle')) { say(`! gradle not installed: brew install gradle, then in android/: gradle wrapper --gradle-version ${GRADLE_VERSION}`); return; }
  // Run in an empty folder: running it inside android/ would configure the whole build (and download AGP) first.
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'kit-wrapper-'));
  fs.writeFileSync(path.join(tmp, 'settings.gradle.kts'), 'rootProject.name = "wrapper"\n');
  const sum = sha256Of(`https://services.gradle.org/distributions/gradle-${GRADLE_VERSION}-bin.zip.sha256`);
  const wArgs = ['wrapper', '--gradle-version', GRADLE_VERSION, '--distribution-type', 'bin', '-q'];
  if (sum) wArgs.push('--gradle-distribution-sha256-sum', sum);
  run('gradle', wArgs, tmp);
  for (const f of ['gradlew', 'gradlew.bat', 'gradle/wrapper/gradle-wrapper.jar', 'gradle/wrapper/gradle-wrapper.properties']) {
    fs.mkdirSync(path.dirname(path.join(repo, f)), { recursive: true });
    fs.copyFileSync(path.join(tmp, f), path.join(repo, f));
  }
  fs.chmodSync(path.join(repo, 'gradlew'), 0o755);
  fs.rmSync(tmp, { recursive: true, force: true });
  results.push(`android/: Gradle wrapper ${GRADLE_VERSION}${sum ? ' (distribution checksum pinned)' : ' (no checksum: add distributionSha256Sum by hand)'}`);
}

function seedAgentsMd(platform, repo) {
  const dst = path.join(repo, 'AGENTS.md');
  if (!fs.existsSync(dst)) {
    let t = fs.readFileSync(path.join(root, 'templates', `repo-AGENTS-${platform}.md`), 'utf8');
    const fill = platform === 'ios'
      ? { '<AppName>': name, '<App>': ident, '<iPhone model>': tokens.SIMULATOR, '<bundle id>': bundleId, 'iOS <x>': `iOS ${tokens.IOS_MIN}` }
      : { '<AppName>': name, '<applicationId>': bundleId, 'minSdk <x>': `minSdk ${tokens.MIN_SDK}`, 'targetSdk <y>': `targetSdk ${tokens.TARGET_SDK}` };
    for (const [k, v] of Object.entries(fill)) t = t.split(k).join(v);
    fs.writeFileSync(dst, t);
    results.push(`${platform}/AGENTS.md seeded from templates/repo-AGENTS-${platform}.md`);
  }
  const claude = path.join(repo, 'CLAUDE.md');
  if (!fs.existsSync(claude)) fs.writeFileSync(claude, '@AGENTS.md\n');
}

function writeStamp(platform, repo) {
  const stamp = { note: 'Written by tools/scaffold-native.mjs. Compare with templates/native/ when the kit template changes', template: `native/${platform}`, kitVersion, createdAt: new Date().toISOString().slice(0, 10), values: tokens };
  fs.writeFileSync(path.join(repo, '.kit-template.json'), JSON.stringify(stamp, null, 2) + '\n');
}

// ---------- helpers ----------
/** ktlint's default import layout: `*,java.**,javax.**,kotlin.**,^` (aliases last), each group in ASCII order. */
function sortKotlinImports(text) {
  const lines = text.split('\n');
  const first = lines.findIndex((l) => l.startsWith('import '));
  if (first < 0) return text;
  let last = first;
  while (lines[last + 1]?.startsWith('import ')) last++;
  const group = (l) => { const p = l.slice(7); return / as /.test(p) ? 4 : p.startsWith('java.') ? 1 : p.startsWith('javax.') ? 2 : p.startsWith('kotlin.') ? 3 : 0; };
  const sorted = lines.slice(first, last + 1).sort((a, b) => group(a) - group(b) || (a < b ? -1 : a > b ? 1 : 0));
  lines.splice(first, sorted.length, ...sorted);
  return lines.join('\n');
}
function getPath(o, key) { return key.split('.').reduce((v, k) => (v && typeof v === 'object' ? v[k] : undefined), o); }
function setPath(o, key, value) {
  const parts = key.split('.');
  let cur = o;
  for (const p of parts.slice(0, -1)) { if (!cur[p] || typeof cur[p] !== 'object') cur[p] = {}; cur = cur[p]; }
  cur[parts.at(-1)] = value;
}
function has(cmd) { return spawnSync('which', [cmd], { stdio: 'ignore' }).status === 0; }
function run(cmd, argv, cwd) {
  const r = spawnSync(cmd, argv, { cwd, encoding: 'utf8' });
  if (r.status !== 0) fail(`${cmd} ${argv.join(' ')} failed in ${path.relative(root, cwd) || '.'}:\n${r.stdout ?? ''}${r.stderr ?? ''}`);
}
function node(argv) {
  try { const out = execFileSync('node', argv, { cwd: root, encoding: 'utf8' }); if (out.includes('!') || out.includes('✖')) process.stdout.write(out); }
  catch (e) { process.stdout.write(e.stdout ?? ''); process.stderr.write(e.stderr ?? ''); fail(`node ${argv.join(' ')} failed`); }
}
function sha256Of(url) {
  const r = spawnSync('curl', ['-fsSL', '--max-time', '20', url], { encoding: 'utf8' });
  const sum = r.status === 0 ? r.stdout.trim() : '';
  return /^[0-9a-f]{64}$/.test(sum) ? sum : null;
}
