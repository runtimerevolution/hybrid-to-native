# PROJECT.md — app-specific facts

> Fill this in once per app. Agents load it on every session, so keep it short and factual.
> Put detail in `analysis/` and `decisions/` and link to it from here.

## Identity

| | Hybrid (today) | iOS (native) | Android (native) |
|---|---|---|---|
| App name | <!-- --> | <!-- same --> | <!-- same --> |
| Repo URL | <!-- --> | <!-- --> | <!-- --> |
| App folder (monorepos) | <!-- e.g. apps/mobile; backend: services/api; web: apps/web (workspace.config.json) --> | — | — |
| Store status | — | <!-- shipped / never shipped (new listing → ADR) --> | <!-- shipped / never shipped --> |
| Bundle ID / applicationId | <!-- --> | **must equal hybrid** (if shipped) | **must equal hybrid** (if shipped) |
| Current store version | <!-- --> | — | — |
| RN version / Expo SDK | <!-- e.g. RN 0.79 / Expo SDK 53 --> | — | — |
| Workflow | <!-- bare RN / Expo managed (CNG) / Expo prebuild committed --> | — | — |
| OTA updates | <!-- expo-updates channel / none --> | n/a | n/a |
| Min OS | <!-- iOS x / Android API y --> | <!-- ADR-00xx --> | <!-- ADR-00xx --> |
| Signing | <!-- EAS-managed? where are keys? --> | <!-- team ID --> | <!-- keystore owner / Play App Signing --> |

## Environments

| Env | API base URL | Notes |
|---|---|---|
| dev | <!-- --> | |
| staging | <!-- --> | |
| prod | <!-- --> | |

## Current status

- **Phase:** <!-- 0 Setup | 1 Discovery | 2 Foundations | 3 Feature waves | 4 Hardening | 5 Cut-over | 6 Steady state -->
- **Current wave:** <!-- e.g. Wave 2: AUTH-*, HOME-* -->
- **Hybrid change policy:** <!-- e.g. critical fixes only; each change must be mirrored in specs -->
- **Parity status:** see `parity/STATUS.md` (generated)

## People

| Role | Name |
|---|---|
| Analysts (tech leads running discovery) | <!-- --> |
| Product owner (approves specs) | <!-- --> |
| iOS lead | <!-- --> |
| Android lead | <!-- --> |
| QA | <!-- --> |

## Working agreements

| Setting | Value |
|---|---|
| Contract approval by a human required for | P0 features (default) <!-- or: all / none --> |
| Build mode (guideline 04) | slice (default) <!-- or: feature --> |
| Feature mode required for | local data migration, payments and purchases, auth/security-sensitive flows (default) |
| Contract approval | once per slice batch (default); per feature in feature mode |
| Platform quality reviewers (ios- / android-quality-reviewer) for | every slice; P0 and P1 features in feature mode (default) |
| Fix-loop limit before escalating | 3 rounds |
| Hybrid test-hooks branch | `migration/test-hooks` |
| Phone orientation policy (ADR-0017 §4) | same as hybrid (default) <!-- or: all orientations --> |
| Dependency and skill update owners | per `HOW_TO_UPDATE.md` §2 <!-- name the iOS/Android leads if different --> |

## Agent tooling installed

<!-- Skills, plugins and MCP servers in use, with versions (see guidelines/13 §8 and guidelines/14). -->

| Tool | Version | Where configured |
|---|---|---|
| Vendored platform skills (26) | pinned per source in `skills/lock.json` | `.claude/skills/` (+ `.agents/skills` symlink), `node tools/skills-sync.mjs` |

## Key decisions

See `decisions/`. Accepted so far:
- ADR-0001 Native stacks: SwiftUI + Jetpack Compose, two separate codebases
- ADR-0002 Strategy: full rewrite, ship when at parity
- ADR-0016 Platform skill set and precedence (updates and removals: `HOW_TO_UPDATE.md`)
- ADR-0017 Large screens and foldables: Option B, every screen renders correctly at any size and orientation
