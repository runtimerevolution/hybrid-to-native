# Hybrid → Native migration kit (and new native apps)

A workspace template for building one app as two native apps, **iOS (SwiftUI)** and **Android (Jetpack Compose)**,
where AI agents build every feature on both platforms at the same time from one spec. Two modes:
- **migration**: rewrite an existing **React Native / Expo** app (the evidence is its code);
- **new app**: start from product docs, Figma designs and workshops (guideline 15).

It contains guidelines, playbooks (Claude Code skills), subagents, templates (including both native project templates)
and dependency-free tools.

Use one workspace per app. Clone the three code repos inside it and point any agent at the workspace root.

```
<app>-workspace/                 ← this kit (its own git repo)
├── AGENTS.md  CLAUDE.md  PROJECT.md
├── guidelines/  templates/  tools/  skills/lock.json  .claude/{skills,agents}/  (.agents/skills: links into .claude/skills)
├── analysis/    specs/features/<ID>/    contracts/    e2e/    decisions/    parity/
├── hybrid/      ← React Native / Expo repo (read-only reference; migration mode only)
├── ios/         ← native iOS repo
└── android/     ← native Android repo
```

## Quick start

The short version is in [`KICKOFF.md`](KICKOFF.md): create a workspace for the app, open it in a new session, type `/kickoff`.
The details:

```bash
# 1. Create a workspace for one app (copies the kit, clones repos, seeds repo AGENTS.md files)
tools/init-workspace.sh ~/work/shop-native --hybrid git@…/shop-rn.git --ios git@…/shop-ios.git --android git@…/shop-android.git
#    …or, for a new app with no hybrid predecessor:
tools/init-workspace.sh ~/work/shop-native --new

# 2. Fill in PROJECT.md and accept the Phase 0 ADRs (decisions/README.md)

# 3. Open the workspace root in a new Claude Code session and start
claude
> /kickoff
```

Then, for every feature in a wave:

```text
node tools/spec.mjs new AUTH-LOGIN "Log in with email and password"
/spec-feature AUTH-LOGIN                         → specs/features/AUTH-LOGIN/spec.md (draft)
node tools/spec.mjs approve AUTH-LOGIN --by "Product owner"
/scaffold-native                                 → once, Phase 2: both native projects, built and running
/implement-slice SLICE-01                        → contracts → iOS ∥ Android agents → one review pass (default)
/implement-feature AUTH-LOGIN                    → feature mode, for risky features
node tools/parity-report.mjs --out parity/STATUS.md
```

## The loop

```
hybrid code (migration) ──┐
                          ├─▶ spec.md ──(human approves, hash)──▶ contract.md ──▶ ios-engineer      ─┐
PRD · Figma · workshops ──┘   neutral behaviour + ACs              shared names    android-engineer ─┤ in parallel
(new app)                                                                                            ▼
                               parity/STATUS.md ◀── parity-report ◀── review.md ◀── parity-reviewer
```

What keeps the two apps equal:
1. **Specs** with permanent AC IDs, approved by a human and protected by a content hash.
2. **Contracts** (API, strings, analytics, tokens) generated into both repos from one source.
3. A **mirrored architecture**: same modules, types, state, actions and effects on both platforms.
4. **Traceability**: every AC has a test on each platform, checked by `parity-report`.
5. **Shared e2e flows** (Maestro) that run unchanged on hybrid, iOS and Android, plus **analytics diffs**.
6. An independent **parity review** before both PRs merge together.
7. A **quality layer** of pinned platform skills (SwiftUI, Google Android, iPhone Duo, build optimization) with
   **platform quality reviewers** that preload them (guideline 14).

**Keeping things current:** [`HOW_TO_UPDATE.md`](HOW_TO_UPDATE.md) covers updating every third-party dependency and
skill, and proposing a skill's removal.

## Guidelines

| # | File | Read it when |
|---|---|---|
| 01 | [Migration plan](guidelines/01-migration-plan.md) | Planning phases, gates, roles, sizing |
| 02 | [Reading RN / Expo source](guidelines/02-reading-react-native-source.md) | Analysing `hybrid/` |
| 03 | [Feature specs](guidelines/03-feature-specs.md) | Writing or changing a spec |
| 04 | [Parallel agent workflow](guidelines/04-parallel-agent-workflow.md) | Building a feature on both platforms |
| 05 | [Mirrored architecture](guidelines/05-mirrored-architecture.md) | Naming, layers, UDF pattern, type mapping |
| 06 | [iOS guidelines](guidelines/06-ios-guidelines.md) | Any Swift/SwiftUI work |
| 07 | [Android guidelines](guidelines/07-android-guidelines.md) | Any Kotlin/Compose work |
| 08 | [Shared contracts](guidelines/08-shared-contracts.md) | API, tokens, strings, analytics, deep links |
| 09 | [RN → native mapping](guidelines/09-rn-to-native-mapping.md) | Replacing a library or pattern |
| 10 | [Testing and parity](guidelines/10-testing-and-parity.md) | Tests, Maestro, analytics diff, CI gates |
| 11 | [Cut-over and release](guidelines/11-cutover-and-release.md) | Store identity, data migration, rollout |
| 12 | [Long-term maintenance](guidelines/12-long-term-maintenance.md) | After launch, and keeping agent instructions healthy |
| 13 | [Agent skills and tools](guidelines/13-agent-skills-and-tools.md) | The wider landscape: MCP servers, IDE agents, instruction files |
| 14 | [Platform skills](guidelines/14-platform-skills.md) | Which pinned skills each agent loads, when, and what wins when they disagree |
| 15 | [New app](guidelines/15-new-app.md) | Starting an app with no hybrid: product sources, workshops, backend and design ADRs, launch |

## Tools (Node 18+, no dependencies; `--help` on each)

| Tool | Does |
|---|---|
| `tools/rn-inventory.mjs` | Scans the RN/Expo repo: routes, screens, deps (mapped to native), storage keys, API calls, analytics, testIDs, i18n, native modules, permissions, risks |
| `tools/spec.mjs` | `new` / `approve` (content hash) / `status` / `check` (the approval gate) / `list` (status, hash, unmet dependencies) for feature specs |
| `tools/parity-report.mjs` | AC coverage on iOS, Android and e2e, orphan IDs, spec drift, Maestro pass/fail (`--e2e-results`). `--strict` for CI |
| `tools/analytics-diff.mjs` | Compares two analytics event streams (hybrid vs native) from logs |
| `tools/contracts-sync.mjs` | Copies OpenAPI/fixtures and generates `.xcstrings` + typed `L10n.swift`, `strings.xml`, `AnalyticsEvent.swift/.kt`. `--check` for CI |
| `tools/sync-agents-md.mjs` | Copies the shared rules into `ios/AGENTS.md` and `android/AGENTS.md` (for single-repo agents) |
| `tools/deps-report.mjs` | One view of every third-party pin (SPM, version catalog, toolchains, skills), with vendor SDKs paired across platforms |
| `tools/skills-sync.mjs` | Vendors the pinned third-party platform skills from `skills/lock.json` (committed: nothing to fetch after cloning, nothing updates on checkout). `--check` (CI), `--outdated`, `--bump`, `--links` (rebuild `.agents/skills` offline; on Windows needs symlinks enabled, guideline 14) |
| `tools/init-workspace.sh` | Creates a new per-app workspace from this kit (records the kit version, creates `kit-feedback.md`). `--new` for a new app |
| `tools/scaffold-native.mjs` | Generates the iOS (XcodeGen + local Swift package) and Android (Gradle convention plugins) projects from `templates/native/`, seeds contracts, runs contracts-sync, XcodeGen and the Gradle wrapper |
| `tools/kit-update.mjs` | Pulls a newer kit into an existing workspace without touching the app's own files; `--status` shows the version and local changes to kit files |

## Using agents other than Claude Code

Everything is plain markdown. `AGENTS.md` is the tool-neutral entry point, and the playbooks in `.claude/skills/*/SKILL.md`
can be followed by any agent. `guidelines/04-parallel-agent-workflow.md` has a copy-paste prompt for running the two
platform sessions by hand. See `guidelines/13-agent-skills-and-tools.md` §4 for which files each tool reads.

## Kit changelog

| Version | Date | Change |
|---|---|---|
| 0.1.0 | 2026-09-28 | First version: guidelines 01–13, 6 playbooks, 4 subagents, 7 tools, templates |
| 0.7.1 | 2026-10-06 | Skills on checkout: documented that vendored skills are committed and never update on checkout (guideline 14, README, kit guide); `.gitignore` excludes Claude Code's `settings.local.json` and `worktrees/`; `skills-sync --check` reports links checked out as plain files (Windows without symlinks) with the fix instead of crashing, and `--links` / `kit-update` explain missing symlink permission |
| 0.7.0 | 2026-10-02 | **New-app mode** (`init-workspace --new`, guideline 15, `/define-product`, product handoff, sources index, workshop notes, product brief, backend ADR template, `PROJECT.new.md`; `/kickoff` and `spec.mjs new` detect the mode). **Native project templates** (`templates/native/ios`: XcodeGen + local Swift package; `templates/native/android`: AGP 9 convention plugins, Hilt, Navigation 3) with a sample feature, layout-matrix tests and CI, generated by `tools/scaffold-native.mjs` / `/scaffold-native`, built and run on both platforms. ADR-0006 default is now XcodeGen. contracts-sync emits lint-clean Swift |
| 0.6.0 | 2026-10-02 | Pilot feedback (20 items): **slice mode** as the default build loop (`/implement-slice`, `templates/slice.md`, `parity-report --slice`); editorial amendments and no-op re-approval (`spec.mjs amend`, change log out of the hash); `--find-apps --branches`; scanner skips assets/minified, reads `@env` and lockfile versions, flags placeholder bundle IDs; platform-scoped ACs; multi-bullet ACs; `InfoPlist.xcstrings`; never-shipped platforms; golden-flow layout and `needs-account`; Crashlytics upload opt-in; OpenAPI hygiene; state restoration rule |
| 0.5.1 | 2026-09-30 | `/kickoff <role>`: re-runnable role views (stakeholder, engineer, QA, analyst resume/refresh), switch roles any time |
| 0.5.0 | 2026-09-30 | Monorepo support: `rn-inventory --find-apps` / `--set-app`, `workspace.config.json`, local shared packages and hoisted `node_modules` followed automatically; `/kickoff` asks where the RN app is; `init-workspace --app` |
| 0.4.0 | 2026-09-30 | `KICKOFF.md` + `/kickoff` playbook, `kit-feedback.md` loop, `tools/kit-update.mjs` (version + safe updates), `analysis/HANDOFF.md` template, `VERSION`, kit guide page in `docs/` |
| 0.3.0 | 2026-09-29 | `HOW_TO_UPDATE.md` (all third-party updates + skill removal proposals), `tools/deps-report.mjs`; ADR-0016 and ADR-0017 accepted (every screen renders at any size/orientation; layout-matrix tests) |
| 0.2.0 | 2026-09-29 | Platform skills layer: 26 vendored skills at pinned commits (`skills/lock.json`, `tools/skills-sync.mjs`), guideline 14, `ios-`/`android-quality-reviewer`, *Form factors* in specs (ADR-0017), state-granularity rules from `swiftui-expert` |
