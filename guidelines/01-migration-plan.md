# 01 — Migration plan

> **New app, no hybrid?** The same phases with a different start and end: read `15-new-app.md` first.

**Strategy (ADR-0002):** full rewrite. Both native apps are built from scratch while the hybrid app stays
live. We cut over when the native apps reach **functional parity**. The native builds then ship as an
update to the same store listings (same bundle ID / applicationId), so users keep the app and their data.

## What "parity" means

| Must match exactly | Should feel native (may differ) |
|---|---|
| Features, flows, business rules, validation | Navigation chrome, transitions, gestures |
| Data sent to and read from the backend | Pickers, sheets, alerts, share sheet |
| Analytics event names and properties | Typography scale (within the design system) |
| Deep links and push notification handling | Haptics, pull-to-refresh style |
| Accessibility coverage and test IDs | System back behaviour (Android) |
| Locally stored user data survives the upgrade | Widgets, shortcuts (only if in scope) |

Every intentional difference goes in the spec (*Platform differences*) and in `decisions/divergences.md`.

## Phases and gates

```
Phase 0 Setup ─▶ 1 Discovery ─▶ 2 Foundations ─▶ 3 Feature waves (repeat) ─▶ 4 Hardening ─▶ 5 Cut-over ─▶ 6 Steady state
```

### Phase 0: Setup and decisions
- Create the workspace (`tools/init-workspace.sh`), clone `hybrid/`, create empty `ios/` and `android/` repos,
  fill in `PROJECT.md`.
- Decide and record ADRs (see `decisions/README.md`): min OS versions, navigation, DI, networking,
  persistence, effects pattern, analytics SDK, contracts distribution, CI. **ADR-0016** (platform skills) and **ADR-0017**
  (every screen renders at any size and orientation, plus two-pane where specs ask) are already accepted. Set the phone
  orientation policy in `PROJECT.md` and name the update owners (`HOW_TO_UPDATE.md` §2).
- Vendor the pinned platform skills (`node tools/skills-sync.mjs --check` passes) and list them in `PROJECT.md`
  (`guidelines/14-platform-skills.md`).
- Get access you'll need later: Apple team, App Store Connect, Play Console, signing keys
  (for EAS-managed apps, pull them with `eas credentials`), Firebase/Sentry projects, backend docs.
- Record baseline metrics for the hybrid app: crash-free sessions, cold start, app size, store rating,
  key funnel conversion. You'll compare the native apps against these.
- **Freeze policy for hybrid:** only critical fixes from now on. Any hybrid change must also update the matching spec,
  or the target keeps moving.

**Gate:** ADRs accepted, `PROJECT.md` complete, everyone can build the hybrid app locally.

### Phase 1: Discovery (read the hybrid code)
- Run the `rn-analyze` playbook. It produces `analysis/inventory/` (generated) and
  `analysis/{architecture,feature-catalog,integrations,data-at-rest,native-code,risks}.md`.
- Record the **golden reference**: Maestro flows, screenshots and analytics streams of the *hybrid* app for every
  critical journey (see `10-testing-and-parity.md`). Missing `testID`s and the debug analytics sink go on the hybrid
  `migration/test-hooks` branch, never on the shipping branch. The same flows later run against both native apps.
- Turn the feature catalog into **waves**, ordered by dependency **and by how soon they produce UI**. Typical order:
  app shell + session + login + main screen (the first tappable slice) → primary journeys → secondary features →
  settings, edge cases. Risky non-UI features (local data migration) run in feature mode alongside and never block the first screen.

**Gate: analysis handoff.** Analysis always comes first. No work reaches the development team until this gate passes.
Analysts (tech leads) hand over the `analysis/` pack and the app's brief, and the product owner and the other platform
lead accept it when:
- every route and screen maps to one feature ID (or is marked out of scope);
- every value stored on the device has a decision (migrate / keep / drop), and `analysis/data-migration.md` exists;
- every high-risk dependency has a native replacement or an open question;
- risks are ranked, each with an owner;
- golden Maestro flows are recorded for every critical journey. A flow that needs an account, data or secrets
  the team can't provide yet may instead be **specified** (written, tagged `needs-account`) with an owner who provides the
  access and a date. It must be recorded before any feature that uses it is `verified` (guideline 10 § Golden reference);
- the store status of each platform is known (shipped / never shipped). A never-shipped platform means a new listing, no upgrade path
  and no data migration for it (guideline 11 § Platform not shipped yet);
- orientation locks and iPad support are noted for the specs' *Form factors*;
- the product owner has reviewed the feature catalog and the waves.

### Phase 2: Contracts and foundations ("walking skeleton")
- `contracts/`: OpenAPI spec (derive it from the hybrid API layer if the backend has none), design tokens,
  strings (from the hybrid i18n files), analytics event schema, deep-link table, feature-flag keys, error codes.
- Native skeletons **on both platforms at once**, mirroring each other (`05-mirrored-architecture.md`). Start with
  `/scaffold-native`: it generates both projects from `templates/native/` (app shell, core modules, design system,
  analytics sink, one sample feature, layout-matrix tests, CI) and shows both running. Then add what the app needs:
  persistence, crash reporting, feature flags, the generated API client, a debug menu (environment switch).
  The adaptive shell follows ADR-0017: system bars, edge-to-edge, size-class-driven navigation.
- Build baselines with the on-demand skills: Xcode build analysis (recommend-only) and Gradle build performance.
  Record the numbers so later regressions are visible (`14-platform-skills.md` §3).
- **The first engineering milestone is a tappable vertical slice** on both platforms (launch → log in → main screen),
  built in slice mode (guideline 04) and shown running on simulator/emulator before reviews. One shared Maestro flow passes on both.

**Gate:** CI green on both repos. The shared Maestro smoke flow passes on both. `parity-report` runs in CI.

### Phase 3: Feature waves (repeat per wave)
Each wave is built as one or more **slices** (guideline 04, `implement-slice`):

1. `spec-feature` for the slice's features → drafts → product owner approves them together (`spec.mjs approve --slice`)
2. `implement-slice` → contracts in one batch → iOS and Android sessions build the slice in dependency order → app shown running
3. One review pass for the slice (parity + iOS quality + Android quality) → editorial amendments acknowledged → human
   code review on both PRs → merge both → features `implemented`
4. Shared e2e flows green on both → `verified`

Risky features (local data migration, payments, auth/security-sensitive) use feature mode (`implement-feature`).

At the end of each wave: regenerate `parity/STATUS.md`, demo both apps side by side, and update
guidelines with what agents got wrong (see `12-long-term-maintenance.md`).

**Gate per feature:** status `verified`. **Gate per wave:** no `implemented` feature with uncovered ACs
(`parity-report --strict`).

### Phase 4: Hardening
- Upgrade test on both tracks (`11-cutover-and-release.md` § Local data migration): the automated local fidelity
  test (production hybrid commit rebuilt debuggable → native build over it), and the real-path test (store hybrid →
  TestFlight / Play internal testing). Session, settings, drafts and caches must survive (see `plan-data-migration`).
- Performance vs baseline, accessibility audit (VoiceOver / TalkBack), localisation QA for every locale,
  offline and poor-network behaviour, security review (storage, TLS pinning, logging of PII). Use the hardening
  skills: SwiftUI trace analysis, Android profiler, Compose performance audit, R8 analyzer, the security skills, and the
  layout-matrix review on real large devices, and the iPhone Duo readiness audit (`14-platform-skills.md` §3).
- Store assets, privacy manifests / data safety forms, and review notes.

**Gate:** all waves `verified`, upgrade test passes on both platforms, performance at or better than baseline.

### Phase 5: Cut-over
- Beta: TestFlight external testing + Play closed testing, with real users on the upgrade path.
- Release with **App Store phased release** and **Play staged rollout**. Roll out on the same day on both platforms unless an ADR says otherwise.
- Decide kill criteria in advance (crash-free below X, login failure above Y) and a response for each.
  You can't roll a binary back. The fallback is halting the rollout, a hotfix, or remote-config kill switches.
  Pausing an iOS phased release doesn't stop manual updates or new installs (see `11-cutover-and-release.md`).
- Keep the hybrid repo buildable until the native apps have been at 100% rollout for a full release cycle.

### Phase 6: Steady state
Both native apps evolve together using the same spec → contract → parallel build loop
(`12-long-term-maintenance.md`).

## Roles

| Role | Human or agent | Responsibilities |
|---|---|---|
| Analysts | human (tech leads / senior engineers) + `rn-analyst` | Run discovery, write the analysis pack and draft specs, and present the analysis handoff |
| Product owner | human | Approves feature catalog and specs; decides open questions and "port the bug?" cases |
| iOS lead / Android lead | human | Own their platform guideline and repo `AGENTS.md`; review and merge PRs |
| QA | human | Owns `e2e/`, the upgrade test, and release sign-off |
| `rn-analyst` | agent | Reads `hybrid/`; answers questions with file:line evidence; drafts specs |
| `ios-engineer` / `android-engineer` | agent | Implement a contract in their repo; write tests; report deviations |
| `parity-reviewer` | agent | Checks both implementations against spec and contract; writes `review.md` |
| Orchestrator | agent (main session) | Writes the contract, runs the platform agents and reviewers, moves spec status |

**Human checkpoints (never automated away):** spec approval, contract approval for P0 features,
merge of every PR, release decisions.

## Sizing and tracking

- A feature spec should fit in **one agent session per platform**. That usually means one screen or one flow, around 10 ACs or fewer.
  Split larger ones (`CHECKOUT-CART`, `CHECKOUT-PAYMENT`, ...).
- Track status in each spec's front matter. `parity/STATUS.md` is the dashboard. Put issue-tracker links in the spec, not
  the other way round.
- Useful metrics: features `verified` / total, AC coverage per platform, platform lag (days between the
  first and the second platform merging a feature; aim for 0), rework rate after parity review.

## Common failure modes (and the rule that prevents them)

| Failure | Prevention |
|---|---|
| Native apps copy RN quirks and bugs | Rule 4. Specs describe intended behaviour; oddities go to *Open questions* |
| Platforms drift in naming/behaviour | Mandatory `contract.md` + parity review before merge |
| Hybrid keeps changing during the rewrite | Freeze policy + spec change log |
| Users logged out / data lost on upgrade | `plan-data-migration` in Phase 1, upgrade test in Phase 4 |
| Analytics dashboards break at cut-over | Event names come from `contracts/analytics`, taken verbatim from hybrid |
| Deep links / universal links stop working | Deep-link table in contracts + AASA / assetlinks checks in Phase 4 |
| Agents stall on huge features | Sizing rule above |
| `.pbxproj` merge hell on iOS | XcodeGen (the kit template) or synchronized folders / Tuist; the `.xcodeproj` is never hand-edited (see `06-ios-guidelines.md`) |
