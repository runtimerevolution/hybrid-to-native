# contracts/

Single source of truth for everything both apps must share. Rules and formats: `guidelines/08-shared-contracts.md`.

| Path | Content | Reaches the apps via |
|---|---|---|
| `openapi/*.yaml` | Backend API (operationIds are used in specs). New app: written first if the backend is contract-first (ADR-0018) | `tools/contracts-sync.mjs` copy → generator in each build |
| `data-model.md` | New app on a BaaS only (ADR-0018 option C): entities, fields, types, who can read and write | read by both platforms' repositories; rules tested in the backend repo |
| `fixtures/<operationId>/*.json` | Real responses for decoding tests on both platforms | `contracts-sync` copy |
| `design-tokens/tokens.json` | Colours, type, spacing, radii (W3C design tokens) | Style Dictionary |
| `strings/<locale>.json` | UI strings, i18next format: keys verbatim from hybrid, or `<feature>.<screen>.<element>` in a new app | `contracts-sync` → `.xcstrings` / `strings.xml` |
| `analytics/events.json` | Every analytics event and its properties | `contracts-sync` → `AnalyticsEvent.swift` / `.kt` |
| `deeplinks.md` | URL patterns ↔ routes ↔ features | hand-written parsers + table-driven tests |
| `flags.md` | Feature flag / remote config keys | hand-written `FeatureFlag` enums |
| `errors.md` | Backend error codes → `AppError` → string key | hand-written mapping + tests |

`sync.config.json` says where each artefact goes in `ios/` and `android/`. The defaults match the kit's native templates, and
`/scaffold-native` points the Android analytics path at the app's package. Adjust the paths if your repos differ.

```bash
node tools/contracts-sync.mjs          # write
node tools/contracts-sync.mjs --check  # CI drift check
```
