# decisions/

Architecture Decision Records (template: `templates/adr.md`) and the platform-divergence register.
When an ADR changes how agents should work, update the affected guideline **in the same PR**.

## Accepted

| ADR | Decision |
|---|---|
| [ADR-0001](ADR-0001-native-stacks.md) | SwiftUI + Jetpack Compose, two separate native codebases |
| [ADR-0002](ADR-0002-full-rewrite.md) | Full rewrite, ship when at functional parity |
| [ADR-0016](ADR-0016-platform-skills.md) | Curated platform skill set, vendored at pinned commits, with precedence rules; updates and removal proposals via `HOW_TO_UPDATE.md` |
| [ADR-0017](ADR-0017-large-screens-and-foldables.md) | Option B: every screen renders correctly at any size and orientation (minimum), plus two-pane where the spec asks |

## To decide in Phase 0 (recommended default in bold)

| # | Topic | Options | Where it's used |
|---|---|---|---|
| 0003 | One-off UI events | **Effects stream (AsyncStream / Channel)** · events as state | `05-mirrored-architecture.md` |
| 0004 | Minimum OS | **iOS 17 / Android minSdk = hybrid's current**, checked against analytics | `06`, `07` |
| 0005 | Android navigation | **Navigation 3** · type-safe Navigation Compose | `07` |
| 0006 | iOS project generation | **XcodeGen (the kit template, `/scaffold-native`)** · Xcode synchronized folders · Tuist | `06` |
| 0007 | Persistence | iOS **GRDB** or SwiftData · Android **Room**, plus DataStore/UserDefaults for prefs | `06`, `07`, `11` |
| 0008 | Networking / codegen | **swift-openapi-generator + Retrofit/OkHttp (openapi-generator)** · Ktor | `08` |
| 0009 | DI | iOS **initialiser injection + composition root** · swift-dependencies; Android **Hilt** · Koin | `05`, `06`, `07` |
| 0010 | Spec tooling | **This kit's spec format** · OpenSpec · GitHub Spec Kit (see `13-agent-skills-and-tools.md`) | `03`, `04` |
| 0011 | Contracts distribution | **Generated + committed into each repo, CI drift check** · git submodule · package | `08` |
| 0012 | CI | GitHub Actions / Bitrise / Xcode Cloud + Gradle; Maestro Cloud or device farm for e2e | `10` |
| 0013 | Legacy data migrator retirement | Remove when < X% of upgrades come from hybrid versions | `11` |
| 0014 | SDK vendors (analytics, crash reporting, flags, push, payments) | **Same vendors as the hybrid app, same on both platforms** | `09`, `11` |
| 0015 | Hybrid test-hooks branch | **`migration/test-hooks`: only testIDs + debug analytics sink, never shipped** | `10` |
| 0018 | Backend approach (new apps) | Existing API · **contract-first in parallel, with a mock** · BaaS (template `templates/adr-backend-approach.md`) | `15`, `08` |
| 0019 | Design source (new apps) | **Figma via its MCP server, variables → design tokens** · exported frames + tokens JSON | `15`, `08` |

**New app** (`"mode": "new"`, guideline 15): ADR-0002 doesn't apply, and neither do 0013 and 0015. 0004 is decided from
market data (no hybrid analytics), and 0014 picks the vendors once, the same on both platforms.

Skill trials, bumps and removals are logged in [skills-evaluations.md](skills-evaluations.md). Removal proposals live in [skill-proposals/](skill-proposals/) (`HOW_TO_UPDATE.md` §10).

## Divergences

Approved platform differences live in [divergences.md](divergences.md).
