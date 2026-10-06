#!/usr/bin/env node
/**
 * rn-inventory.mjs — discovery scan of a React Native / Expo codebase.
 *
 * Usage:
 *   node tools/rn-inventory.mjs [--root <app dir>] [--out analysis/inventory] [--max 40] [--include pkgA,pkgB]
 *   node tools/rn-inventory.mjs --find-apps [--repo hybrid] [--json]   # monorepos: list RN apps, backends, web apps
 *   node tools/rn-inventory.mjs --find-apps --branches [--max-branches 15]  # RN apps + versions on each branch (no checkout)
 *   node tools/rn-inventory.mjs --set-app hybrid/apps/mobile [--set-backend hybrid/api] [--set-web hybrid/apps/web]
 *   node tools/rn-inventory.mjs --print-map        # library map as markdown (for guidelines/09)
 *
 * The app folder defaults to `hybrid.app` in workspace.config.json (else `hybrid/`). In monorepos the scan also follows
 * the app's local workspace packages (workspace:/file:/link: deps, or names of packages in the repo) and looks up
 * dependencies in hoisted node_modules folders up to the repo root.
 * Writes <out>/inventory.json (everything) and <out>/INVENTORY.md (summary).
 * Regex heuristics only: every result is a lead with a file:line reference to verify, not ground truth.
 * Node 18+, no dependencies.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const MAP_PATH = path.join(HERE, 'data', 'rn-library-map.json');

const SKIP_DIRS = new Set([
  'node_modules', '.git', '.expo', '.expo-shared', 'build', 'dist', 'web-build', 'coverage', 'Pods',
  'DerivedData', '.gradle', '.idea', '.vscode', '.next', 'vendor', '.yarn', '.turbo', '.cache', '.cxx',
]);
const JS_EXT = /\.(jsx?|tsx?|mjs|cjs)$/;
const IGNORED_DEPS = /^(react|react-native|react-dom|expo|typescript|expo-modules-core|expo-dev-launcher|expo-dev-menu|@babel\/.*|@types\/.*|babel-.*|eslint.*|@typescript-eslint\/.*|prettier|metro.*|@react-native\/.*|@react-native-community\/cli.*|@expo\/(?!vector-icons).*|@tsconfig\/.*|husky|lint-staged|react-test-renderer)$/;
const FEATURE_DIR_NAMES = /^(features|modules|screens|domains|pages|flows|views|scenes|containers)$/i;
const MAX_FILE_BYTES = 1_000_000;
const WEB_DEPS = ['next', 'vite', 'react-scripts', '@angular/core', 'vue', 'nuxt', 'svelte', '@sveltejs/kit', '@remix-run/react', 'astro', 'gatsby'];
const BACKEND_DEPS = ['express', 'fastify', '@nestjs/core', 'koa', 'hono', '@hapi/hapi', '@apollo/server', 'apollo-server', 'graphql-yoga', 'restify', '@adonisjs/core'];

// ---------- cli ----------
const args = parseArgs(process.argv.slice(2), ['help', 'print-map', 'find-apps', 'json', 'branches']);
if (args.help) {
  console.log(fs.readFileSync(fileURLToPath(import.meta.url), 'utf8').split('*/')[0]);
  process.exit(0);
}
const libraryMap = readJson(MAP_PATH)?.entries ?? [];
if (args['print-map']) {
  process.stdout.write(renderMap(libraryMap));
  process.exit(0);
}

const WS = path.resolve(HERE, '..');
const CONFIG_PATH = path.join(WS, 'workspace.config.json');
const hy = readJson(CONFIG_PATH)?.hybrid ?? {};
const fromWs = (p) => path.resolve(WS, p);
const repoRoot = args.repo ? path.resolve(args.repo) : fromWs(hy.repo ?? 'hybrid');

if (args['find-apps']) { args.branches ? findAppsOnBranches(repoRoot) : findApps(repoRoot); process.exit(0); }
if (['set-app', 'set-backend', 'set-web', 'set-shared'].some((k) => args[k])) { setConfig(); process.exit(0); }

const root = args.root ? path.resolve(args.root) : fromWs(hy.app ?? hy.repo ?? 'hybrid');
const outDir = path.resolve(args.out ?? 'analysis/inventory');
const MAX = Number(args.max ?? 40);
const rootPkg = readJson(path.join(root, 'package.json'));
if (!rootPkg) {
  console.error(`No package.json in ${root}.\nIf the React Native app lives in a subfolder (monorepo), run: node tools/rn-inventory.mjs --find-apps`);
  process.exit(1);
}
if (!['react-native', 'expo'].some((d) => d in { ...rootPkg.dependencies, ...rootPkg.devDependencies })) {
  console.error(`${path.relative(process.cwd(), root) || '.'} doesn't depend on react-native or expo, so it isn't the mobile app.\nFind it with: node tools/rn-inventory.mjs --find-apps   then save it with: --set-app <path>`);
  process.exit(1);
}
const extraRoots = [...String(args.include ?? '').split(',').filter(Boolean).map((p) => path.resolve(p)), ...(hy.sharedPackages ?? []).map(fromWs)];

const inv = scan(root, { repoRoot: isInside(root, repoRoot) ? repoRoot : root, extraRoots, layout: { backend: hy.backend ?? [], web: hy.web ?? [] } });
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'inventory.json'), JSON.stringify(inv, null, 2));
fs.writeFileSync(path.join(outDir, 'INVENTORY.md'), renderMarkdown(inv));
console.log(`Inventory written to ${path.relative(process.cwd(), outDir) || '.'}/{inventory.json,INVENTORY.md}`);
console.log(`  flavour: ${inv.project.flavour} · routes: ${inv.navigation.routes.length} · screens: ${inv.navigation.screens.length} · deps: ${inv.dependencies.length} · native modules: ${inv.nativeCode.modules.length} · risks: ${inv.risks.length}`);

// ---------- scan ----------
function scan(rootDir, opts = {}) {
  const repo = opts.repoRoot ?? rootDir;
  const rel = (p) => path.relative(process.cwd(), p).split(path.sep).join('/');
  const pkg = readJson(path.join(rootDir, 'package.json')) ?? {};
  const deps = { ...(pkg.dependencies ?? {}) };
  const devDeps = { ...(pkg.devDependencies ?? {}) };
  const iosDir = path.join(rootDir, 'ios');
  const androidDir = path.join(rootDir, 'android');
  const hasIos = fs.existsSync(iosDir);
  const hasAndroid = fs.existsSync(androidDir);

  // ---- monorepo: local packages the app depends on (followed transitively) ----
  const localByName = repo !== rootDir ? findLocalPackages(repo) : new Map();
  const included = new Map(); // dir -> { name, via }
  const unresolvedLocal = [];
  const follow = (p, dir, via) => {
    for (const [name, version] of Object.entries({ ...(p.dependencies ?? {}), ...(p.devDependencies ?? {}) })) {
      const v = String(version);
      let target = localByName.get(name) ?? null;
      if (!target && /^(file|link|portal):/.test(v)) target = path.resolve(dir, v.replace(/^(file|link|portal):/, ''));
      if (!target && /^workspace:/.test(v)) { unresolvedLocal.push(name); continue; }
      if (!target || target === rootDir || included.has(target) || !fs.existsSync(path.join(target, 'package.json'))) continue;
      included.set(target, { name, via });
      follow(readJson(path.join(target, 'package.json')) ?? {}, target, name);
    }
  };
  follow(pkg, rootDir, pkg.name ?? 'app');
  for (const extra of opts.extraRoots ?? []) {
    if (!included.has(extra) && fs.existsSync(extra)) included.set(extra, { name: readJson(path.join(extra, 'package.json'))?.name ?? path.basename(extra), via: 'workspace.config.json' });
  }
  const units = [{ root: rootDir, label: null }, ...[...included].map(([dir, v]) => ({ root: dir, label: v.name }))];
  const unitOf = (f) => units.filter((u) => isInside(f, u.root)).sort((a, b) => b.root.length - a.root.length)[0] ?? units[0];
  const relRoot = (p) => path.relative(unitOf(p).root, p).split(path.sep).join('/');
  const labelOf = (p) => unitOf(p).label;
  // merged dependencies (app first, then local packages), for classification and risk checks
  const via = {};
  for (const [dir, info] of included) {
    const lp = readJson(path.join(dir, 'package.json')) ?? {};
    for (const [n, v] of Object.entries(lp.dependencies ?? {})) if (!(n in deps) && !(n in devDeps) && !localByName.has(n)) { deps[n] = v; via[n] = info.name; }
  }
  for (const n of Object.keys(deps)) if (localByName.has(n) || /^(workspace|file|link|portal):/.test(String(deps[n]))) delete deps[n];
  const has = (name) => name in deps || name in devDeps;

  const allFiles = [...new Set(units.flatMap((u) => [...walk(u.root)]))];
  const underNative = (f) => f.startsWith(iosDir + path.sep) || f.startsWith(androidDir + path.sep);
  const isTestFile = (f) => /(__tests__|__mocks__|\/e2e\/|\.test\.|\.spec\.)/.test(f.split(path.sep).join('/'));
  const jsFiles = allFiles.filter((f) => JS_EXT.test(f) && !underNative(f) && !/\.d\.ts$/.test(f));
  const skipped = [];
  const srcFiles = jsFiles.filter((f) => {
    const r = relRoot(f);
    if (isTestFile(f) || /(^|\/)(babel|metro|jest|eslint|prettier|tailwind|app)\.config\.|\.eslintrc/.test(r)) return false;
    if (/(^|\/)(assets|public|static|vendor)\//.test(r) || /\.min\.(js|cjs|mjs)$/.test(r)) { skipped.push({ file: rel(f), reason: 'asset / vendored code' }); return false; }
    return true;
  });
  const testFiles = jsFiles.filter(isTestFile);

  // ---- project / config ----
  const expoVersion = deps.expo ?? null;
  const expoRouter = has('expo-router');
  const project = {
    name: pkg.name ?? null,
    version: pkg.version ?? null,
    reactNative: deps['react-native'] ?? null,
    expo: expoVersion,
    expoRouter,
    reactNavigation: Object.keys(deps).filter((d) => d.startsWith('@react-navigation/')),
    nativeProjectsCommitted: { ios: hasIos, android: hasAndroid },
    flavour: expoVersion
      ? (hasIos || hasAndroid ? 'expo (native folders committed / prebuild)' : 'expo managed (CNG — run expo prebuild in a scratch copy to see native config)')
      : 'bare react-native',
    scripts: pkg.scripts ?? {},
  };

  const appConfig = readAppConfig(rootDir, rel);
  const eas = readEas(rootDir);
  const native = { ios: hasIos ? readIosNative(iosDir, allFiles, rel) : null, android: hasAndroid ? readAndroidNative(androidDir, allFiles, rel) : null };

  // ---- dependencies ----
  // node_modules may be hoisted: look from the app (and each local package) up to the repo root
  const nmDirs = [];
  for (const start of [rootDir, ...included.keys()]) {
    for (let d = start; isInside(d, repo); d = path.dirname(d)) { const nm = path.join(d, 'node_modules'); if (!nmDirs.includes(nm) && fs.existsSync(nm)) nmDirs.push(nm); if (d === repo) break; }
  }
  const locked = readLockfile(rootDir, repo);
  const dependencies = [];
  for (const [name, version] of Object.entries(deps)) {
    const m = classify(name);
    if (!m && IGNORED_DEPS.test(name)) continue;
    dependencies.push({ name, version, locked: locked.versions.get(name) ?? null, dev: false, mapped: !!m, ...(via[name] ? { via: via[name] } : {}), ...(m ? { category: m.category, risk: m.risk, ios: m.ios, android: m.android, notes: m.notes } : { category: 'unmapped' }), hasNativeCode: nativeCodeFlag(nmDirs, name) });
  }
  for (const [name, version] of Object.entries(devDeps)) {
    const m = classify(name);
    if (m) dependencies.push({ name, version, locked: locked.versions.get(name) ?? null, dev: true, mapped: true, category: m.category, risk: m.risk, ios: m.ios, android: m.android, notes: m.notes, hasNativeCode: nativeCodeFlag(nmDirs, name) });
  }
  const riskOrder = { high: 0, medium: 1, low: 2, undefined: 3 };
  dependencies.sort((a, b) => (riskOrder[a.risk] - riskOrder[b.risk]) || a.category.localeCompare(b.category) || a.name.localeCompare(b.name));

  // ---- JS source extraction ----
  const found = {
    navigators: [], screens: [], linkingPrefixes: [], staticNavigation: [], routerCalls: [],
    platformBranches: [], storage: [], api: [], baseUrls: [], graphql: [], rtkEndpoints: [],
    analytics: [], testIDs: [], i18nKeys: [], env: [], flags: [], webviews: [], openUrls: [],
    permissions: [], appState: [], deepLinkHandlers: [], a11y: { labels: 0, roles: 0, hints: 0 },
  };
  const platformFiles = [];
  const screenFiles = [];

  for (const file of srcFiles) {
    const text = readText(file);
    if (text == null) continue;
    if (text.length > 5000 && text.split('\n').length < text.length / 400) { skipped.push({ file: rel(file), reason: 'minified' }); continue; }
    const idx = lineIndex(text);
    const ref = (pos) => `${rel(file)}:${lineAt(idx, pos)}`;
    const r = relRoot(file);

    if (/\.(ios|android|native|web)\.(jsx?|tsx?)$/.test(r)) platformFiles.push(rel(file));
    if (/Screen\.(jsx?|tsx?)$/.test(r) || /(^|\/)screens?\//i.test(r)) screenFiles.push(rel(file));

    each(text, /\bcreate(NativeStack|Stack|BottomTab|Drawer|MaterialTopTab|MaterialBottomTab)Navigator\s*\(/g, (m) =>
      found.navigators.push({ value: m[1], ref: ref(m.index) }));
    each(text, /<(\w+)\.Screen\b/g, (m) => {
      const window = text.slice(m.index, m.index + 700).split(/\.Screen\b/).slice(0, 2).join('.Screen');
      const name = window.match(/\bname\s*=\s*\{?\s*(["'`])([^"'`]+)\1/);
      const comp = window.match(/\bcomponent\s*=\s*\{\s*([\w.]+)\s*\}/);
      found.screens.push({ value: name ? name[2] : '<dynamic>', navigator: m[1], component: comp ? comp[1] : null, ref: ref(m.index) });
    });
    if (/createStaticNavigation/.test(text)) found.staticNavigation.push({ value: 'createStaticNavigation', ref: ref(text.indexOf('createStaticNavigation')) });
    each(text, /prefixes\s*:\s*\[([^\]]*)\]/g, (m) => {
      for (const s of m[1].matchAll(/(["'`])([^"'`]+)\1/g)) found.linkingPrefixes.push({ value: s[2], ref: ref(m.index) });
    });
    each(text, /\b(?:router|navigation)\.(push|navigate|replace|reset|dispatch)\(\s*(["'`])([^"'`]+)\2/g, (m) =>
      found.routerCalls.push({ value: m[3], method: m[1], ref: ref(m.index) }));
    each(text, /Platform\.OS\s*(?:===|==|!==|!=)\s*["'](ios|android|web)["']|Platform\.select\s*\(/g, (m) =>
      found.platformBranches.push({ value: m[1] ? `Platform.OS ${m[1]}` : 'Platform.select', ref: ref(m.index) }));

    // storage
    each(text, /\bAsyncStorage\.(setItem|getItem|removeItem|mergeItem|multiGet|multiSet|multiRemove|clear)\(\s*([^,)]*)/g, (m) =>
      found.storage.push({ library: 'AsyncStorage', op: m[1], ...keyOf(m[2]), ref: ref(m.index) }));
    each(text, /\bSecureStore\.(setItemAsync|getItemAsync|deleteItemAsync|setItem|getItem)\(\s*([^,)]*)/g, (m) =>
      found.storage.push({ library: 'expo-secure-store', op: m[1], ...keyOf(m[2]), ref: ref(m.index) }));
    each(text, /\bKeychain\.(setGenericPassword|getGenericPassword|resetGenericPassword|setInternetCredentials|getInternetCredentials|resetInternetCredentials)\(([^)]*)\)/g, (m) => {
      const service = m[2].match(/service\s*:\s*([^,}]+)/);
      found.storage.push({ library: 'react-native-keychain', op: m[1], ...(service ? keyOf(service[1]) : { key: '<default service>', literal: true }), ref: ref(m.index) });
    });
    if (/mmkv/i.test(text)) {
      each(text, /\b(?:new\s+MMKV|createMMKV)\(\s*(\{[^}]*\})?\s*\)/g, (m) =>
        found.storage.push({ library: 'react-native-mmkv', op: 'instance', key: (m[1] ?? '{default}').replace(/\s+/g, ' '), literal: true, ref: ref(m.index) }));
      each(text, /\.(set|getString|getNumber|getBoolean|getBuffer|delete|remove)\(\s*(["'`][^"'`]+["'`]|[A-Z_][\w.]*)/g, (m) =>
        found.storage.push({ library: 'react-native-mmkv', op: m[1], ...keyOf(m[2]), ref: ref(m.index) }));
    }
    if (/persistReducer|persistStore|persistConfig/.test(text)) each(text, /\bkey\s*:\s*(["'`])([^"'`]+)\1/g, (m) =>
      found.storage.push({ library: 'redux-persist', op: 'persistConfig', key: m[2], literal: true, ref: ref(m.index) }));
    if (/zustand\/middleware/.test(text) && /\bpersist\s*\(/.test(text)) each(text, /\bname\s*:\s*(["'`])([^"'`]+)\1/g, (m) =>
      found.storage.push({ library: 'zustand persist', op: 'persist', key: m[2], literal: true, ref: ref(m.index) }));
    each(text, /\bopenDatabase(?:Sync|Async)?\(\s*([^,)]*)/g, (m) =>
      found.storage.push({ library: 'sqlite', op: 'openDatabase', ...keyOf(m[1]), ref: ref(m.index) }));
    each(text, /\bFileSystem\.(documentDirectory|cacheDirectory)|\bPaths\.(document|cache)\b|\bRNFS\.(DocumentDirectoryPath|CachesDirectoryPath)/g, (m) =>
      found.storage.push({ library: 'files', op: 'path', key: m[0], literal: true, ref: ref(m.index) }));

    // networking
    each(text, /\b(fetch|axios(?:\.(?:get|post|put|patch|delete|request))?|(?:api|client|http|request|instance|apiClient|httpClient|axiosInstance)\.(?:get|post|put|patch|delete))\(\s*(["'`])([^"'`]*)\2/g, (m) => {
      if (m[3].length > 0) found.api.push({ value: m[3], call: m[1], ref: ref(m.index) });
    });
    each(text, /\bbaseURL\s*:\s*([^,\n}]+)/g, (m) => found.baseUrls.push({ value: m[1].trim(), ref: ref(m.index) }));
    if (/\bgql\b|graphql/.test(text)) each(text, /\b(query|mutation|subscription)\s+([A-Za-z_]\w*)\s*[({]/g, (m) =>
      found.graphql.push({ value: `${m[1]} ${m[2]}`, ref: ref(m.index) }));
    if (/createApi\s*\(/.test(text)) each(text, /(\w+)\s*:\s*(?:build|builder)\.(query|mutation)\b/g, (m) =>
      found.rtkEndpoints.push({ value: m[1], kind: m[2], ref: ref(m.index) }));

    // product surface
    each(text, /\b(logEvent|trackEvent|track|logCustomEvent|capture|recordEvent|logScreenView)\(\s*(["'`])([^"'`]+)\2/g, (m) =>
      found.analytics.push({ value: m[3], call: m[1], ref: ref(m.index) }));
    each(text, /\btestID\s*=\s*\{?\s*(["'`])([^"'`]+)\1/g, (m) => found.testIDs.push({ value: m[2], ref: ref(m.index) }));
    each(text, /(?:\bi18n\.|\b)t\(\s*(["'`])([\w.:\-]+)\1/g, (m) => found.i18nKeys.push({ value: m[2], ref: ref(m.index) }));
    each(text, /import\s*\{([^}]+)\}\s*from\s*['"]@env['"]/g, (m) => {
      for (const n of m[1].split(',').map((x) => x.trim().split(/\s+as\s+/)[0]).filter(Boolean)) found.env.push({ value: `${n} (@env)`, ref: ref(m.index) });
    });
    each(text, /\bprocess\.env\.([A-Z0-9_]+)|\bConfig\.([A-Z][A-Z0-9_]+)|(?:expoConfig|manifest2?)\??\.extra\??\.(\w+)/g, (m) =>
      found.env.push({ value: m[1] ?? m[2] ?? `extra.${m[3]}`, ref: ref(m.index) }));
    each(text, /\b(useFeatureFlag|useFlag|useGate|checkGate|getFeatureFlag|isFeatureEnabled|getValue|variation|boolVariation|getBoolean)\(\s*(["'`])([^"'`]+)\2/g, (m) => {
      if (!/mmkv/i.test(text) || m[1] !== 'getBoolean') found.flags.push({ value: m[3], call: m[1], ref: ref(m.index) });
    });
    each(text, /<WebView\b/g, (m) => {
      const src = text.slice(m.index, m.index + 400).match(/uri\s*:\s*([^}\n]+)/);
      found.webviews.push({ value: src ? src[1].trim() : '<source not literal>', ref: ref(m.index) });
    });
    each(text, /\bLinking\.openURL\(\s*([^)]*)\)/g, (m) => found.openUrls.push({ value: m[1].trim().slice(0, 120), ref: ref(m.index) }));
    each(text, /\b(request\w*Permissions?(?:Async)?)\(|\b(?:check|request)\(\s*PERMISSIONS\.(IOS|ANDROID)\.(\w+)/g, (m) =>
      found.permissions.push({ value: m[1] ?? `${m[2]}.${m[3]}`, ref: ref(m.index) }));
    each(text, /\bAppState\.addEventListener\(/g, (m) => found.appState.push({ value: 'AppState listener', ref: ref(m.index) }));
    each(text, /\bLinking\.(addEventListener|getInitialURL)\b|\buseURL\(|\buseLinkingURL\(|\bgetExpoPushTokenAsync\b|\bgetDevicePushTokenAsync\b/g, (m) =>
      found.deepLinkHandlers.push({ value: m[0].replace(/\($/, ''), ref: ref(m.index) }));
    found.a11y.labels += count(text, /\baccessibilityLabel\s*=/g);
    found.a11y.roles += count(text, /\baccessibilityRole\s*=/g);
    found.a11y.hints += count(text, /\baccessibilityHint\s*=/g);
  }

  // ---- expo-router file routes ----
  const routes = [];
  if (expoRouter) {
    const appDir = ['app', 'src/app'].map((d) => path.join(rootDir, d)).find((d) => fs.existsSync(d));
    if (appDir) {
      for (const f of jsFiles.filter((x) => x.startsWith(appDir + path.sep))) {
        const route = expoRoute(path.relative(appDir, f).split(path.sep).join('/'));
        if (route.kind !== 'api') routes.push({ ...route, file: rel(f) });
      }
      routes.sort((a, b) => a.path.localeCompare(b.path) || a.kind.localeCompare(b.kind));
    }
  }

  // ---- locales ----
  const locales = [];
  for (const f of allFiles.filter((x) => x.endsWith('.json') && !underNative(x))) {
    const r = relRoot(f);
    if (!/(^|\/)(locales?|i18n|translations?|lang|langs|strings)(\/|$)/i.test(path.dirname(r))) continue;
    const data = readJson(f);
    if (!data || typeof data !== 'object') continue;
    const keys = flattenKeys(data);
    const base = path.basename(f, '.json');
    const parent = path.basename(path.dirname(f));
    const isLocale = (s) => /^[a-z]{2,3}([-_][A-Za-z]{2,4})?$/.test(s);
    locales.push({ file: rel(f), locale: isLocale(base) ? base : isLocale(parent) ? parent : base, namespace: isLocale(base) ? null : base, keys: keys.length, plurals: keys.filter((k) => /_(zero|one|two|few|many|other)$/.test(k)).length, interpolations: countInterpolations(data) });
  }

  // ---- native code ----
  const nativeModules = [];
  const expoModuleConfigs = [];
  for (const f of allFiles) {
    const r = relRoot(f);
    if (path.basename(f) === 'expo-module.config.json') { expoModuleConfigs.push(rel(f)); continue; }
    if (!/\.(m|mm|swift|h|java|kt)$/.test(f)) continue;
    const text = readText(f);
    if (text == null) continue;
    const idx = lineIndex(text);
    const patterns = [
      [/RCT_EXPORT_MODULE|RCT_EXTERN_MODULE/g, 'RN module (iOS)'],
      [/@ReactMethod|extends\s+ReactContextBaseJavaModule|:\s*ReactContextBaseJavaModule/g, 'RN module (Android)'],
      [/implements\s+ReactPackage|:\s*(?:Base)?ReactPackage\b|TurboReactPackage/g, 'RN package (Android)'],
      [/ModuleDefinition\s*\{|func\s+definition\(\)\s*->\s*ModuleDefinition/g, 'Expo module'],
      [/RCTViewManager|SimpleViewManager|ViewGroupManager/g, 'RN native view'],
    ];
    for (const [re, kind] of patterns) {
      const m = re.exec(text);
      re.lastIndex = 0;
      if (m) { nativeModules.push({ kind, file: rel(f), ref: `${rel(f)}:${lineAt(idx, m.index)}`, inNativeFolder: r.startsWith('ios/') || r.startsWith('android/') }); break; }
    }
  }
  const turboSpecs = srcFiles.filter((f) => /TurboModuleRegistry|codegenNativeComponent/.test(readText(f) ?? '')).map(rel);
  const patchesDir = path.join(rootDir, 'patches');
  const patches = fs.existsSync(patchesDir) ? fs.readdirSync(patchesDir).filter((f) => f.endsWith('.patch')) : [];
  const localPlugins = (appConfig.plugins ?? []).filter((p) => typeof p === 'string' && p.startsWith('.'));

  // ---- feature candidates ----
  const cand = new Map();
  const addCand = (name, source, file) => {
    const k = `${source}:${name}`;
    if (!cand.has(k)) cand.set(k, { name, source, files: 0, sample: file });
    cand.get(k).files++;
  };
  for (const f of srcFiles) {
    const segs = relRoot(f).split('/');
    for (let i = 0; i < segs.length - 1; i++) {
      if (!FEATURE_DIR_NAMES.test(segs[i])) continue;
      const next = segs[i + 1];
      const name = i + 1 < segs.length - 1 ? next : next.replace(JS_EXT, '').replace(/\.(ios|android|web|native)$/, '');
      addCand(name, (labelOf(f) ? `${labelOf(f)}: ` : '') + segs.slice(0, i + 1).join('/') + '/', rel(f));
      break;
    }
  }
  for (const r of routes.filter((x) => x.kind === 'screen')) {
    const top = r.path.split('/').filter(Boolean)[0] ?? '(root)';
    addCand(top.replace(/^:/, '[param]'), 'expo-router route', r.file);
  }
  const featureCandidates = [...cand.values()].sort((a, b) => a.source.localeCompare(b.source) || b.files - a.files);

  // ---- size ----
  const size = {};
  for (const f of allFiles) {
    const ext = path.extname(f).slice(1) || '(none)';
    if (!/^(js|jsx|ts|tsx|mjs|cjs|swift|m|mm|h|kt|java|json|graphql|gql)$/.test(ext)) continue;
    const bucket = (labelOf(f) ? `${labelOf(f)}: ` : '') + (underNative(f) ? `${relRoot(f).split('/')[0]}/*.${ext}` : `*.${ext}`);
    const text = readText(f);
    if (text == null) continue;
    size[bucket] ??= { files: 0, lines: 0 };
    size[bucket].files++;
    size[bucket].lines += count(text, /\n/g) + 1;
  }

  const result = {
    generatedAt: new Date().toISOString(),
    root: rel(rootDir) || '.',
    gitHead: gitHead(repo) ?? gitHead(rootDir),
    lockfile: locked.file ? rel(locked.file) : null,
    layout: {
      repo: rel(repo) || '.',
      app: rel(rootDir) || '.',
      isMonorepo: repo !== rootDir,
      tooling: workspaceTooling(repo),
      localPackages: [...included].map(([dir, v]) => ({ name: v.name, path: rel(dir), via: v.via })),
      unresolvedLocalPackages: [...new Set(unresolvedLocal)],
      backend: opts.layout?.backend ?? [],
      web: opts.layout?.web ?? [],
    },
    project, appConfig, eas, native,
    dependencies,
    navigation: {
      routes,
      navigators: aggregate(found.navigators),
      screens: found.screens.map(({ value, navigator, component, ref }) => ({ name: value, navigator, component, ref })),
      screenFiles,
      staticNavigation: found.staticNavigation,
      linkingPrefixes: aggregate(found.linkingPrefixes),
      routerCalls: aggregate(found.routerCalls),
      deepLinkHandlers: aggregate(found.deepLinkHandlers),
    },
    featureCandidates,
    platformSpecific: { files: platformFiles, branches: aggregate(found.platformBranches.map((b) => ({ ...b, value: `${b.ref.split(':')[0]} · ${b.value}` }))) },
    dataAtRest: aggregate(found.storage, (s) => `${s.library}|${s.key}`),
    networking: { calls: aggregate(found.api), baseUrls: aggregate(found.baseUrls), graphqlOperations: aggregate(found.graphql), rtkQueryEndpoints: aggregate(found.rtkEndpoints) },
    analyticsEvents: aggregate(found.analytics),
    testIDs: aggregate(found.testIDs),
    i18n: { locales, keysUsedInCode: aggregate(found.i18nKeys).length },
    envVars: aggregate(found.env),
    envExampleFiles: envExamples(rootDir, repo),
    skippedFiles: skipped,
    featureFlags: aggregate(found.flags),
    webviews: aggregate(found.webviews),
    externalUrls: aggregate(found.openUrls),
    permissionsRequested: aggregate(found.permissions),
    appStateListeners: found.appState.map((a) => a.ref),
    accessibility: found.a11y,
    nativeCode: { modules: nativeModules, expoModuleConfigs, turboModuleSpecs: turboSpecs, patches, localConfigPlugins: localPlugins },
    tests: { files: testFiles.length, sample: testFiles.slice(0, 20).map(rel), detox: has('detox'), maestro: allFiles.some((f) => /\.maestro\//.test(f.split(path.sep).join('/'))) },
    size,
  };
  result.risks = deriveRisks(result, has, srcFiles);
  return result;
}

// ---------- config readers ----------
function readAppConfig(rootDir, rel) {
  const jsonPath = path.join(rootDir, 'app.json');
  const dyn = ['app.config.ts', 'app.config.js', 'app.config.mjs', 'app.config.cjs'].map((f) => path.join(rootDir, f)).find((f) => fs.existsSync(f));
  const out = { file: null, dynamic: false };
  const json = readJson(jsonPath);
  if (json) {
    const e = json.expo ?? json;
    Object.assign(out, {
      file: rel(jsonPath), name: e.name ?? null, slug: e.slug ?? null, version: e.version ?? null, scheme: e.scheme ?? null,
      orientation: e.orientation ?? null,
      runtimeVersion: e.runtimeVersion ?? null, updatesUrl: e.updates?.url ?? null,
      ios: e.ios ? {
        bundleIdentifier: e.ios.bundleIdentifier ?? null, buildNumber: e.ios.buildNumber ?? null,
        supportsTablet: e.ios.supportsTablet ?? null,
        usageDescriptions: Object.keys(e.ios.infoPlist ?? {}).filter((k) => /UsageDescription$/.test(k)),
        associatedDomains: e.ios.associatedDomains ?? [], entitlements: Object.keys(e.ios.entitlements ?? {}),
        backgroundModes: e.ios.infoPlist?.UIBackgroundModes ?? [],
      } : null,
      android: e.android ? {
        package: e.android.package ?? null, versionCode: e.android.versionCode ?? null,
        permissions: e.android.permissions ?? [], blockedPermissions: e.android.blockedPermissions ?? [],
        intentFilters: (e.android.intentFilters ?? []).map((f) => ({ action: f.action, data: f.data, autoVerify: f.autoVerify ?? false })),
      } : null,
      plugins: (e.plugins ?? []).map((p) => (Array.isArray(p) ? p[0] : p)),
    });
  }
  if (dyn) {
    const text = readText(dyn) ?? '';
    const grab = (re) => text.match(re)?.[1] ?? null;
    out.dynamic = true;
    out.dynamicFile = rel(dyn);
    out.dynamicHints = {
      bundleIdentifier: grab(/bundleIdentifier\s*:\s*["'`]([^"'`]+)/),
      package: grab(/\bpackage\s*:\s*["'`]([^"'`]+)/),
      scheme: grab(/\bscheme\s*:\s*["'`]([^"'`]+)/),
      usesEnv: [...new Set([...text.matchAll(/process\.env\.([A-Z0-9_]+)/g)].map((m) => m[1]))],
    };
    out.note = 'Dynamic config: run `npx expo config --type public --json` in a scratch copy for resolved values.';
  }
  return out;
}

function readEas(rootDir) {
  const eas = readJson(path.join(rootDir, 'eas.json'));
  if (!eas) return null;
  const profiles = Object.entries(eas.build ?? {}).map(([name, p]) => ({
    name, extends: p.extends ?? null, channel: p.channel ?? null, distribution: p.distribution ?? null,
    developmentClient: !!p.developmentClient, env: Object.keys(p.env ?? {}),
  }));
  return { profiles, submit: Object.keys(eas.submit ?? {}), appVersionSource: eas.cli?.appVersionSource ?? null };
}

function readIosNative(iosDir, allFiles, rel) {
  const inIos = allFiles.filter((f) => f.startsWith(iosDir + path.sep));
  const out = { bundleIds: [], deploymentTargets: [], marketingVersions: [], buildNumbers: [], deviceFamilies: [], urlSchemes: [], usageDescriptions: [], backgroundModes: [], associatedDomains: [], entitlementKeys: [], files: {} };
  for (const f of inIos.filter((x) => x.endsWith('project.pbxproj'))) {
    const t = readText(f) ?? '';
    out.files.pbxproj = rel(f);
    out.bundleIds.push(...[...t.matchAll(/PRODUCT_BUNDLE_IDENTIFIER = "?([^";]+)"?;/g)].map((m) => m[1]));
    out.deploymentTargets.push(...[...t.matchAll(/IPHONEOS_DEPLOYMENT_TARGET = ([\d.]+);/g)].map((m) => m[1]));
    out.marketingVersions.push(...[...t.matchAll(/MARKETING_VERSION = "?([^";]+)"?;/g)].map((m) => m[1]));
    out.buildNumbers.push(...[...t.matchAll(/CURRENT_PROJECT_VERSION = "?([^";]+)"?;/g)].map((m) => m[1]));
    out.deviceFamilies.push(...[...t.matchAll(/TARGETED_DEVICE_FAMILY = "?([^";]+)"?;/g)].map((m) => m[1]));
  }
  for (const f of inIos.filter((x) => x.endsWith('Info.plist') && !/Tests?\//.test(x))) {
    const t = readText(f) ?? '';
    const schemes = t.match(/<key>CFBundleURLSchemes<\/key>\s*<array>([\s\S]*?)<\/array>/g) ?? [];
    for (const s of schemes) out.urlSchemes.push(...[...s.matchAll(/<string>([^<]+)<\/string>/g)].map((m) => m[1]));
    out.usageDescriptions.push(...[...t.matchAll(/<key>(NS\w+UsageDescription)<\/key>/g)].map((m) => m[1]));
    const bg = t.match(/<key>UIBackgroundModes<\/key>\s*<array>([\s\S]*?)<\/array>/);
    if (bg) out.backgroundModes.push(...[...bg[1].matchAll(/<string>([^<]+)<\/string>/g)].map((m) => m[1]));
  }
  for (const f of inIos.filter((x) => x.endsWith('.entitlements'))) {
    const t = readText(f) ?? '';
    out.entitlementKeys.push(...[...t.matchAll(/<key>([^<]+)<\/key>/g)].map((m) => m[1]));
    const ad = t.match(/<key>com\.apple\.developer\.associated-domains<\/key>\s*<array>([\s\S]*?)<\/array>/);
    if (ad) out.associatedDomains.push(...[...ad[1].matchAll(/<string>([^<]+)<\/string>/g)].map((m) => m[1]));
  }
  for (const k of Object.keys(out)) if (Array.isArray(out[k])) out[k] = [...new Set(out[k])];
  return out;
}

function readAndroidNative(androidDir, allFiles, rel) {
  const inAndroid = allFiles.filter((f) => f.startsWith(androidDir + path.sep));
  const out = { applicationId: null, minSdk: null, targetSdk: null, versionCode: null, versionName: null, permissions: [], deepLinkData: [], screenOrientations: [], files: {} };
  const gradle = [path.join(androidDir, 'app', 'build.gradle'), path.join(androidDir, 'app', 'build.gradle.kts')].find((f) => fs.existsSync(f));
  const rootGradle = [path.join(androidDir, 'build.gradle'), path.join(androidDir, 'build.gradle.kts')].find((f) => fs.existsSync(f));
  const gt = (gradle ? readText(gradle) : '') + '\n' + (rootGradle ? readText(rootGradle) : '');
  if (gradle) out.files.appGradle = rel(gradle);
  const g = (re) => gt.match(re)?.[1] ?? null;
  out.applicationId = g(/applicationId\s*=?\s*["']([^"']+)["']/);
  out.minSdk = g(/minSdk(?:Version)?\s*=?\s*(\d+)/);
  out.targetSdk = g(/targetSdk(?:Version)?\s*=?\s*(\d+)/);
  out.versionCode = g(/versionCode\s*=?\s*(\d+)/);
  out.versionName = g(/versionName\s*=?\s*["']([^"']+)["']/);
  for (const f of inAndroid.filter((x) => x.endsWith('AndroidManifest.xml'))) {
    const t = readText(f) ?? '';
    out.permissions.push(...[...t.matchAll(/<uses-permission(?:-sdk-\d+)?\s+android:name="([^"]+)"/g)].map((m) => m[1]));
    out.screenOrientations.push(...[...t.matchAll(/android:screenOrientation="([^"]+)"/g)].map((m) => m[1]));
    for (const m of t.matchAll(/<data\s+([^>]*?)\/?>/g)) {
      const attr = (n) => m[1].match(new RegExp(`android:${n}="([^"]+)"`))?.[1];
      const d = { scheme: attr('scheme'), host: attr('host'), path: attr('pathPrefix') ?? attr('path') ?? attr('pathPattern') };
      if (d.scheme || d.host) out.deepLinkData.push(d);
    }
  }
  out.permissions = [...new Set(out.permissions)];
  return out;
}

// ---------- helpers ----------
function expoRoute(relPath) {
  let noExt = relPath.replace(JS_EXT, '');
  let platform = null;
  const pm = noExt.match(/\.(ios|android|web|native)$/);
  if (pm) { platform = pm[1]; noExt = noExt.slice(0, -pm[0].length); }
  const segs = noExt.split('/');
  const file = segs[segs.length - 1];
  let kind = 'screen';
  if (file === '_layout') kind = 'layout';
  else if (file.endsWith('+api')) kind = 'api';
  else if (file === '+not-found') kind = 'not-found';
  else if (file.startsWith('+')) kind = 'special';
  const groups = segs.filter((s) => /^\(.*\)$/.test(s));
  const urlSegs = segs
    .filter((s, i) => !/^\(.*\)$/.test(s) && !(i === segs.length - 1 && (s === 'index' || s === '_layout' || s.startsWith('+'))))
    .map((s) => s.replace(/^\[\.\.\.(\w+)\]$/, '*$1').replace(/^\[(\w+)\]$/, ':$1'));
  return { path: '/' + urlSegs.join('/'), kind, groups, platform };
}

function classify(name) {
  const exact = libraryMap.find((e) => e.match === name);
  if (exact) return exact;
  let best = null;
  for (const e of libraryMap) {
    if (e.match.endsWith('*') && name.startsWith(e.match.slice(0, -1)) && (!best || e.match.length > best.match.length)) best = e;
  }
  return best;
}

function nativeCodeFlag(nmDirs, name) {
  if (!nmDirs.length) return 'unknown (no node_modules)';
  const dir = nmDirs.map((nm) => path.join(nm, name)).find((d) => fs.existsSync(d));
  if (!dir) return 'unknown (not installed)';
  if (['ios', 'android', 'expo-module.config.json', 'react-native.config.js'].some((x) => fs.existsSync(path.join(dir, x)))) return 'yes';
  try { if (fs.readdirSync(dir).some((f) => f.endsWith('.podspec'))) return 'yes'; } catch { /* ignore */ }
  return 'no';
}

function deriveRisks(inv, has, srcFiles) {
  const risks = [];
  const add = (level, area, text, action) => risks.push({ level, area, text, action });
  if (has('expo-updates') || has('react-native-code-push')) add('high', 'release', 'OTA updates in use: production may run JS newer than the store binary.', 'Analyse the commit of the latest production OTA update; freeze OTA before cut-over (guidelines/11-cutover-and-release.md).');
  if (inv.dataAtRest.length) add('high', 'data', `${inv.dataAtRest.length} distinct persisted keys/stores found.`, 'Run plan-data-migration; complete analysis/data-at-rest.md.');
  if (inv.dataAtRest.some((d) => d.library === 'expo-secure-store' || d.library === 'react-native-keychain')) add('high', 'auth', 'Secrets stored via SecureStore/Keychain (likely session tokens).', 'Port the library read path so users stay logged in after upgrade.');
  if (inv.navigation.deepLinkHandlers.some((d) => d.value === 'getExpoPushTokenAsync')) add('high', 'push', 'Expo push tokens (ExponentPushToken) in use: backend may send via the Expo Push API.', 'Agree with backend on switching to APNs/FCM device tokens, or keep Expo push compatibility.');
  if (has('@react-native-firebase/dynamic-links')) add('high', 'links', 'Firebase Dynamic Links is shut down.', 'Replace with universal links / app links before cut-over.');
  if (inv.nativeCode.modules.length) add('medium', 'native', `${inv.nativeCode.modules.length} custom native module/view files.`, 'Run port-native-module for each; logic is already native.');
  if (inv.nativeCode.patches.length) add('medium', 'deps', `${inv.nativeCode.patches.length} patch-package patches.`, 'Review each patch: behaviour to reproduce or drop.');
  if (inv.webviews.length) add('medium', 'ui', `${inv.webviews.length} WebView usages.`, 'Decide per screen: keep as WebView or rebuild natively.');
  if (inv.appConfig.dynamic) add('medium', 'config', 'Dynamic app.config.* — values below may be incomplete.', 'Run `npx expo config --type public --json` in a scratch copy.');
  if (inv.project.flavour.startsWith('expo managed')) add('medium', 'config', 'No native folders committed (CNG): native config comes from config plugins.', 'Run `npx expo prebuild --no-install` in a scratch copy and inspect Info.plist / AndroidManifest / entitlements.');
  const L = inv.layout;
  if (L.localPackages.length) add('low', 'monorepo', `App code also lives in ${L.localPackages.length} local package(s): ${L.localPackages.map((p) => p.name).join(', ')}. They were scanned with the app.`, 'Cite them in specs like app code. They may also serve the web app: the native rewrite reads them and never changes them.');
  if (L.unresolvedLocalPackages.length) add('medium', 'monorepo', `Workspace dependencies not found in the repo: ${L.unresolvedLocalPackages.join(', ')}.`, 'Add their folders with --set-shared (workspace.config.json) and re-run, or confirm they are published packages.');
  if (L.backend.length) add('low', 'contracts', `Backend in the same repo: ${L.backend.join(', ')}.`, 'Use its routes, DTOs and any OpenAPI files as evidence for contracts/openapi and contracts/errors.md (guideline 08). It is not migrated.');
  if (L.web.length) add('low', 'contracts', `Web frontend in the same repo: ${L.web.join(', ')}.`, 'Check it for shared strings, design tokens and analytics events (reference only).');
  const locked = [inv.appConfig.orientation, ...(inv.native.android?.screenOrientations ?? [])].filter((o) => o && !/^(default|unspecified|fullSensor|sensor|user)$/i.test(o));
  if (locked.length) add('medium', 'form-factors', `Orientation lock (${[...new Set(locked)].join(', ')}): iPhone Duo's inner display and Android 16+ large screens (targetSdk 36) ignore it.`, 'Decide large-screen behaviour in ADR-0017; record it in each spec\'s Form factors section.');
  if (inv.appConfig.ios?.supportsTablet === true || (inv.native.ios?.deviceFamilies ?? []).some((f) => f.split(',').includes('2'))) add('medium', 'form-factors', 'The hybrid app supports iPad today.', 'Keep iPad support in the native iOS app (verify App Store rules before dropping it); add an iPad row to each spec\'s Form factors (ADR-0017).');
  const orientationLibs = ['expo-screen-orientation', 'react-native-orientation-locker', 'react-native-orientation'].filter(has);
  if (orientationLibs.length) add('medium', 'form-factors', `Orientation control library in use (${orientationLibs.join(', ')}): screens lock or switch orientation at runtime.`, 'List the screens that do it; large screens (iPhone Duo inner display, Android 16+ sw≥600dp) ignore the locks. Record each in the spec\'s Form factors.');
  if (!inv.i18n.locales.length) add('medium', 'i18n', 'No locale JSON files found: strings may be hard-coded or loaded remotely.', 'Extract user-facing strings into contracts/strings before building screens.');
  if (!inv.testIDs.length) add('medium', 'testing', 'No testID props found.', 'Add testIDs on the hybrid migration/test-hooks branch for golden Maestro flows (guidelines/10), or define them fresh in contracts.');
  if (inv.platformSpecific.files.length || inv.platformSpecific.branches.length) add('low', 'parity', `${inv.platformSpecific.files.length} platform-specific files and ${inv.platformSpecific.branches.length} Platform.OS/select sites.`, 'Record each as a Platform difference in the owning spec.');
  const unmappedNative = inv.dependencies.filter((d) => !d.mapped && d.hasNativeCode === 'yes');
  if (unmappedNative.length) add('medium', 'deps', `Unmapped dependencies with native code: ${unmappedNative.map((d) => d.name).join(', ')}.`, 'Find native SDK equivalents; add them to tools/data/rn-library-map.json.');
  if (has('realm') || has('@realm/react')) add('high', 'data', 'Realm in use (Atlas Device SDKs deprecated).', 'Plan data migration to SwiftData/GRDB and Room, or pin Realm natively.');
  if (!srcFiles.length) add('high', 'scan', 'No JS/TS source files found.', 'Check --root.');
  const ids = [inv.appConfig.ios?.bundleIdentifier, inv.appConfig.android?.package, ...(inv.native.ios?.bundleIds ?? []), inv.native.android?.applicationId].filter(Boolean);
  const placeholders = [...new Set(ids.filter((b) => /^(org\.reactjs\.native\.example|com\.example|com\.anonymous|com\.helloworld|com\.myapp)\b/i.test(b)))];
  if (placeholders.length) add('high', 'release', `Template placeholder bundle ID (${placeholders.join(', ')}): that platform has probably never shipped.`, 'Confirm the store status per platform in PROJECT.md. A platform that never shipped is a new store listing (ADR), with no upgrade path and no on-device data to migrate (guideline 11).');
  if (!inv.lockfile) add('medium', 'deps', 'No lockfile found: exact installed versions are unknown.', 'Ask for the lockfile used in production builds; storage formats stay *inferred* until confirmed.');
  else if (inv.dependencies.some((d) => d.hasNativeCode === 'unknown (no node_modules)')) add('low', 'deps', 'node_modules not installed: library source (e.g. storage formats) is not readable here.', 'Use the Locked versions; mark formats *inferred* and add a Phase 2 confirmation task (guideline 02 §6). Reading another local checkout needs the user\'s explicit OK.');
  const order = { high: 0, medium: 1, low: 2 };
  return risks.sort((a, b) => order[a.level] - order[b.level]);
}

function parseArgs(argv, booleans = []) {
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
function* walk(dir) {
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
  for (const e of entries) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { if (!SKIP_DIRS.has(e.name) && !/_files$/.test(e.name)) yield* walk(p); }
    else if (e.isFile()) yield p;
  }
}
function readText(f) {
  try { if (fs.statSync(f).size > MAX_FILE_BYTES) return null; return fs.readFileSync(f, 'utf8'); } catch { return null; }
}
function readJson(f) {
  try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return null; }
}
function lineIndex(text) {
  const idx = [0];
  for (let i = 0; i < text.length; i++) if (text.charCodeAt(i) === 10) idx.push(i + 1);
  return idx;
}
function lineAt(idx, pos) {
  let lo = 0, hi = idx.length - 1;
  while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (idx[mid] <= pos) lo = mid; else hi = mid - 1; }
  return lo + 1;
}
function each(text, re, fn) { for (const m of text.matchAll(re)) fn(m); }
function count(text, re) { return (text.match(re) ?? []).length; }
function keyOf(raw) {
  const s = (raw ?? '').trim();
  const lit = s.match(/^(["'`])([^"'`]*)\1$/);
  return lit ? { key: lit[2], literal: true } : { key: s || '<none>', literal: false };
}
function flattenKeys(obj, prefix = '', out = []) {
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === 'object' && !Array.isArray(v)) flattenKeys(v, key, out); else out.push(key);
  }
  return out;
}
function countInterpolations(obj) {
  let n = 0;
  const visit = (v) => { if (typeof v === 'string') n += count(v, /\{\{[^}]+\}\}|\{\w+\}/g); else if (v && typeof v === 'object') Object.values(v).forEach(visit); };
  visit(obj);
  return n;
}
function aggregate(items, keyFn = (x) => x.value) {
  const m = new Map();
  for (const it of items) {
    const k = keyFn(it);
    if (!m.has(k)) { const { ref, ...rest } = it; m.set(k, { ...rest, count: 0, refs: [] }); }
    const a = m.get(k);
    a.count++;
    if (a.refs.length < 5) a.refs.push(it.ref);
  }
  return [...m.values()].sort((a, b) => b.count - a.count || String(keyFn(a)).localeCompare(String(keyFn(b))));
}
function gitHead(dir) {
  try {
    const head = fs.readFileSync(path.join(dir, '.git', 'HEAD'), 'utf8').trim();
    if (!head.startsWith('ref:')) return head.slice(0, 12);
    const refPath = path.join(dir, '.git', head.slice(5).trim());
    if (fs.existsSync(refPath)) return fs.readFileSync(refPath, 'utf8').trim().slice(0, 12);
    const packed = readText(path.join(dir, '.git', 'packed-refs')) ?? '';
    return packed.split('\n').find((l) => l.endsWith(head.slice(5).trim()))?.slice(0, 12) ?? null;
  } catch { return null; }
}

// ---------- rendering ----------
function esc(v) { return String(v ?? '').replace(/\|/g, '\\|').replace(/\n/g, ' '); }
function table(headers, rows) {
  if (!rows.length) return '_none found_\n';
  return `| ${headers.join(' | ')} |\n|${headers.map(() => '---').join('|')}|\n${rows.map((r) => `| ${r.map(esc).join(' | ')} |`).join('\n')}\n`;
}
function more(list) { return list.length > MAX ? `\n_…and ${list.length - MAX} more in inventory.json_\n` : ''; }
function refs(a) { return (a.refs ?? []).slice(0, 2).join(', ') + (a.count > 2 ? ` (+${a.count - 2})` : ''); }

function renderMarkdown(inv) {
  const p = inv.project;
  const c = inv.appConfig;
  const L = [];
  L.push(`# Hybrid app inventory\n`);
  L.push(`> Generated by \`tools/rn-inventory.mjs\` on ${inv.generatedAt} from \`${inv.root}\` @ \`${inv.gitHead ?? 'unknown'}\`. **Do not edit**: re-run the tool.`);
  L.push(`> Regex heuristics: every item is a lead to verify at its file:line. Full data: \`inventory.json\`.\n`);

  L.push(`## Project\n`);
  L.push(table(['Field', 'Value'], [
    ['Name / version', `${p.name ?? '?'} ${p.version ?? ''}`],
    ['Flavour', p.flavour],
    ['React Native', p.reactNative ?? '—'],
    ['Expo SDK', p.expo ?? '—'],
    ['Routing', p.expoRouter ? 'expo-router' : p.reactNavigation.length ? `React Navigation (${p.reactNavigation.join(', ')})` : 'unknown'],
    ['iOS bundle ID', c.ios?.bundleIdentifier ?? c.dynamicHints?.bundleIdentifier ?? inv.native.ios?.bundleIds.join(', ') ?? '—'],
    ['Android applicationId', c.android?.package ?? c.dynamicHints?.package ?? inv.native.android?.applicationId ?? '—'],
    ['Orientation', c.orientation ?? ([...new Set(inv.native.android?.screenOrientations ?? [])].join(', ') || '—')],
    ['iPad', c.ios?.supportsTablet != null ? `supportsTablet: ${c.ios.supportsTablet}` : inv.native.ios?.deviceFamilies.length ? `TARGETED_DEVICE_FAMILY ${[...new Set(inv.native.ios.deviceFamilies)].join(' / ')}` : '—'],
    ['URL scheme(s)', [c.scheme, c.dynamicHints?.scheme, ...(inv.native.ios?.urlSchemes ?? [])].filter(Boolean).join(', ') || '—'],
    ['iOS deployment target', inv.native.ios?.deploymentTargets.join(', ') || '— (see expo-build-properties / SDK default)'],
    ['Android minSdk / targetSdk', inv.native.android ? `${inv.native.android.minSdk ?? '?'} / ${inv.native.android.targetSdk ?? '?'}` : '— (see expo-build-properties / SDK default)'],
    ['Store versions', `iOS ${inv.native.ios?.marketingVersions.join(', ') || c.version || '?'} (${inv.native.ios?.buildNumbers.join(', ') || c.ios?.buildNumber || '?'}) · Android ${inv.native.android?.versionName ?? c.version ?? '?'} (${inv.native.android?.versionCode ?? c.android?.versionCode ?? '?'})`],
    ['OTA', c.updatesUrl ? `expo-updates (${c.updatesUrl}, runtimeVersion ${JSON.stringify(c.runtimeVersion)})` : inv.dependencies.some((d) => d.category === 'ota') ? 'yes (see dependencies)' : 'none detected'],
    ['EAS build profiles', inv.eas?.profiles.map((x) => `${x.name}${x.channel ? ` (channel ${x.channel})` : ''}`).join(', ') ?? '—'],
    ['Source size', Object.entries(inv.size).map(([k, v]) => `${k}: ${v.files} files / ${v.lines} lines`).join(' · ')],
  ]));
  if (c.note) L.push(`\n> ${c.note}\n`);
  const lay = inv.layout;
  if (lay.isMonorepo || lay.localPackages.length || lay.backend.length || lay.web.length) {
    L.push(`\n## Repository layout\n`);
    L.push(table(['Part', 'Path', 'Notes'], [
      ['Repository', lay.repo, lay.tooling.join(', ') || '—'],
      ['React Native app (analysed)', lay.app, ''],
      ...lay.localPackages.map((p) => ['Local package (scanned)', p.path, `${p.name}, used via ${p.via}`]),
      ...lay.unresolvedLocalPackages.map((n) => ['Local package (NOT found)', '?', n]),
      ...lay.backend.map((b) => ['Backend (evidence for contracts)', b, 'not migrated']),
      ...lay.web.map((w) => ['Web frontend (reference)', w, 'not migrated']),
    ]));
  }

  L.push(`\n## Risks and attention points\n`);
  L.push(table(['Level', 'Area', 'Finding', 'Action'], inv.risks.map((r) => [r.level, r.area, r.text, r.action])));

  L.push(`\n## Navigation\n`);
  if (inv.navigation.routes.length) {
    L.push(`### expo-router routes (${inv.navigation.routes.length})\n`);
    L.push(table(['Path', 'Kind', 'Groups', 'Platform', 'File'], inv.navigation.routes.slice(0, MAX).map((r) => [r.path, r.kind, r.groups.join(' '), r.platform ?? '', r.file])));
    L.push(more(inv.navigation.routes));
  }
  if (inv.navigation.navigators.length) {
    L.push(`### Navigators\n`);
    L.push(table(['Type', 'Count', 'Where'], inv.navigation.navigators.map((n) => [n.value, n.count, refs(n)])));
  }
  if (inv.navigation.screens.length) {
    L.push(`\n### Declared screens (${inv.navigation.screens.length})\n`);
    L.push(table(['Name', 'Navigator', 'Component', 'Where'], inv.navigation.screens.slice(0, MAX).map((s) => [s.name, s.navigator, s.component ?? '', s.ref])));
    L.push(more(inv.navigation.screens));
  }
  if (inv.navigation.routerCalls.length) {
    L.push(`\n### Navigation calls (targets)\n`);
    L.push(table(['Target', 'Method', 'Count', 'Where'], inv.navigation.routerCalls.slice(0, MAX).map((r) => [r.value, r.method, r.count, refs(r)])));
    L.push(more(inv.navigation.routerCalls));
  }
  L.push(`\n**Deep-link prefixes:** ${inv.navigation.linkingPrefixes.map((x) => `\`${x.value}\``).join(', ') || '—'}  `);
  L.push(`**Link / push handlers:** ${inv.navigation.deepLinkHandlers.map((x) => `${x.value} (${refs(x)})`).join('; ') || '—'}\n`);

  L.push(`\n## Feature candidates\n`);
  L.push(`Starting point for \`analysis/feature-catalog.md\`. Group, rename and assign feature IDs by hand.\n`);
  L.push(table(['Candidate', 'Found under', 'Files', 'Example'], inv.featureCandidates.slice(0, MAX * 2).map((f) => [f.name, f.source, f.files, f.sample])));
  L.push(more(inv.featureCandidates));

  L.push(`\n## Dependencies (${inv.dependencies.length}, risk-sorted)\n`);
  L.push(`Locked versions come from ${inv.lockfile ? `\`${inv.lockfile}\`` : 'no lockfile (none found)'}. Without node_modules, storage formats read from library source are *inferred* until confirmed (guideline 02 §6).\n`);
  L.push(table(['Package', 'Version', 'Locked', 'Risk', 'Category', 'iOS', 'Android', 'Native code', 'Notes'],
    inv.dependencies.map((d) => [d.name + (d.dev ? ' (dev)' : '') + (d.via ? ` (via ${d.via})` : ''), d.version, d.locked ?? '?', d.risk ?? '?', d.category, d.ios ?? '**find equivalent**', d.android ?? '**find equivalent**', d.hasNativeCode, d.notes ?? ''])));

  L.push(`\n## Data at rest (${inv.dataAtRest.length})\n`);
  L.push(`Every row must end up in \`analysis/data-at-rest.md\` with a migration decision. Non-literal keys are expressions: resolve them.\n`);
  L.push(table(['Library', 'Key / name', 'Literal', 'Ops', 'Where'], inv.dataAtRest.slice(0, MAX * 2).map((d) => [d.library, d.key, d.literal ? 'yes' : 'no', d.op, refs(d)])));
  L.push(more(inv.dataAtRest));

  L.push(`\n## Networking\n`);
  L.push(`**Base URLs:** ${inv.networking.baseUrls.map((b) => `\`${b.value}\` (${refs(b)})`).join('; ') || '—'}\n`);
  L.push(table(['Path / URL', 'Call', 'Count', 'Where'], inv.networking.calls.slice(0, MAX).map((a) => [a.value, a.call, a.count, refs(a)])));
  L.push(more(inv.networking.calls));
  if (inv.networking.graphqlOperations.length) L.push(`\n**GraphQL operations:** ${inv.networking.graphqlOperations.map((g) => g.value).join(', ')}\n`);
  if (inv.networking.rtkQueryEndpoints.length) L.push(`\n**RTK Query endpoints:** ${inv.networking.rtkQueryEndpoints.map((g) => `${g.value} (${g.kind})`).join(', ')}\n`);

  L.push(`\n## Analytics events (${inv.analyticsEvents.length})\n`);
  L.push(`Names must be kept verbatim in \`contracts/analytics/events.json\`. Also check the analytics wrapper for events built dynamically.\n`);
  L.push(table(['Event', 'Call', 'Count', 'Where'], inv.analyticsEvents.slice(0, MAX).map((a) => [a.value, a.call, a.count, refs(a)])));
  L.push(more(inv.analyticsEvents));

  L.push(`\n## i18n\n`);
  L.push(table(['File', 'Locale', 'Namespace', 'Keys', 'Plural keys', 'Interpolations'], inv.i18n.locales.map((l) => [l.file, l.locale, l.namespace ?? '', l.keys, l.plurals, l.interpolations])));
  L.push(`\nDistinct literal keys used in code: ${inv.i18n.keysUsedInCode}\n`);

  L.push(`\n## Test IDs (${inv.testIDs.length})\n`);
  L.push(inv.testIDs.length ? inv.testIDs.slice(0, MAX * 2).map((t) => `\`${t.value}\``).join(', ') + '\n' + more(inv.testIDs) : '_none found_\n');
  L.push(`\nAccessibility props: ${inv.accessibility.labels} labels, ${inv.accessibility.roles} roles, ${inv.accessibility.hints} hints.\n`);

  L.push(`\n## Platform-specific code\n`);
  L.push(`**Files:** ${inv.platformSpecific.files.join(', ') || '—'}\n`);
  L.push(table(['Site', 'Count', 'Where'], inv.platformSpecific.branches.slice(0, MAX).map((b) => [b.value, b.count, refs(b)])));
  L.push(more(inv.platformSpecific.branches));

  L.push(`\n## Native code\n`);
  L.push(table(['Kind', 'Where'], inv.nativeCode.modules.map((m) => [m.kind, m.ref])));
  L.push(`\n**Expo module configs:** ${inv.nativeCode.expoModuleConfigs.join(', ') || '—'}  `);
  L.push(`**TurboModule / codegen specs:** ${inv.nativeCode.turboModuleSpecs.join(', ') || '—'}  `);
  L.push(`**patch-package patches:** ${inv.nativeCode.patches.join(', ') || '—'}  `);
  L.push(`**Local config plugins:** ${inv.nativeCode.localConfigPlugins.join(', ') || '—'}  `);
  L.push(`**Expo plugins:** ${(c.plugins ?? []).join(', ') || '—'}\n`);

  L.push(`\n## Platform permissions and capabilities\n`);
  L.push(table(['Source', 'Values'], [
    ['iOS usage descriptions', [...(c.ios?.usageDescriptions ?? []), ...(inv.native.ios?.usageDescriptions ?? [])].join(', ')],
    ['iOS background modes', [...(c.ios?.backgroundModes ?? []), ...(inv.native.ios?.backgroundModes ?? [])].join(', ')],
    ['iOS associated domains', [...(c.ios?.associatedDomains ?? []), ...(inv.native.ios?.associatedDomains ?? [])].join(', ')],
    ['iOS entitlements', [...(c.ios?.entitlements ?? []), ...(inv.native.ios?.entitlementKeys ?? [])].join(', ')],
    ['Android permissions', [...(c.android?.permissions ?? []), ...(inv.native.android?.permissions ?? [])].join(', ')],
    ['Android link intent data', [...(c.android?.intentFilters ?? []).flatMap((f) => [].concat(f.data ?? [])), ...(inv.native.android?.deepLinkData ?? [])].map((d) => `${d.scheme ?? ''}://${d.host ?? ''}${d.path ?? d.pathPrefix ?? ''}`).join(', ')],
    ['Runtime permission requests (JS)', inv.permissionsRequested.map((x) => `${x.value} ×${x.count}`).join(', ')],
  ]));

  L.push(`\n## Other surface\n`);
  L.push(table(['What', 'Items'], [
    ['Env / build config', inv.envVars.map((e) => `${e.value} ×${e.count}`).join(', ')],
    ['Env example files (names only; .env itself is never read)', inv.envExampleFiles.map((f) => `${f.file}: ${f.names.join(', ')}`).join('; ')],
    ['Skipped (assets, vendored, minified)', inv.skippedFiles.slice(0, 10).map((f) => `${f.file} (${f.reason})`).join(', ') + (inv.skippedFiles.length > 10 ? ` …+${inv.skippedFiles.length - 10}` : '')],
    ['Feature flags / remote config', inv.featureFlags.map((f) => `${f.value} (${f.call})`).join(', ')],
    ['WebViews', inv.webviews.map((w) => `${w.value} (${refs(w)})`).join('; ')],
    ['External URLs opened', inv.externalUrls.slice(0, 15).map((u) => u.value).join('; ')],
    ['AppState listeners', inv.appStateListeners.join(', ')],
    ['Tests', `${inv.tests.files} JS test files${inv.tests.detox ? ' · Detox' : ''}${inv.tests.maestro ? ' · Maestro' : ''}`],
  ]));
  return L.join('\n') + '\n';
}

function renderMap(entries) {
  const byCat = new Map();
  for (const e of entries) { if (!byCat.has(e.category)) byCat.set(e.category, []); byCat.get(e.category).push(e); }
  let s = '';
  for (const [cat, list] of byCat) {
    s += `\n### ${cat}\n\n| RN / Expo package | iOS | Android | Risk | Notes |\n|---|---|---|---|---|\n`;
    for (const e of list) s += `| \`${e.match}\` | ${esc(e.ios)} | ${esc(e.android)} | ${e.risk} | ${esc(e.notes)} |\n`;
  }
  return s;
}

// ---------- monorepo helpers ----------
function isInside(child, parent) {
  const r = path.relative(parent, child);
  return r === '' || (!r.startsWith('..') && !path.isAbsolute(r));
}
function findLocalPackages(repo) {
  const out = new Map();
  for (const f of walkDepth(repo, 6)) {
    if (path.basename(f) !== 'package.json') continue;
    const name = readJson(f)?.name;
    if (name && !out.has(name)) out.set(name, path.dirname(f));
  }
  return out;
}
function workspaceTooling(repo) {
  const t = [];
  if (readJson(path.join(repo, 'package.json'))?.workspaces) t.push('npm/yarn workspaces');
  for (const [f, label] of [['pnpm-workspace.yaml', 'pnpm workspaces'], ['nx.json', 'Nx'], ['turbo.json', 'Turborepo'], ['lerna.json', 'Lerna'], ['rush.json', 'Rush']]) if (fs.existsSync(path.join(repo, f))) t.push(label);
  return t;
}
function* walkDepth(dir, depth) {
  if (depth < 0) return;
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
  for (const e of entries) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { if (!SKIP_DIRS.has(e.name) && e.name !== 'ios' && e.name !== 'android') yield* walkDepth(p, depth - 1); }
    else if (e.isFile()) yield p;
  }
}
function findApps(repo) {
  const relp = (p) => path.relative(process.cwd(), p).split(path.sep).join('/') || '.';
  if (!fs.existsSync(repo)) { console.error(`No ${relp(repo)} folder. Clone the app repository into it first.`); process.exit(1); }
  const rows = [];
  const files = [...walkDepth(repo, 6)];
  for (const f of files.filter((x) => path.basename(x) === 'package.json')) {
    const dir = path.dirname(f);
    const pkg = readJson(f);
    if (!pkg) continue;
    const d = { ...(pkg.dependencies ?? {}), ...(pkg.devDependencies ?? {}) };
    const has = (x) => fs.existsSync(path.join(dir, x));
    if ('react-native' in d || 'expo' in d) {
      const sig = [];
      if (has('app.json') || has('app.config.ts') || has('app.config.js')) sig.push('app.json/app.config');
      if (has('ios') && has('android')) sig.push('ios/ + android/');
      if (['metro.config.js', 'metro.config.cjs', 'metro.config.ts'].some(has)) sig.push('metro.config');
      if (has('eas.json')) sig.push('eas.json');
      if ('expo-router' in d) sig.push('expo-router');
      const entry = readText(path.join(dir, pkg.main && !pkg.main.includes('node_modules') ? pkg.main : 'index.js')) ?? '';
      if (/AppRegistry\.registerComponent|registerRootComponent/.test(entry)) sig.push('registers a root component');
      rows.push({ kind: sig.length ? 'react-native app' : 'react-native library', path: relp(dir), name: pkg.name ?? '', signals: sig.join(', ') || 'depends on react-native', rank: sig.length ? 0 : 3 });
    } else if (pkg.peerDependencies && 'react-native' in pkg.peerDependencies) {
      rows.push({ kind: 'react-native library', path: relp(dir), name: pkg.name ?? '', signals: 'peer-depends on react-native', rank: 3 });
    } else if (WEB_DEPS.some((x) => x in d)) {
      rows.push({ kind: 'web frontend', path: relp(dir), name: pkg.name ?? '', signals: WEB_DEPS.filter((x) => x in d).join(', '), rank: 2 });
    } else if (BACKEND_DEPS.some((x) => x in d)) {
      rows.push({ kind: 'backend (Node)', path: relp(dir), name: pkg.name ?? '', signals: BACKEND_DEPS.filter((x) => x in d).join(', '), rank: 1 });
    } else if (dir !== repo) {
      rows.push({ kind: 'package', path: relp(dir), name: pkg.name ?? '', signals: '', rank: 4 });
    }
  }
  const rnDirs = new Set(rows.filter((r) => r.kind.startsWith('react-native')).map((r) => r.path));
  for (const f of files) {
    const b = path.basename(f);
    const dir = path.dirname(f);
    if (b === 'Gemfile' && (rnDirs.has(relp(dir)) || iosOnlyGems(f))) continue; // RN template Gemfile is for CocoaPods/fastlane
    if (['go.mod', 'pom.xml', 'Cargo.toml', 'Gemfile', 'composer.json', 'pyproject.toml', 'requirements.txt', 'mix.exs'].includes(b) || b.endsWith('.csproj')) {
      rows.push({ kind: 'backend', path: relp(dir), name: '', signals: b, rank: 1 });
    } else if (/^build\.gradle(\.kts)?$/.test(b) && !/com\.android\./.test(readText(f) ?? '') && fs.existsSync(path.join(dir, 'src', 'main'))) {
      rows.push({ kind: 'backend (JVM)', path: relp(dir), name: '', signals: b, rank: 1 });
    } else if (/^(openapi|swagger)[\w.-]*\.(ya?ml|json)$/i.test(b) || b === 'schema.graphql') {
      rows.push({ kind: 'API spec', path: relp(f), name: '', signals: 'evidence for contracts/openapi', rank: 1 });
    }
  }
  const seen = new Set();
  const list = rows.filter((r) => { const k = `${r.kind}|${r.path}`; if (seen.has(k)) return false; seen.add(k); return true; })
    .sort((a, b) => a.rank - b.rank || a.path.localeCompare(b.path));
  const apps = list.filter((r) => r.kind === 'react-native app');
  if (args.json) { console.log(JSON.stringify({ repo: relp(repo), tooling: workspaceTooling(repo), candidates: list }, null, 2)); return; }
  console.log(`Repository ${relp(repo)}${workspaceTooling(repo).length ? ` (${workspaceTooling(repo).join(', ')})` : ''}\n`);
  process.stdout.write(table(['Kind', 'Path', 'Package', 'Signals'], list.map((r) => [r.kind, r.path, r.name, r.signals])));
  console.log(`\n${apps.length === 1 ? `One React Native app found: ${apps[0].path}` : apps.length ? `${apps.length} React Native apps found. One workspace per app: pick the one this workspace is for.` : 'No React Native app found. Check the clone, or pass --repo <path>.'}`);
  console.log('Save the answer with: node tools/rn-inventory.mjs --set-app <path> [--set-backend <path,...>] [--set-web <path,...>]');
}
function setConfig() {
  const cfgAll = readJson(CONFIG_PATH) ?? {};
  const cfg = (cfgAll.hybrid ??= {});
  const relWs = (p) => path.relative(WS, path.resolve(p)).split(path.sep).join('/') || '.';
  if (args['set-app']) {
    const dir = path.resolve(String(args['set-app']));
    const p = readJson(path.join(dir, 'package.json'));
    if (!p || !['react-native', 'expo'].some((d) => d in { ...p.dependencies, ...p.devDependencies })) { console.error(`${relWs(dir)} has no package.json depending on react-native or expo`); process.exit(1); }
    cfg.app = relWs(dir);
  }
  for (const [flag, key] of [['set-backend', 'backend'], ['set-web', 'web'], ['set-shared', 'sharedPackages']]) {
    if (args[flag]) cfg[key] = String(args[flag]).split(',').filter(Boolean).map(relWs);
  }
  cfg.repo ??= 'hybrid';
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(cfgAll, null, 2) + '\n');
  console.log(`✔ workspace.config.json: ${JSON.stringify(cfg)}`);
}

// ---------- lockfiles, env examples, branches ----------
function readLockfile(appDir, repo) {
  const versions = new Map();
  const relApp = path.relative(repo, appDir).split(path.sep).join('/');
  for (let d = appDir; ; d = path.dirname(d)) {
    for (const name of ['package-lock.json', 'yarn.lock', 'pnpm-lock.yaml']) {
      const file = path.join(d, name);
      if (!fs.existsSync(file)) continue;
      const text = readText(file) ?? '';
      if (name === 'package-lock.json') {
        const j = readJson(file) ?? {};
        for (const [k, v] of Object.entries(j.packages ?? {})) {
          const m = k.match(/(?:^|\/)node_modules\/((?:@[^/]+\/)?[^/]+)$/);
          if (!m || !v?.version) continue;
          const preferred = relApp && k.startsWith(`${relApp}/node_modules/`);
          if (preferred || !versions.has(m[1])) versions.set(m[1], v.version);
        }
        for (const [k, v] of Object.entries(j.dependencies ?? {})) if (v?.version && !versions.has(k)) versions.set(k, v.version);
      } else if (name === 'yarn.lock') {
        for (const block of text.split(/\n\s*\n/)) {
          const header = block.split('\n').find((l) => l && !l.startsWith(' ') && !l.startsWith('#'));
          const ver = block.match(/^\s+version:?\s+"?([^"\s]+)"?/m)?.[1];
          if (!header || !ver) continue;
          for (const spec of header.replace(/:$/, '').split(',')) {
            const sp = spec.trim().replace(/^"|"$/g, '');
            const at = sp.lastIndexOf('@');
            const pkgName = at > 0 ? sp.slice(0, at) : sp;
            if (pkgName && !versions.has(pkgName)) versions.set(pkgName, ver);
          }
        }
      } else {
        for (const m of text.matchAll(/^\s{2}'?\/?((?:@[^/@\s]+\/)?[^@\s/']+)@([^:('\s]+)/gm)) if (!versions.has(m[1])) versions.set(m[1], m[2]);
      }
      return { file, versions };
    }
    if (d === repo || path.dirname(d) === d || !isInside(d, repo)) break;
  }
  return { file: null, versions };
}
function envExamples(appDir, repo) {
  const out = [];
  for (const d of [...new Set([appDir, repo])]) {
    for (const name of ['.env.example', '.env.sample', '.env.template', '.env.dist', 'env.example']) {
      const file = path.join(d, name);
      if (!fs.existsSync(file)) continue;
      const names = [...(readText(file) ?? '').matchAll(/^\s*(?:export\s+)?([A-Z][A-Z0-9_]*)\s*=/gm)].map((m) => m[1]);
      out.push({ file: path.relative(process.cwd(), file).split(path.sep).join('/'), names });
    }
  }
  return out;
}
function iosOnlyGems(gemfile) {
  const gems = [...(readText(gemfile) ?? '').matchAll(/^\s*gem\s+['"]([^'"]+)['"]/gm)].map((m) => m[1]);
  const tooling = new Set(['cocoapods', 'fastlane', 'activesupport', 'xcodeproj', 'concurrent-ruby', 'bigdecimal', 'logger', 'benchmark', 'mutex_m', 'nkf', 'cocoapods-patch']);
  return gems.length > 0 && gems.every((g) => tooling.has(g));
}
function git(argv, cwd) {
  return execFileSync('git', argv, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 64 * 1024 * 1024 });
}
function findAppsOnBranches(repo) {
  const relp = (p) => path.relative(process.cwd(), p).split(path.sep).join('/') || '.';
  let refs;
  try {
    refs = git(['for-each-ref', '--sort=-committerdate', '--format=%(refname:short)|%(committerdate:short)|%(objectname:short)', 'refs/remotes', 'refs/heads'], repo)
      .trim().split('\n').filter(Boolean).map((l) => { const [ref, date, sha] = l.split('|'); return { ref, date, sha }; })
      .filter((r) => !/\/HEAD$/.test(r.ref) && r.ref !== 'origin');
  } catch { console.error(`✖ ${relp(repo)} isn't a git repository`); process.exit(1); }
  const current = (() => { try { return git(['rev-parse', '--abbrev-ref', 'HEAD'], repo).trim(); } catch { return null; } })();
  const max = Number(args['max-branches'] ?? 15);
  const rows = [];
  const seenSha = new Set();
  for (const r of refs.slice(0, max)) {
    if (seenSha.has(r.sha)) { rows.push([r.ref, r.date, r.sha, '(same commit as a branch above)', '', '', '']); continue; }
    seenSha.add(r.sha);
    let paths = [];
    try { paths = git(['ls-tree', '-r', '--name-only', r.ref], repo).split('\n').filter((p) => /(^|\/)package\.json$/.test(p) && !/node_modules\//.test(p) && p.split('/').length <= 6); } catch { continue; }
    let found = 0;
    for (const p of paths) {
      let pkg; try { pkg = JSON.parse(git(['show', `${r.ref}:${p}`], repo)); } catch { continue; }
      const d = { ...(pkg.dependencies ?? {}), ...(pkg.devDependencies ?? {}) };
      if (!('react-native' in d) && !('expo' in d)) continue;
      const dir = path.posix.dirname(p);
      let appVersion = pkg.version ?? '';
      try { const aj = JSON.parse(git(['show', `${r.ref}:${dir === '.' ? '' : dir + '/'}app.json`], repo)); appVersion = aj.expo?.version ?? aj.version ?? appVersion; } catch { /* no app.json */ }
      rows.push([r.ref + (r.ref === current || r.ref.endsWith(`/${current}`) ? ' (checked out)' : ''), r.date, r.sha, dir, pkg.name ?? '', appVersion, `RN ${d['react-native'] ?? '—'}${d.expo ? ` · Expo ${d.expo}` : ''}`]);
      found++;
    }
    if (!found) rows.push([r.ref, r.date, r.sha, '(no React Native app)', '', '', '']);
  }
  console.log(`Branches of ${relp(repo)}, newest first (${Math.min(max, refs.length)} of ${refs.length}; nothing is checked out)\n`);
  process.stdout.write(table(['Branch', 'Last commit', 'SHA', 'App folder', 'Package', 'App version', 'RN / Expo'], rows));
  console.log('\nAsk which branch is live in production before pinning. Then check it out in hybrid/ (with the user\'s OK) and run --find-apps again.');
}
