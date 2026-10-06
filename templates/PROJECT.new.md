# PROJECT.md — app-specific facts (new app)

> New-app mode (`workspace.config.json` → `"mode": "new"`, guideline 15). Fill this in once per app. Agents load it on
> every session, so keep it short and factual. Put detail in `analysis/` and `decisions/` and link to it from here.

## Identity

| | iOS (native) | Android (native) |
|---|---|---|
| App name (store) | <!-- --> | <!-- same --> |
| Repo URL | <!-- --> | <!-- --> |
| Bundle ID / applicationId | <!-- permanent after the first upload: confirm with the product owner --> | <!-- usually the same --> |
| Stores and countries | <!-- App Store: which countries --> | <!-- Play: which countries --> |
| Developer account | <!-- Apple team (organisation?) and who owns it --> | <!-- Play Console account (organisation or personal) and who owns it --> |
| Min OS | <!-- ADR-0004, e.g. iOS 17 --> | <!-- ADR-0004, e.g. minSdk 26 --> |
| Devices | <!-- iPhone + iPad (universal, ADR-0017 default) / iPhone only --> | phones, foldables, tablets (ADR-0017) |
| Signing | <!-- automatic in dev; CI key owner --> | <!-- Play App Signing; upload key owner --> |
| Locales | <!-- base locale + others; copy owner --> | <!-- same --> |

## Product sources

| Source | Where | Owner |
|---|---|---|
| Written docs (PRD, briefs) | `analysis/sources/README.md` | <!-- --> |
| Designs | <!-- Figma file URL; Figma MCP server or exported frames (ADR-0019) --> | <!-- --> |
| Workshops | `analysis/sources/workshop-*.md` | <!-- --> |

## Backend

| | |
|---|---|
| Approach (ADR-0018) | <!-- existing API / contract-first in parallel / BaaS --> |
| Contract | <!-- contracts/openapi/api.yaml, or contracts/data-model.md for a BaaS --> |
| Mock / local backend | <!-- e.g. Prism mock from the contract, BaaS emulator --> |
| Backend team / owner | <!-- --> |

## Environments

| Env | API base URL | Notes |
|---|---|---|
| mock | <!-- local mock server, if contract-first --> | |
| dev | <!-- --> | |
| staging | <!-- --> | |
| prod | <!-- --> | |

## Current status

- **Phase:** <!-- 0 Setup | 1 Product definition | 2 Foundations | 3 Feature waves | 4 Hardening | 5 Launch | 6 Steady state -->
- **Current wave:** <!-- e.g. Wave 1: ONBOARD-*, AUTH-* -->
- **Release scope:** <!-- what the first store release contains (MVP), decided by the product owner -->
- **Parity status:** see `parity/STATUS.md` (generated)

## People

| Role | Name |
|---|---|
| Product owner (approves specs) | <!-- --> |
| Analysts (tech leads running product definition) | <!-- --> |
| Designer | <!-- --> |
| Backend lead | <!-- --> |
| iOS lead | <!-- --> |
| Android lead | <!-- --> |
| QA | <!-- --> |

## Working agreements

| Setting | Value |
|---|---|
| Contract approval by a human required for | P0 features (default) <!-- or: all / none --> |
| Build mode (guideline 04) | slice (default) <!-- or: feature --> |
| Feature mode required for | payments and purchases, auth/security-sensitive flows (default) |
| Contract approval | once per slice batch (default); per feature in feature mode |
| Platform quality reviewers (ios- / android-quality-reviewer) for | every slice; P0 and P1 features in feature mode (default) |
| Fix-loop limit before escalating | 3 rounds |
| Phone orientation policy (ADR-0017 §4) | all orientations (default for new apps) <!-- or: portrait only on phones --> |
| Workshop notes count as evidence once | the product owner confirms them (default) |
| Dependency and skill update owners | per `HOW_TO_UPDATE.md` §2 <!-- name the iOS/Android leads if different --> |

## Agent tooling installed

| Tool | Version | Where configured |
|---|---|---|
| Vendored platform skills (26) | pinned per source in `skills/lock.json` | `.claude/skills/` (+ `.agents/skills` symlink), `node tools/skills-sync.mjs` |

## Key decisions

See `decisions/`. Accepted so far:
- ADR-0001 Native stacks: SwiftUI + Jetpack Compose, two separate codebases
- ADR-0016 Platform skill set and precedence (updates and removals: `HOW_TO_UPDATE.md`)
- ADR-0017 Large screens and foldables: Option B, every screen renders correctly at any size and orientation
- ADR-0002 (full rewrite at parity) doesn't apply to a new app (guideline 15)
