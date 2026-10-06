# 08 — Shared contracts

Anything that **must be identical on both platforms** is defined once in `contracts/` and then generated or copied
into each repo. If it's written by hand twice, it drifts.

## Layout

```
contracts/
  sync.config.json          # where each artefact goes in ios/ and android/ (read by tools/contracts-sync.mjs)
  openapi/<api>.yaml        # backend API. Operation IDs are the names used in specs and contracts
  fixtures/<operationId>/   # real JSON responses (success, empty, each error), shared test data
  design-tokens/tokens.json # colours, typography, spacing, radii, elevation (W3C design-token format)
  strings/<locale>.json     # UI strings; the base locale is the source, other locales are translations
  analytics/events.json     # every analytics event: name, properties, types, when it fires
  deeplinks.md              # URL patterns ↔ routes ↔ feature IDs; universal/app links domains
  flags.md                  # feature-flag / remote-config keys, types, defaults, owners
  errors.md                 # backend error codes → AppError case → string key
```

## How each artefact reaches the apps

| Artefact | Source of truth | iOS | Android | Mechanism |
|---|---|---|---|---|
| API | `openapi/*.yaml` | swift-openapi-generator (SPM build plugin) | openapi-generator (Kotlin + kotlinx.serialization) or Ktor codegen | `contracts-sync` copies the YAML; generation runs in each build. The Swift plugin needs the file **named `openapi.yaml`** next to an `openapi-generator-config.yaml` in the target's folder, so map it in `sync.config.json` |
| Fixtures | `fixtures/**` | Test bundle resources | `src/test/resources` | `contracts-sync` copies |
| Design tokens | `design-tokens/tokens.json` | `DesignSystem/Generated/*.swift` | `core/designsystem/.../generated/*.kt` | Style Dictionary: add `design-tokens/style-dictionary.config.json` in Phase 2 with one Swift and one Compose platform writing into the repos. Workspace CI runs the build and fails on `git diff` in the repos |
| Strings | `strings/<locale>.json` | `Localizable.xcstrings` + typed `L10n.swift` (in `DesignSystem`) | `res/values[-xx]/strings.xml` | `contracts-sync` generates |
| Analytics | `analytics/events.json` | `AnalyticsEvent.swift` (enum) | `AnalyticsEvent.kt` (sealed interface) | `contracts-sync` generates |
| Deep links | `deeplinks.md` | Route parser + tests | Route parser + tests | Written by hand, tested against the table |
| Flags | `flags.md` | `FeatureFlag` enum | `FeatureFlag` enum | Written by hand (small) |

```bash
node tools/contracts-sync.mjs            # copy + generate into ios/ and android/
node tools/contracts-sync.mjs --check    # CI: fails if a repo's copy is stale or was hand-edited
```

Generated files start with a `GENERATED — DO NOT EDIT` header (or comment field). Agents must change `contracts/` and re-run the sync.
The native repos commit the generated output, so they build on their own in CI. Each repo also gets a
`.contracts-sync.json` manifest, which lets the sync delete outputs that are no longer produced and lets `--check` report them.
`--check` runs in **workspace CI** (the only place that has `contracts/` and both repos checked out). It also fails
when a configured repo is missing.

## API (`openapi/`)

- If the backend has no OpenAPI document, **reconstruct one from the hybrid API layer** in Phase 2 (services,
  axios instances, RTK Query endpoints, TypeScript response types, Zod schemas). Validate it against real traffic
  (a proxy capture, or the fixtures), then ask the backend team to own it.
- Give every operation an `operationId` (`getProfile`, `updateProfile`). Specs and contracts refer to it.
- Save one fixture per meaningful response: `fixtures/getProfile/200-complete.json`, `200-minimal.json`,
  `401.json`, `422-invalid-email.json`. Both platforms' decoding tests use the same files. That catches
  optionality and date-format mismatches early.
- Auth, token refresh, retry, timeouts, and headers such as locale, app version and device ID are **core** behaviour. Specify them once
  in `specs/features/CORE-NETWORK/spec.md`.
- **OpenAPI hygiene for both generators:**
  - Avoid redundant `additionalProperties: true` on object schemas. openapi-generator's Kotlin + kotlinx.serialization output fails to compile with it.
  - Don't name schemas after language types: `Unit`, `Result`, `Error`, `Any`, `Data`, `Object`, `String`, `List`, `Map`, `Type`. They shadow `kotlin.Unit`, Swift's `Result` and so on. Rename them in the contract (a CCR, never in generated code).
  - Turn off generator defaults that log full request/response bodies (e.g. the generated Kotlin `ApiClient`). Use the app's own HTTP stack and logging rules (07 § Networking).
  - Validate the document in CI (`redocly lint` or `spectral`) before regenerating.

## Design tokens (`design-tokens/`)

- Extract them from the hybrid theme (theme files, `StyleSheet` constants, Tailwind/NativeWind config, styled-components
  theme). Where Figma exists, Figma is the source and the hybrid theme is the check.
- Name tokens by role (`color.text.primary`, `space.m`, `radius.card`), not by value (`blue500`).
- Dark mode: define both schemes in the tokens. Don't let each platform guess.
- Components (Button, TextField, Card, ErrorView, EmptyState, LoadingView) are built **once per platform** in
  the design-system module during Phase 2, with the same names and variants on both. Features use only these.

## Strings (`strings/`)

- Start from the hybrid i18n files (i18next / react-intl / custom JSON) and keep their **keys verbatim**.
  Nested JSON is flattened to dot notation: `{"auth":{"login":{"title":"..."}}}` → `auth.login.title`.
- Interpolation: i18next `{{name}}` → iOS `%@` (positional `%1$@` when there are several) and Android `%1$s`.
  `contracts-sync` converts them. Placeholder order stays as in the base locale.
- Plurals: i18next suffixes `_one`, `_two`, `_few`, `_many`, `_other` (and legacy `key` / `key_plural`) → String
  Catalog plural variations / Android `<plurals>`.
- **Don't rely on `_zero`.** Android ignores `quantity="zero"` for English and most other languages, so the platforms
  would show different text. For an empty state, use a separate key (`cart.empty`) and branch on `count == 0` in the
  view model on both platforms. `contracts-sync` warns when it sees `_zero`.
- Usage: iOS `L10n.cartItems(count: n)` (generated, plural-aware). Android
  `pluralStringResource(R.plurals.cart_items, n, n)` / `stringResource(R.string.auth_login_greeting, name, n)`.
- Android resource names can't contain `.` or `-`. The generator maps `auth.login.title` → `auth_login_title`.
- **App display name:** keep it as the contract string `app.name`. Android gets `app_name` (point `android:label` at it),
  and iOS gets a generated `InfoPlist.xcstrings` that maps `app.name` to `CFBundleDisplayName`
  (`sync.config.json` → `ios.strings.infoPlist`). It belongs to the App target, not the DesignSystem package.
- Never concatenate translated fragments in code. Add a key with placeholders instead.
- If Xcode adds entries to the generated catalog (strings it extracted from code in the same target), `--check` fails.
  That's a hard-coded string: move it to `contracts/strings` and use `L10n`. Whitespace or ordering changes made by
  Xcode are ignored, because `.xcstrings` files are compared as JSON.

## Analytics (`analytics/events.json`)

```json
{
  "events": [
    {
      "name": "login_submitted",
      "description": "User tapped the login button with a valid form",
      "feature": "AUTH-LOGIN",
      "properties": { "method": { "type": "string", "enum": ["email", "apple", "google"], "required": true } }
    }
  ]
}
```

- **Event and property names are copied from the hybrid app exactly.** Dashboards, funnels and ML pipelines
  depend on them. Renaming happens after cut-over, if ever, through the normal spec process.
- Also record *implicit* events that the hybrid SDK sends automatically (screen views from a navigation listener,
  app open, session start). The native apps must send them explicitly.
- Parity check: every app has a debug-only analytics sink that prints
  `ANALYTICS {"name":"...","props":{...}}` lines. Capture them while a Maestro flow runs, then compare with
  `node tools/analytics-diff.mjs expected.jsonl actual.jsonl` (see `10-testing-and-parity.md`). For the hybrid
  app, the sink lives on the `migration/test-hooks` branch (see `10-testing-and-parity.md`).

## Deep links (`deeplinks.md`)

A table with pattern → route → feature ID → auth required → example, plus the associated domains
(`apple-app-site-association`, `assetlinks.json`). Both route parsers have a table-driven test that uses exactly
these examples.

## Test IDs

Test IDs are declared per feature in `contract.md`. Keep the hybrid `testID`s wherever they exist. That way
the Maestro flows recorded against the hybrid app run unchanged against both native apps.
