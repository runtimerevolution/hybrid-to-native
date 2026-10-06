# AGENTS.md — two-platform native workspace (hybrid → native migration, or a new app)

This folder is a **two-platform workspace**. It holds the guidelines, specs, shared contracts and
tools used to build one app as two native apps — **iOS (Swift + SwiftUI)** and
**Android (Kotlin + Jetpack Compose)** — with AI agents building every feature on both platforms
at the same time. `workspace.config.json` → `mode` says which kind:
- **migration** (the default): rewrite an existing React Native / Expo app that lives in `hybrid/`;
- **new**: a new app defined by product docs, designs and workshops (`analysis/sources/`). Read `guidelines/15-new-app.md`.

App-specific facts (names, bundle IDs, min OS, current phase) live in [PROJECT.md](PROJECT.md).
Read it before doing anything.

## Layout

| Path | What | Who writes it |
|---|---|---|
| `hybrid/` | Migration mode only. The existing React Native / Expo repo (git clone). In a monorepo, the app is a subfolder: see `workspace.config.json`. **Reference only — never modify.** Sole exception: the `migration/test-hooks` branch, which may only add `testID`s and a debug analytics sink (guideline 10) | nobody |
| `ios/` | Native iOS repo (git clone) | ios agent / iOS devs |
| `android/` | Native Android repo (git clone) | android agent / Android devs |
| `guidelines/` | How we work. Read the relevant file before each task (table below). | tech leads |
| `specs/features/<FEATURE-ID>/` | Platform-neutral feature spec, contract, impl notes, parity review | agents + product |
| `specs/slices/<SLICE-ID>.md` | A vertical slice: features in build order, demo goal, CCRs, slice reviews | orchestrator |
| `contracts/` | Single source of truth for API, design tokens, strings, analytics, deep links, flags | agents + leads |
| `e2e/` | Maestro flows shared by both apps (same flow runs on iOS and Android) | agents + QA |
| `analysis/` | Output of Phase 1: discovery on `hybrid/` (inventory, feature catalog, risks), or product definition in a new app (`sources/`, brief, feature catalog) | analyst agent |
| `decisions/` | Architecture Decision Records (ADRs) and the platform-divergence register | tech leads |
| `parity/` | Generated parity status report — do not hand-edit | `tools/parity-report.mjs` |
| `tools/` | Scripts (Node 18+, no dependencies) | — |
| `templates/` | Templates for specs, contracts, reviews, ADRs, per-repo AGENTS.md | — |
| `.claude/skills/`, `.claude/agents/` | Kit playbooks, **vendored platform skills** (pinned, see `skills/lock.json`) and subagent definitions. `.agents/skills` links here for other tools | — |
| `skills/` | `lock.json` (which third-party skills, pinned commits) and `installed.json` (generated) | tech leads |
| `workspace.config.json` | Where things are inside `hybrid/`: the RN app folder, local shared packages, backend and web folders (monorepos) | `/kickoff`, `rn-inventory --set-app` |

`hybrid/`, `ios/` and `android/` are separate git repositories. Commit in the repo you changed.

**Kit feedback:** when a kit tool, guideline, playbook or template is wrong, unclear or missing something for this app,
add an entry to `kit-feedback.md`, with no client code, secrets or personal data. Don't silently patch kit files.
`node tools/kit-update.mjs --status` lists the ones that were changed.

<!-- shared:begin rules -->
## Golden rules

1. **The spec is the source of truth, not the hybrid code** (nor, in a new app, the PRD or the designs). They are evidence
   used to write the spec. Once a spec is `approved`, implement the spec. If the spec and the evidence disagree,
   stop and ask. Don't guess.
2. **One feature, two platforms, one contract.** Never implement a feature on one platform
   without its `contract.md`. Both platforms use the same names for state, actions, effects,
   test IDs, string keys and analytics events.
3. **Functional parity, native idioms.** Business rules, data, analytics and accessibility must match.
   Visuals and interaction follow each platform's conventions (navigation, back, sheets, haptics).
   Record every intentional difference in the spec's *Platform differences* section.
4. **Don't port bugs, don't invent requirements.** If hybrid behaviour looks wrong, or the sources leave a gap, write it
   under *Open questions* in the spec. Don't copy it or fill it quietly.
5. **Every acceptance criterion has a test on both platforms.** The AC ID (e.g. `AUTH-LOGIN-AC03`)
   must appear in the test name or in an `// AC:` comment next to the test. `tools/parity-report.mjs`
   checks this.
6. **Never hand-edit generated code** (API clients, tokens, strings). Change `contracts/` and regenerate.
7. **Mirror the architecture.** Same module and type names on both sides. See `guidelines/05-mirrored-architecture.md`.
8. **Leave the build green.** Before you say you're done, run the platform's build, lint and tests (commands are in each
   repo's own `AGENTS.md`). Report what failed; never skip failures silently.
9. **Stay in your lane.** An agent working on one platform edits only that platform's repo and its
   own `impl-<platform>.md`. If the spec or contract is wrong, write a *Contract change request* in your impl notes,
   stop work on the affected part, and finish the rest.
10. **Small vertical slices.** One feature spec = something one agent session can build and test end-to-end.
<!-- shared:end rules -->

## Read this before that

| Task | Read first |
|---|---|
| Starting the process for this app, or "where are we?" | `KICKOFF.md` → the `kickoff` playbook |
| Understanding the plan / phases / what "done" means | `guidelines/01-migration-plan.md` |
| Starting a new app (no hybrid): product definition, backend and design decisions, launch | `guidelines/15-new-app.md` |
| Reading or analysing the React Native / Expo code | `guidelines/02-reading-react-native-source.md` |
| Writing or changing a feature spec | `guidelines/03-feature-specs.md` |
| Building a feature on both platforms | `guidelines/04-parallel-agent-workflow.md` |
| Naming, module layout, state/action/effect pattern | `guidelines/05-mirrored-architecture.md` |
| Any iOS code | `guidelines/06-ios-guidelines.md` + `ios/AGENTS.md` |
| Any Android code | `guidelines/07-android-guidelines.md` + `android/AGENTS.md` |
| API, tokens, strings, analytics, deep links, flags | `guidelines/08-shared-contracts.md` |
| Finding the native replacement for an RN/Expo library | `guidelines/09-rn-to-native-mapping.md` |
| Tests, Maestro flows, parity checks | `guidelines/10-testing-and-parity.md` |
| Store release, local data migration, cut-over | `guidelines/11-cutover-and-release.md` |
| Changing a feature after launch | `guidelines/12-long-term-maintenance.md` |
| External skills, MCP servers and tools | `guidelines/13-agent-skills-and-tools.md` |
| Which platform skills to load, and what wins when they disagree with the kit | `guidelines/14-platform-skills.md` |
| Updating dependencies, toolchains or skills; proposing a skill removal | `HOW_TO_UPDATE.md` |

## Playbooks

Step-by-step procedures live in `.claude/skills/<name>/SKILL.md`. Claude Code loads them as skills.
Other agents (Codex, Cursor, Copilot, Gemini) can open the file and follow it.

| Playbook | Use it to |
|---|---|
| `kickoff` | Start or resume the process for one role (re-runnable, e.g. `/kickoff stakeholder`): setup check, PROJECT.md, Phase 1 up to the handoff. Detects the mode |
| `define-product` | New app, Phase 1: index the sources, write the brief, run workshops, build the catalog and waves, and write the product handoff |
| `rn-analyze` | Run discovery on `hybrid/` and produce the `analysis/` pack and feature catalog |
| `spec-feature` | Write one feature's `specs/features/<ID>/spec.md` from the evidence (hybrid code, or product sources in a new app) |
| `scaffold-native` | Phase 2, both modes: generate the iOS and Android projects from `templates/native/`, then build, run and record the layout matrix |
| `implement-slice` | **Default build loop:** contracts for a vertical slice in one batch, iOS and Android build it in dependency order, app shown running early, one review pass |
| `implement-feature` | Feature mode, for risky features (data migration, payments, auth/security): contract, parallel build, per-feature reviews |
| `parity-review` | Compare both implementations against spec + contract; write `review.md` |
| `port-native-module` | Move a custom RN native module / Expo module into plain native code |
| `plan-data-migration` | Design how the native apps read data the hybrid app left on the device |

<!-- shared:begin conventions -->
## Conventions

- **Feature ID:** `AREA-NAME` in upper case, e.g. `AUTH-LOGIN`, `PROFILE-EDIT`, `CORE-SESSION`.
- **Acceptance criterion ID:** `<FEATURE-ID>-AC<NN>`, e.g. `AUTH-LOGIN-AC03`. IDs stay the same forever;
  when you remove an AC, mark it `(removed)`. Never reuse its number.
- **Spec status:** `draft → approved → in-progress → implemented → verified` (or `deferred` / `dropped`).
- **Slices:** `SLICE-NN` files in `specs/slices/` (template `templates/slice.md`).
- **Branches** (same name in both native repos): `slice/<SLICE-ID>` in slice mode, `feature/<FEATURE-ID>` in feature mode.
- **Commits:** `[<FEATURE-ID>] <imperative summary>`, in both modes. **PR titles:** `[<SLICE-ID>] <demo goal> (<FEATURE-IDs>)`
  or `[<FEATURE-ID>] <spec title>`, the same in both repos. Each PR links the spec(s) or slice, and its sibling PR.
- **Test IDs / accessibility identifiers:** reuse the hybrid `testID` verbatim when one exists; otherwise
  `<screen>.<element>` in lowerCamel, e.g. `login.emailField`.
<!-- shared:end conventions -->

## Tools

All tools are Node 18+ scripts with no dependencies. Run them from the workspace root. `--help` works on each.

```bash
node tools/rn-inventory.mjs --find-apps [--branches]                    # RN apps, backends, web apps (on each branch with --branches)
node tools/rn-inventory.mjs --set-app hybrid/apps/mobile                # save which folder is the RN app (workspace.config.json)
node tools/rn-inventory.mjs --out analysis/inventory                   # discovery scan of the RN/Expo app
node tools/spec.mjs new AUTH-LOGIN "Log in with email and password"     # scaffold specs/features/AUTH-LOGIN/
node tools/spec.mjs approve AUTH-LOGIN --by "Name"                      # record approval + content hash (or --slice SLICE-01)
node tools/spec.mjs amend AUTH-LOGIN --editorial "why" --by "who"       # wording-only edit to an approved spec
node tools/spec.mjs status AUTH-LOGIN implemented                       # move status
node tools/spec.mjs list                                                # all specs with status / hash check
node tools/parity-report.mjs --out parity/STATUS.md [--slice SLICE-01]  # AC coverage on iOS / Android / e2e
node tools/analytics-diff.mjs expected.jsonl actual.jsonl               # compare analytics event streams
node tools/contracts-sync.mjs [--check]                                 # push contracts into ios/ and android/
node tools/sync-agents-md.mjs [--check]                                 # copy shared rules into repo AGENTS.md files
node tools/skills-sync.mjs [--check | --outdated | --bump <id> | --links]  # vendor pinned platform skills; --links rebuilds .agents/skills
node tools/deps-report.mjs --out parity/DEPENDENCIES.md                 # all third-party pins, both platforms side by side
node tools/kit-update.mjs [--status | --from <kit-dir>]                 # kit version; pull a newer kit into this workspace
node tools/scaffold-native.mjs --name "Shop" --bundle-id com.acme.shop --dry-run  # iOS + Android projects from templates/native/
```
