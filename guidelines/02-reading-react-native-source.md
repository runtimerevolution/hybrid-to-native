# 02 — Reading React Native / Expo source

Goal: turn `hybrid/` into **evidence** (file:line references) that feeds the feature catalog and specs.
We aren't translating JS line by line. We extract *behaviour*, *data* and *integrations*.

Start with `node tools/rn-inventory.mjs --out analysis/inventory`. It gives you a map
(routes, dependencies, native modules, storage keys, API calls, analytics events, testIDs, env vars,
platform branches). Then use this guide to go deeper where the scan is only a starting point.

## 0. Make sure you're reading what users run

- **List the branches first.** The default branch can be years old while the live app sits on another branch, in another folder:
  ```bash
  node tools/rn-inventory.mjs --find-apps --branches   # RN app folders + versions on each branch, newest first, no checkout
  ```
  Ask which branch and tag are live, then check it out in `hybrid/` (with the user's OK). The stakeholder and analyst
  views must not draw conclusions from a stale checkout.
- Check out the commit/tag of the **current production release**, not `main`, unless they are the same.
- **OTA updates:** if the app uses `expo-updates` (or the retired CodePush), production may run a JS bundle
  newer than the store binary. Find the latest published update for the production channel / runtime
  version (`eas update:list`, or ask the team) and analyse *that* commit.
- Record the commit SHA in `analysis/architecture.md`. Every file:line reference in specs is against it.

## 1. Find the app (monorepos)

Many repositories hold the backend, a web frontend and the mobile app side by side (`apps/mobile`, `apps/web`,
`services/api`, `packages/*`). `/kickoff` asks which folder is the app. By hand:

```bash
node tools/rn-inventory.mjs --find-apps                        # RN apps, libraries, web apps, backends, API specs
node tools/rn-inventory.mjs --set-app hybrid/apps/mobile --set-backend hybrid/services/api --set-web hybrid/apps/web
```

| Part of the repo | Role in the migration |
|---|---|
| **The RN app folder** | Analysed. This is what gets rebuilt |
| **Local packages the app imports** (`workspace:*`, `file:`, or names of packages in the repo) | **Analysed with the app.** API clients, validation schemas, stores, i18n and UI kits often live here. The inventory follows them automatically and lists them under *Repository layout*. Cite them in specs like app code |
| **Backend** | Evidence for `contracts/`: routes, DTOs, validation, error codes, OpenAPI/GraphQL schemas. Not migrated |
| **Web frontend** | Reference: shared strings, design tokens and analytics events. Not migrated |
| **Other RN apps** in the same repo | Each gets its own workspace (`init-workspace.sh … --app <folder>`) |

The scanner skips code that isn't the app's: anything under `assets/`, `public/`, `static/` or `vendor/`, saved web pages
(`*_files/`), `*.min.js`, and minified files. They're listed under *Skipped* in the inventory. Build configuration
comes from `process.env.*`, `react-native-config` (`Config.X`), `react-native-dotenv` (`import { X } from '@env'`) and the
variable names in `.env.example`-style files. **`.env` itself is never read:** it may hold real secrets.

Dependencies are often hoisted to the repo root's `node_modules`. The inventory looks there too. When reading a
library's source (for example the storage format in `plan-data-migration`), check the app's `node_modules` first, then the
parents up to the repo root. Shared packages stay in use by the web app after cut-over. The native rewrite reads them and
never changes them. Every golden rule about `hybrid/` being read-only covers the whole repository.

## 1b. Identify the flavour

| Signal | Meaning | Consequence |
|---|---|---|
| `expo` in deps, no `ios/`/`android/` committed | Expo managed / Continuous Native Generation | Native config comes from `app.json`/`app.config.*` + config plugins. Run `npx expo prebuild --no-install` **in a scratch copy** to see the generated `Info.plist`, entitlements, `AndroidManifest.xml` |
| `expo` in deps and `ios/`/`android/` committed | Expo with prebuild committed (or bare + Expo modules) | Read native folders directly; check they're in sync with `app.json` |
| No `expo`, `ios/`/`android/` present | Bare React Native | Native projects are the source of truth for native config |
| `expo-router` in deps, `app/` (or `src/app/`) dir | File-based routing | Routes = file tree (see §3) |
| `@react-navigation/*` | React Navigation | Routes = navigator definitions (see §3) |

Useful commands (run inside a copy of `hybrid/`, never commit results):
```bash
npx expo config --type public --json        # resolved app config (dynamic app.config.ts included)
npx expo config --type introspect --json    # config after config plugins are applied
npx expo prebuild --no-install --clean      # generate ios/ + android/ to inspect native config
npx expo-doctor                             # dependency/SDK mismatches
```

## 2. Reading order

1. `package.json`: RN/Expo versions, scripts, every dependency (the inventory classifies them against
   `tools/data/rn-library-map.json`).
2. App config: `app.json` / `app.config.*` / `eas.json` (bundle IDs, scheme, permissions, plugins, build
   profiles → map to iOS configurations / Android build types and flavors).
3. Entry point: `index.js` → `App.tsx` (or `app/_layout.tsx`): providers tell you the architecture
   (Redux/Zustand/React Query/Apollo/i18n/theme/Sentry/Firebase init order).
4. Navigation tree (§3). This becomes the backbone of the feature catalog.
5. Per feature: screen → hooks → state → services/API → storage. Follow the data.
6. Native code: `ios/`, `android/`, `modules/` (Expo local modules), `patches/` (patch-package: the team
   patched a library, so find out why).
7. Cross-cutting: auth/session, networking layer (interceptors, token refresh, retries), error handling,
   analytics wrapper, feature flags/remote config, push, deep links, i18n, theme.

## 3. Navigation → screens → features

**expo-router:** each file under `app/` is a route.
- `_layout.tsx` defines a navigator (Stack / Tabs / Drawer) for that folder. Its `screenOptions` and
  `<Stack.Screen options>` hold titles, `presentation: 'modal'`, header config.
- `(group)` folders don't appear in the URL but often mean "auth vs. app" or "tabs".
- `[id].tsx` is a dynamic segment, `[...rest].tsx` a catch-all, `+not-found.tsx` the 404 route, `+api.ts` a server route (ignore it).
- Redirects/guards: `<Redirect href>` or `router.replace` in layouts, usually auth gating.

**React Navigation:**
- Find `create*Navigator()` calls (native-stack, stack, bottom-tabs, drawer, material-top-tabs) and every
  `<X.Screen name="..." component={...}>`, or the static config API (`createStaticNavigation`).
- The `linking` prop on `NavigationContainer` (`prefixes`, `config.screens`) is the **deep-link table**.
  Copy it into `contracts/deeplinks.md` verbatim.
- Conditional navigators (`isSignedIn ? <AppStack/> : <AuthStack/>`) define the session state machine.

Every route must map to a feature ID in `analysis/feature-catalog.md`, including modals and hidden debug screens
(mark those out of scope explicitly).

## 4. What to extract for each feature

| Aspect | Where to look in RN | Goes to spec section |
|---|---|---|
| Screens and states | Screen component; conditional renders for `isLoading`, `error`, empty lists | Screens & states |
| User actions | `onPress`, `onChangeText`, `onSubmitEditing`, gestures, `useFocusEffect` | Actions & behaviour |
| Validation | `zod`/`yup` schemas, `react-hook-form` rules, inline checks | Business rules |
| Server data | API service files, React Query keys/`queryFn`, RTK Query endpoints, Apollo operations | Data & API |
| Caching / offline | React Query `staleTime`/`gcTime`, persisted stores, NetInfo checks | Data & API |
| Local persistence | AsyncStorage / MMKV / SecureStore / Keychain / SQLite / redux-persist / zustand `persist` | Local data |
| Navigation out | `navigation.navigate`, `router.push`, `Linking.openURL` | Navigation |
| Analytics | Analytics wrapper calls, screen-view tracking in navigation state listener | Analytics |
| Strings | `t('key')` / `<Trans>` / `FormattedMessage` keys | Strings |
| Accessibility | `accessibilityLabel`, `accessibilityRole`, `accessibilityHint`, `testID` | Accessibility & test IDs |
| Flags | Remote config / LaunchDarkly / Statsig / custom flag hooks | Feature flags |
| Platform branches | `Platform.OS`, `Platform.select`, `*.ios.tsx` / `*.android.tsx` | Platform differences |
| Permissions | `request*PermissionsAsync`, `react-native-permissions`, Info.plist / manifest | Permissions |

## 5. Hotspots that break migrations

- **Session and tokens:** where the access/refresh token is stored (SecureStore? Keychain? AsyncStorage?),
  refresh logic in interceptors, what "logged in" means at launch. Feeds `plan-data-migration`.
- **Everything persisted on device:** list every key/table/file. After the upgrade the native app starts
  with that data on disk (see `11-cutover-and-release.md`).
- **Custom native modules:** `RCT_EXPORT_MODULE`, `@ReactMethod`, TurboModules, Expo `Module` definitions.
  They're already native code. Use `port-native-module` to reuse the logic and drop the bridge.
- **patch-package patches:** each patch is a behaviour you'll need to reproduce or drop.
- **WebViews:** web content inside the app. Decide per case: keep it as a WebView or rebuild it natively.
- **JS-only business logic** (pricing, formatting, date math, permissions matrices): this logic has to be ported
  *exactly*. Extract test vectors from existing Jest tests or by running the function, and reuse them as
  fixtures on both platforms (`contracts/fixtures/`).
- **Date/number formatting:** `moment`/`date-fns`/`Intl` locale behaviour differs from
  `DateFormatter` / `java.time`. Specify the expected output per locale in the spec.
- **Silent global behaviour:** error boundaries, global toasts, network-status banners, app-state listeners
  (`AppState` → refresh on foreground), force-update checks, jailbreak/root checks.
- **Push:** the library in use, how the token is sent to the backend, notification categories/channels,
  payload → navigation mapping.
- **Third-party SDK init:** keys, consent gating (GDPR/ATT), init order.

## 5b. When `node_modules` isn't installed

Installing dependencies needs network access and permission, and isn't always possible. Then:
- use the exact versions from the lockfile (the inventory's *Locked* column: `package-lock.json`, `yarn.lock` or `pnpm-lock.yaml`);
- read the library's source **at that version** upstream (its git tag), and mark any conclusion drawn from it (storage formats,
  retry rules) as **inferred**;
- add a Phase 2 task to confirm each inferred item: install in a scratch copy, plus fixture capture (`plan-data-migration`);
- **reading another local checkout** of the same repo that has dependencies installed is allowed only with the user's explicit OK. It's
  read-only, never written to, and its path and SHA are recorded in the analysis.

## 6. How to report evidence

- Always cite `hybrid/<path>:<line>` (against the recorded SHA). Prefer several short citations over long pastes.
- Separate **observed** facts ("the button is disabled while `isSubmitting`", `LoginScreen.tsx:88`) from
  **inferred** intent ("probably to prevent double submit"). Mark inferences explicitly.
- If behaviour depends on the backend or on remote config, say so and list it under *Open questions*.
- If you can run the hybrid app (simulator + Metro), confirm UI behaviour there and capture screenshots
  to `specs/features/<ID>/assets/`.

## 7. Outputs of discovery (`analysis/`)

| File | Content |
|---|---|
| `inventory/inventory.json`, `inventory/INVENTORY.md` | Generated by `tools/rn-inventory.mjs`. Don't edit |
| `architecture.md` | SHA analysed, flavour, providers, state management, networking, navigation tree diagram |
| `feature-catalog.md` | Table: feature ID, name, routes/screens, hybrid paths, dependencies, priority, wave, complexity |
| `integrations.md` | Every SDK/service: purpose, keys/config location, native replacement, owner |
| `data-at-rest.md` | Every persisted key/table/file: library, key, format, sensitivity, migration action |
| `native-code.md` | Custom native modules, config plugins, patches, and how each will be handled |
| `risks.md` | Risks ranked by impact × likelihood, each with an owner and mitigation |
