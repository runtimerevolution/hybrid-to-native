# 13 — Agent skills, MCP servers and tools

What already exists that agents can use for this migration, and how it fits with this kit.
**The curated, pinned skill set we actually use, and its precedence rules, is in `14-platform-skills.md`.** This file
is the wider landscape: MCP servers, IDE agents, instruction-file behaviour, and spec tooling.
**Survey date: 2026-09-28.** This area changes monthly. Re-check it every quarter and before you adopt anything.
Items marked ⚠︎ could not be fully verified at survey time. Everything else was checked against its source page
on that date (links in §9). Several items are very recent, so confirm versions and names before relying on them.

## 1. What this kit provides

| Kind | Name | Purpose |
|---|---|---|
| Playbook / skill | `rn-analyze`, `spec-feature`, `implement-feature`, `parity-review`, `port-native-module`, `plan-data-migration` | The migration loop (`.claude/skills/`) |
| Subagent | `rn-analyst`, `ios-engineer`, `android-engineer`, `parity-reviewer`, `ios-quality-reviewer`, `android-quality-reviewer` | Roles in the loop (`.claude/agents/`) |
| Tool | `rn-inventory`, `spec`, `parity-report`, `analytics-diff`, `contracts-sync`, `sync-agents-md`, `skills-sync`, `init-workspace` | Deterministic checks and generation (`tools/`) |
| Vendored platform skills | 26 pinned third-party skills (`skills/lock.json`) | Platform craft, see `14-platform-skills.md` |

No public skill covers **RN/Expo → Swift/Kotlin migration** end to end. That's why the migration-specific
playbooks here are custom. Everything below complements them with platform expertise and device access.

## 2. Platform skills worth installing

| Skill set | Source | Use it for | Notes |
|---|---|---|---|
| **Android skills (official)** | `github.com/android/skills`. **Adopted:** vendored at a pinned commit by `skills-sync` (don't also install with `android skills add`, which would add a second, unpinned copy) | Compose, Navigation 3, edge-to-edge, AGP 9 upgrade, R8, security, testing setup (unit, Compose UI, Roborazzi/Paparazzi) | Google evaluates each skill and retires it once models no longer need it |
| **Xcode agent skills (Apple)** | Built into Xcode 27. Reported exportable with `xcrun agent skills export ~/.agents/skills` ⚠︎ | SwiftUI specialist, what's new, XCTest → Swift Testing, UIKit modernisation, device interaction | Use the export from your own Xcode. Community mirrors carry no licence to Apple's content |
| **SwiftUI / Concurrency / Testing / SwiftData "Pro" skills** (Paul Hudson). *Not adopted for SwiftUI (conflicts, see 14 §2); others not yet evaluated* | `github.com/twostraws/SwiftUI-Agent-Skill` | Fixes the SwiftUI mistakes LLMs typically make (deprecated APIs, VoiceOver gaps) | Community, widely used |
| **SwiftUI, Swift Concurrency, Swift Testing, Xcode build optimisation** (Antoine van der Lee) | `github.com/AvdLee` skill repos | Swift 6 concurrency migration, testing, build speed | Community, actively maintained |
| **Dimillian skills** | `github.com/Dimillian/Skills` | iOS debugger agent (drives MobileBuildMCP), SwiftUI patterns/performance, batch refactors | Community |
| **JetBrains skills** | `github.com/JetBrains/skills` | Java → Kotlin, Gradle Kotlin DSL, AGP 9 migration, Compose UI test server | Vendor |
| Community Android | `new-silvermoon/awesome-android-agent-skills`, `skydoves/compose-performance-skills`, `aldefy/compose-skill` | Architecture, accessibility, screenshot tests, Compose performance | Community. Review before adopting |
| Accessibility / localisation (iOS) | Listed in `twostraws/swift-agent-skills` | VoiceOver and localisation checks | `dpearson2699/swift-ios-skills` uses the **PolyForm Perimeter** licence. Check it before use |
| React Native side | `callstackincubator/agent-skills` | Helps the `rn-analyst` read and run the hybrid app | Vendor (Callstack) |

**Anthropic plugins** (`anthropics/claude-plugins-official`):
- `swift-lsp` / `kotlin-lsp`: language servers, so agents do fewer blind reads. `kotlin-lsp` is alpha, with experimental AGP support.
- `code-modernization`: assess → map → extract business rules as Given/When/Then → brief → transform → verify,
  with `legacy-analyst` and `business-rules-extractor` subagents. It overlaps with `rn-analyze` + `spec-feature`.
  **Try it on one feature** and compare its rule cards with our spec format before standardising.
- `code-review`, `pr-review-toolkit`, `feature-dev`, `firebase`, `figma`.

## 3. MCP servers (device, build, design, telemetry)

| Server | What | Status | Setup hint |
|---|---|---|---|
| **Xcode MCP** | Build, tests, previews, documentation search from Xcode | Apple, Xcode 26.3+ | `claude mcp add xcode -- xcrun mcpbridge` |
| **MobileBuildMCP** (formerly XcodeBuildMCP) | Build, test and run on simulators and devices, UI automation, logs, CLI mode | Sentry. Renamed 2026-09-23 | npm package `mobilebuildmcp`. Pin the version. Set `MOBILEBUILDMCP_SENTRY_DISABLED=true` to opt out of telemetry |
| **Maestro MCP** | Inspect screens, run flows, iOS and Android | Ships with the Maestro CLI | `claude mcp add maestro -- maestro mcp` |
| **agent-device** (Callstack) | CLI + MCP for native/RN apps; screenshots, video, logs; exports Maestro YAML | Community, used in production by large RN shops | Good for capturing golden screenshots of the hybrid app |
| **mobile-mcp** (mobile-next) | iOS/Android simulators, emulators and real devices | Community | Alternative to the above |
| **Figma MCP** + Code Connect | Design context; Code Connect maps one Figma component to **both** SwiftUI and Compose components | Figma | Remote server `mcp.figma.com/mcp` |
| **Sentry MCP** / **Firebase MCP** (Crashlytics) | Crash data for post-launch parity monitoring | Vendor | |
| App Store Connect / Play Console MCPs | Release tasks | **Community only**. Neither Apple nor Google ships one | Treat as untrusted; prefer fastlane / official APIs |
| `ios-simulator-mcp` | Simulator control | Community | Versions below 1.3.3 had a command-injection flaw |

Toolchains: **Android CLI 1.0** (`android create | emulator | run | skills | docs`) is Google's agent-oriented
CLI and replaces ad-hoc Gradle/adb scripting. On iOS, `xcodebuild` plus MobileBuildMCP or Xcode MCP cover the same ground.

## 4. How each agent tool finds instructions (and what this kit does about it)

| Tool | Reads | Consequence here |
|---|---|---|
| **Claude Code** | `CLAUDE.md` from the working directory **and every parent**. Nested `CLAUDE.md` loads when files there are read. Skills load only from the working directory up to the git root | Start sessions at the **workspace root** so the skills load. Root `CLAUDE.md` imports `AGENTS.md` + `PROJECT.md`. Each repo's `CLAUDE.md` is `@AGENTS.md` |
| **Xcode 26.3+ Claude / Codex agents** | `CLAUDE.md` next to the `.xcodeproj` (Claude). Codex reads `AGENTS.md`. Xcode 27 adds ACP agents, MCP and custom skills ⚠︎ (native `AGENTS.md` support in Xcode 27 is unconfirmed) | Keep `ios/CLAUDE.md` + `ios/AGENTS.md` at the repo root next to the project |
| **Android Studio agent (Gemini)** | `AGENTS.md` in the current directory and parents (`GEMINI.md` takes precedence), MCP, skills. "Bring your own agent" (Claude/Codex over ACP) is in canary | Opening `android/` still finds the workspace `AGENTS.md` above it |
| **Codex** | `AGENTS.md` from the git root down to the working directory. **Nothing above the git root.** Skills in `.agents/skills` | Codex inside `ios/` never sees the workspace → shared rules are synced into repo `AGENTS.md` (`tools/sync-agents-md.mjs`) |
| **Cursor** | Root and nested `AGENTS.md`, `.cursor/rules/*.mdc` | Works from the workspace root |
| **GitHub Copilot** | `.github/copilot-instructions.md`, `.github/instructions/*.instructions.md`, nearest `AGENTS.md`. The cloud agent sees one repo only | Repo `AGENTS.md` must stand alone. Paste spec + contract into cloud tasks |

`skills-sync` maintains `.agents/skills` as links to the **model-invocable** skills only (on-demand skills stay out,
because those tools ignore `disable-model-invocation`). To share further,
or publish them as an internal Claude Code plugin marketplace once they've stabilised.

## 5. Spec-driven tooling: alternatives to this kit's spec format

| Tool | Fit for "one spec → two implementations" |
|---|---|
| **OpenSpec** | Built for existing codebases. "Stores" (beta) keeps specs in one repo shared by several code repos. Strong candidate if you outgrow this kit's format |
| **GitHub Spec Kit** | constitution → specify → plan → tasks → implement. Supports many agents. Single-project oriented, so you'd run plan/tasks once per platform |
| BMAD Method | Heavy role-based process. Probably more than you need |
| Kiro specs | IDE-bound. Its **EARS** requirement syntax is worth borrowing if Given/When/Then feels loose |

Decide in ADR-0010. The kit's tools depend only on the front matter and the `<ID>-ACnn` convention, so another format is
easy to adopt if it keeps those two things.

## 6. Prior art: Shopify's RN → native rewrite (Sept 2026)

Shopify published how they rebuilt the Shop app from React Native to native with agents, in about 12 weeks with a
small core team. Their tools aren't open source, but the ideas carry over. This kit adopts them:

| Their practice | Here |
|---|---|
| The React Native app is the spec | `rn-analyze` + `spec-feature`, with evidence citations |
| Subagents: inspect → document → plan per platform → implement → review parity | `rn-analyst` → spec → contract → `ios-engineer` ∥ `android-engineer` → `parity-reviewer` |
| Small checkpoints, each passing gates | Checkpoint commits per AC group. Gates: tests, parity report, reviewer, human merge |
| Plan approval bound to a content hash | `spec.mjs approve` stores `approved_hash`. `spec.mjs check` / `parity-report --strict` fail on drift |
| Screenshot and analytics comparison between RN and native | `assets/{hybrid,ios,android}/` visual review + `analytics-diff.mjs` over Maestro runs |
| Two adversarial reviewers | Independent `ios-quality-reviewer` / `android-quality-reviewer` alongside the parity reviewer (P0 + P1 by default) |

## 7. Recommended setup, in order

1. This kit, used from the workspace root, with `AGENTS.md` synced into both repos.
2. Maestro CLI (+ Maestro MCP). One e2e suite for hybrid, iOS and Android.
3. iOS: Xcode MCP and/or MobileBuildMCP (pinned, telemetry off). Skills: the vendored set in guideline 14 (Apple's exported Xcode skills are the next candidate to trial).
4. Android: Android CLI (the vendored Google skills come from `skills/lock.json`, not `android skills add`), and Android Studio agent mode for in-IDE work.
5. `swift-lsp` / `kotlin-lsp` plugins (treat `kotlin-lsp` as alpha).
6. Figma MCP + Code Connect if the design lives in Figma.
7. `code-modernization` plugin: trial it on one feature.
8. Post-launch: Sentry / Firebase MCP for crash parity.

## 8. Safety and hygiene

- **Read a skill before installing it.** Skills and MCP servers run with your agent's permissions. Prefer vendor
  sources, pin versions, and keep a list of what's installed in `PROJECT.md`.
- **Check licences** (PolyForm, Apple content) before committing third-party skill text into your repos.
- **Opt out of telemetry** in MCP servers that send it by default, unless the team has agreed to it.
- **Least privilege:** read-only roles (`rn-analyst`, `parity-reviewer`) get read-only tools. Store and console
  credentials never go into agent-accessible config.
- **Retire** skills the models no longer need. Vendors do this too. Fewer instructions mean less confusion.

## 9. Sources (as surveyed on 2026-09-28)

| Item | Where to verify |
|---|---|
| Android skills | https://github.com/android/skills · Android CLI docs on developer.android.com |
| Paul Hudson skills / index | https://github.com/twostraws/SwiftUI-Agent-Skill · https://github.com/twostraws/swift-agent-skills |
| Antoine van der Lee skills | https://github.com/AvdLee |
| Dimillian skills | https://github.com/Dimillian/Skills |
| JetBrains skills | https://github.com/JetBrains/skills |
| Community Android skills | https://github.com/new-silvermoon/awesome-android-agent-skills · https://github.com/skydoves/compose-performance-skills · https://github.com/aldefy/compose-skill |
| Callstack (RN skills, agent-device) | https://github.com/callstackincubator |
| Anthropic plugins (`swift-lsp`, `kotlin-lsp`, `code-modernization`, …) | https://github.com/anthropics/claude-plugins-official |
| MobileBuildMCP (formerly XcodeBuildMCP) | https://github.com/getsentry/MobileBuildMCP (check the rename and package name) |
| mobile-mcp | https://github.com/mobile-next/mobile-mcp |
| Maestro MCP | Maestro CLI docs (`maestro mcp`), https://docs.maestro.dev |
| Figma MCP / Code Connect | Figma developer docs (remote server `https://mcp.figma.com/mcp`) |
| Xcode 26.3 / 27 agent features, `xcrun mcpbridge`, skills export ⚠︎ | Xcode release notes on developer.apple.com (skills export was reported by community write-ups) |
| Android Studio agent mode, AGENTS.md, "bring your own agent" | Android Studio release notes / Android Developers blog |
| AGENTS.md standard | https://agents.md |
| OpenSpec · Spec Kit · BMAD | https://github.com/Fission-AI/OpenSpec · https://github.com/github/spec-kit · https://github.com/bmad-code-org/BMAD-METHOD ⚠︎ (check the org names) |
| Shopify RN → native posts (Sept 2026) | Shopify Engineering blog: "Native is now the future of mobile", "Migrating Shop app", "Helix" |

