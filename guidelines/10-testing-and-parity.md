# 10 — Testing and parity verification

Parity isn't a feeling. It's proven by **the same acceptance criteria passing on both platforms**, checked by tools.

## Four parity oracles

> **New app** (no hybrid): the same oracles, compared iOS against Android and both against the specs and designs.
> The golden reference is written from the specs (guideline 15 § Golden reference).

| Oracle | What it proves | Tool |
|---|---|---|
| **AC traceability** | Every AC has a test on iOS, on Android, and (if marked e2e) in a shared flow | `tools/parity-report.mjs` |
| **Shared e2e flows** | The same user journey works on hybrid, iOS and Android | Maestro flows in `e2e/` |
| **Analytics diff** | The same journey emits the same events and properties | debug analytics sink + `tools/analytics-diff.mjs` |
| **Visual comparison** | Each state looks right and consistent (not pixel-identical) | Screenshots in `specs/features/<ID>/assets/{hybrid,ios,android}/`, compared by `parity-reviewer` |

## Test pyramid per platform

| Level | iOS | Android | Covers |
|---|---|---|---|
| Unit | Swift Testing | JUnit + coroutines-test + Turbine | ViewModel logic, validation, mapping, repositories with fakes |
| Contract | Decoding tests over `contracts/fixtures` | Same | API models match the backend on both platforms |
| UI / snapshot | swift-snapshot-testing on `XContent` | Roborazzi/Paparazzi on `XContent` | Every UI state renders (loading, empty, error, content) |
| E2E | Maestro (`e2e/`), shared | Maestro (`e2e/`), shared | Critical journeys across screens, real navigation |

Most ACs should be covered at unit level. Every P0 journey needs at least one e2e flow.

## Layout matrix (ADR-0017)

Every screen's `XContent` gets snapshot/screenshot tests for each layout below, using the same fixture states on both platforms:

| Layout | iOS (swift-snapshot-testing) | Android (Roborazzi or Paparazzi) |
|---|---|---|
| compact portrait | `.image(layout: .device(config: .iPhone13(.portrait)))` or a current-iPhone `.fixed` size | Robolectric qualifiers for a phone (e.g. `RobolectricDeviceQualifiers.Pixel5`) / `DeviceConfig.PIXEL_5` |
| compact landscape | `.iPhone13(.landscape)` | the same phone with `+land` / `orientation = LANDSCAPE` |
| expanded | an iPad config, or the iPhone Duo inner-display size from `iphone-duo-dual-pane-patterns` as `.fixed(width:height:)` | a tablet/foldable qualifier (e.g. `MediumTablet`) / `DeviceConfig.PIXEL_C` |
| iPad (if supported) | `.iPadPro12_9(.portrait)` / `.landscape` | — |

The API names are examples; use what your library version offers. The rule is the matrix, not the helper. Review
the images for clipping, overlap and unreachable controls. Two-pane layouts appear only where the spec asks. P0 e2e flows
also run on one large device per platform (§ Maestro).

## Tagging tests with AC IDs

The parity report greps test sources for AC IDs (`<FEATURE-ID>-AC<NN>`):

- **iOS:** `@Test("AUTH-LOGIN-AC01 invalid email shows error")`, or `// AC: AUTH-LOGIN-AC01` above the test.
- **Android unit:** ``@Test fun `AUTH-LOGIN-AC01 invalid email shows error`()``.
- **Android instrumented:** `// AC: AUTH-LOGIN-AC01` above a camelCase test name.
- **Maestro:** a `# AC: AUTH-LOGIN-AC01` comment in the flow, or the ID in `tags:`.

One test can cover several ACs (list them all). An AC can be covered by several tests. An AC marked `_Platforms: ios_`
(or `android`) needs a test only on that platform (guideline 03).

```bash
node tools/parity-report.mjs                       # print coverage for all features
node tools/parity-report.mjs --feature AUTH-LOGIN  # one feature
node tools/parity-report.mjs --out parity/STATUS.md --json parity/status.json
node tools/parity-report.mjs --strict              # CI: exit 1 if an implemented/verified feature has gaps
```

The report also flags **orphan IDs** and **approved specs that changed after approval** (hash mismatch). An orphan
ID that no spec defines (usually a typo) fails `--strict`. A reference to a *removed* AC is only a warning, because
the tests are updated in the next change of that feature.

With Maestro results, the report also shows pass/fail per platform, and `--strict` requires passing e2e results on both
platforms for `verified` features:

```bash
maestro test -e APP_ID=<ios bundle id> --format junit --output e2e/results/ios.xml e2e
maestro test -e APP_ID=<applicationId> --format junit --output e2e/results/android.xml e2e
node tools/parity-report.mjs --e2e-results e2e/results --strict
```

## Maestro: one flow, three apps

```
e2e/
  config.yaml          # flows: ["flows/**"], so subflows/ never run on their own
  flows/
    auth/login-success.yaml
    auth/login-invalid-email.yaml
  subflows/
    launch-clean.yaml
```

```yaml
# e2e/flows/auth/login-invalid-email.yaml
# AC: AUTH-LOGIN-AC01
appId: ${APP_ID}
tags: [AUTH-LOGIN, smoke]
---
- runFlow: ../../subflows/launch-clean.yaml
- tapOn:
    id: "login.emailField"
- inputText: "not-an-email"
- tapOn:
    id: "login.submitButton"
- assertVisible:
    id: "login.emailError"
- takeScreenshot: login-invalid-email
```

```bash
maestro test -e APP_ID=com.example.app e2e                        # the e2e/ folder: config.yaml picks up flows/**
maestro test -e APP_ID=com.example.app --include-tags=smoke e2e
```
Pass the **`e2e` folder**, not `e2e/flows`. Maestro reads `config.yaml` from the folder you pass. Without it, Maestro
only runs top-level files, and the nested `flows/<area>/*.yaml` are skipped.

- Select elements **only by id**, never by visible text (text changes with locale and copy edits).
- When a spec's *Form factors* lists a large/unfolded layout, run its P0 flows on a large device too (iPhone Duo inner
  display / a foldable or tablet emulator). Primary actions must stay reachable, not moved into overflow menus.
- For quick local checks, `android-emulator` (an on-demand skill) can drive the emulator. Maestro stays the parity gate.
- **Golden reference layout:** recordings of the hybrid app live in `e2e/golden/<platform>/<flow>/` (screenshots plus the
  analytics `.jsonl`), with `e2e/golden/README.md` noting the build SHA, device, OS and date of each recording. Maestro's
  `takeScreenshot` writes into Maestro's own test-output folder (often under `~/.maestro/tests/<run>/`). Copy the files into
  `e2e/golden/` after each run, or pass a test-output directory if your Maestro version supports it.
- **Flows waiting for access:** a journey that needs an account, data or secrets the team can't provide yet is still written,
  tagged `needs-account`, and listed in `e2e/golden/README.md` with who provides the access and by when. The analysis gate accepts
  it in that state (guideline 01). It must be recorded before any feature that uses it is `verified`.
- **Secrets and production:** running the hybrid app may need an untracked `.env` or production access. A human provides
  secrets locally. They're never committed, pasted into chat or read by agents. Whether a test account on production is acceptable
  is a product-owner and security decision, recorded in `analysis/HANDOFF.md`. Agents never type real credentials that reach a
  production backend.
- **Phase 1:** write the flows against the *hybrid* app. That records current behaviour and proves the flows work.
  If hybrid screens lack `testID`s, add them on a dedicated **`migration/test-hooks`** branch of the hybrid repo. That
  branch may only add `testID` props and the debug analytics sink. It never changes behaviour, and it's never shipped. It's the
  one sanctioned exception to "never modify `hybrid/`". When adding IDs isn't practical, use text selectors in the golden
  flow and switch them to ids when the native test IDs exist.
  Phase-1 flows carry the feature ID in `tags:`. Add the `# AC:` comments once the spec's ACs exist.
- **Phase 3+:** the same flows run against both native apps. The iOS `accessibilityIdentifier` and the Android
  `testTag` (with `testTagsAsResourceId = true`) both show up as `id`.
- Where a native idiom differs (e.g. Android system back), use a small platform-specific subflow selected by
  `runFlow: when: platform: Android`. Don't fork the whole flow.

## Analytics diff

1. Both native apps (and the hybrid app, on its `migration/test-hooks` branch) log every event in debug builds as a single line:
   `ANALYTICS {"name":"login_submitted","props":{"method":"email"}}`. On iOS, log with `Logger` at `.notice` level and
   `privacy: .public` (otherwise dynamic values show as `<private>`, and `log stream` skips debug/info). On Android, use `Log.i`.
2. Run the flow, capture device logs (`xcrun simctl spawn booted log stream ...` / `adb logcat`), and keep
   the lines that start with `ANALYTICS `. Save the hybrid run as `e2e/analytics/<flow>.expected.jsonl`.
3. Compare:
   ```bash
   node tools/analytics-diff.mjs e2e/analytics/login-success.expected.jsonl /tmp/ios-login-success.jsonl
   ```
   Missing events, extra events, order changes and property mismatches are reported. Properties listed with `--ignore`
   (timestamps, session IDs) are skipped.

## Visual comparison

- Save screenshots per state as `specs/features/<ID>/assets/hybrid/<state>.png`, `.../ios/<state>.png`,
  `.../android/<state>.png` (Maestro `takeScreenshot`, or snapshot-test output).
- `parity-reviewer` compares them side by side. It looks for **missing elements, wrong content, wrong hierarchy
  and broken states**, not pixel differences. Native idioms are expected to differ.

## CI gates

| Repo | Gate |
|---|---|
| `ios`, `android` | Build + lint + unit + snapshot tests on every PR. They use the committed generated files and can't run `contracts-sync` (there's no `contracts/`) |
| workspace | `spec.mjs check`, `sync-agents-md --check`, `contracts-sync --check`, `skills-sync --check`, `parity-report --strict` on every PR |
| nightly | Full Maestro suite on both apps (simulator/emulator farm or Maestro Cloud) with JUnit output → `parity-report --e2e-results`; analytics diffs for P0 flows |

**Workspace CI checkout.** `hybrid/`, `ios/` and `android/` are gitignored in the workspace repo, so the workspace
pipeline clones them itself. For each native repo, check out the branch with the same name as the workspace PR branch
(`feature/<ID>`) if it exists, otherwise the default branch. Then run the checks above. The native repos' CI can trigger
the workspace pipeline for the same branch name, so a native PR also shows parity status.
