# 14 — Platform skills: the quality layer

The kit's guidelines define **what we build and how the two apps stay equal**. Platform skills bring **current
platform craft**: modern APIs, performance, accessibility, security, new form factors. That knowledge changes faster
than we could maintain it ourselves. This guideline says which skills we use, who loads them and when, and what wins
when they disagree with the kit.

The set is pinned in [`skills/lock.json`](../skills/lock.json) and vendored into `.claude/skills/` by
`node tools/skills-sync.mjs`. Every vendored skill has a `SOURCE.md` (upstream, commit, licence) and a *Kit note* at the
top of its `SKILL.md` that points back here. `.agents/skills` is a folder of links to the model-invocable skills only,
for Codex, Cursor and Gemini (on-demand skills stay out, so those tools can't trigger them implicitly).

**Committed, not downloaded.** The vendored copies and the links are committed (ADR-0016), so a clone works with nothing to
fetch and every skill change arrives as a reviewed diff. Skills never update on checkout: bumps follow `HOW_TO_UPDATE.md`
§8. CI runs `skills-sync --check`, which fails if a copy was edited by hand or doesn't match the lock. If the links are
missing or broken, `node tools/skills-sync.mjs --links` rebuilds them offline. **Windows:** git checks symlinks out as
plain text files unless symlinks are enabled. Turn on Developer Mode, run `git config core.symlinks true`, then
`git checkout -- .agents` (or re-clone). `--check` detects the plain files and prints the same fix.

## 1. Precedence

1. The approved **spec and contract** (behaviour, names, test IDs, strings, analytics)
2. **Kit guidelines** (05–12) and accepted **ADRs**
3. **Vendor-official skills** (Google `android/skills`; Apple's Xcode skills when adopted)
4. **Curated community skills** (AvdLee, iPhone Duo, community Android)

When a skill contradicts a higher level, follow the higher level. If the skill's advice is better, open a PR that changes
the guideline. Never deviate silently. Reviewers must not flag code that follows the kit over a skill. Section 4 lists
every known conflict.

## 2. The curated set

**Modes:**
- **preloaded**: injected into a subagent at start via its `skills:` frontmatter.
- **auto**: the model may invoke it while working on files in the skill's `paths` (`ios/**` or `android/**`).
- **on demand**: `disable-model-invocation: true`. Only a **human** invokes it (`/name`). Phase steps below that use one are
  marked *(human)*.
- **off**: listed in the lock with `"enabled": false`. Flip the flag when a feature needs it.

The model can't invoke on-demand skills through the Skill tool. An agent may still **read the file**
(`.claude/skills/<name>/SKILL.md`) when a playbook, the spec or a human names it. That's how the Duo skills are used
during feature work. Build-heavy or scripted skills (`xcode-build-*`, `android-emulator`, `android-play-policy-insights`)
are never run by feature agents.

### iOS

| Skill | Source (pinned) | Mode | Used by | When |
|---|---|---|---|---|
| `swiftui-expert` | AvdLee/SwiftUI-Agent-Skill 5.2.0 | preloaded + auto | `ios-engineer`, `ios-quality-reviewer` | Every feature; Phase 4 performance traces (`xctrace` scripts) |
| `xcode-build-orchestrator`, `xcode-build-benchmark`, `xcode-project-analyzer`, `xcode-compilation-analyzer`, `spm-build-analysis` | AvdLee/Xcode-Build-Optimization-Agent-Skill | on demand, **recommend-only** | iOS lead, or a dedicated build session | Phase 2 baseline, end of each wave, build regressions, Phase 4 |
| `iphone-duo-readiness`, `iphone-duo-adaptive-layout`, `iphone-duo-vertical-bars`, `iphone-duo-dual-pane-patterns`, `iphone-duo-design-review` | mirzaaghazadeh/iphone-duo-skills | on demand (**beta APIs**) | `ios-engineer` when the spec's *Form factors* require it; `ios-quality-reviewer`; Phase 4 audit | Per ADR-0017 |
| `iphone-duo-hinge-and-scenes`, `iphone-duo-camera` | same | off | — | Only if a spec needs hinge effects or camera capture on the fold |

### Android

| Skill | Source (pinned) | Mode | Used by | When |
|---|---|---|---|---|
| `android-navigation-3`, `android-navigation-event`, `android-edge-to-edge`, `android-adaptive`, `android-testing-setup` | Google android/skills | auto | `android-engineer`, orchestrator | Phase 2 shell (nav host, edge-to-edge, adaptive scaffold, test setup), then features |
| `android-intent-security`, `android-permissions-security` | Google android/skills | preloaded + auto | `android-quality-reviewer` | Every review; Phase 4 security pass |
| `compose-performance-audit` | community (awesome-android-agent-skills) | preloaded + auto | `android-quality-reviewer` | Every review; Phase 4 |
| `android-agp-9-upgrade`, `android-r8-analyzer`, `android-profiler`, `android-play-policy-insights`, `android-cli` | Google android/skills | on demand | Android lead / dedicated session | Phase 2 build setup, Phase 4 (R8, profiling), before release (Play policy) |
| `gradle-build-performance`, `android-emulator` | community | on demand | Android lead / local smoke runs | Phase 2 build setup; local debugging |
| `android-camerax`, `android-restore-credentials`, `android-play-billing-upgrade` | Google android/skills | off (when enabled: auto, except billing upgrade on demand) | — | Enable when a feature uses the camera, credential restore or Play Billing |

### Considered and not adopted

| Candidate | Why not |
|---|---|
| `xcode-build-fixer` (AvdLee) | Edits `project.pbxproj` directly. That conflicts with XcodeGen / synchronized folders / Tuist and the "no hand-edited pbxproj" rule. Humans apply changes via xcconfig, `project.yml` or `Project.swift` |
| iPhone Duo `flutter`, `games`, `react-native` | Not our stack. The RN skill would modify `hybrid/`, which is reference-only |
| Community Android `navigation3` | Broken against current artifacts (non-existent `lifecycle-viewmodel-navigation3:2.9.2`, old alpha APIs, Nav2 calls). Google's `navigation-3` covers it |
| Community `android-viewmodel`, `android-architecture`, `android-data-layer`, `android-retrofit` | Conflict with the kit (SharedFlow events, direct VM methods, hand-written Retrofit, `Level.BODY` logging in release) or too thin. Useful rules are folded into guideline 07 |
| Community `android-gradle-logic`, `coil-compose`, `android-testing` | Outdated (AGP 8.2 / targetSdk 34, Coil 2, old androidx.test). Google `agp-9-upgrade` / `testing-setup` and *Now in Android* are the references |
| Community `kotlin-concurrency-expert`, `android-accessibility` | Contain errors, so their correct rules are folded into guideline 07 instead |
| Community `xml-to-compose-migration`, `rxjava-to-coroutines-migration` | Nothing to migrate in a greenfield Compose app |
| Paul Hudson's SwiftUI Pro | Overlaps with `swiftui-expert` and conflicts harder (assumes iOS 26 target, one type per file, discourages `Binding(get:set:)`). Optional personal reviewer lens only |

**Candidates to evaluate next** (run the trial in §6 first): Apple's built-in Xcode 27 skills (exported from your own
Xcode), AvdLee's Swift Concurrency and Swift Testing skills, Dimillian's iOS skills.

## 3. Where skills enter the process

| Phase | Skill use |
|---|---|
| 0 Setup | ADR-0016 and ADR-0017 are accepted. Name the update owners (`HOW_TO_UPDATE.md` §2). `node tools/skills-sync.mjs --check` passes. List the set in `PROJECT.md` § Agent tooling |
| 2 Foundations | **iOS:** `xcode-project-analyzer` + `spm-build-analysis` *(human)* on the skeleton (recommendations → xcconfig / `Project.swift` via ADR). `swiftui-expert` while building DesignSystem components. **Android:** `android-agp-9-upgrade` *(human)* if the template is older, `android-edge-to-edge`, `android-navigation-3` for the nav host, `android-testing-setup`, `gradle-build-performance` *(human)* for config/build cache. **Both:** adaptive app shell per ADR-0017 (`android-adaptive` ↔ `iphone-duo-adaptive-layout`) |
| 3 Feature waves | Implementers use their preloaded/auto skills. `ios-quality-reviewer` and `android-quality-reviewer` review every PR in scope (guideline 04 § Step 3). Duo/adaptive skills when the spec's *Form factors* section asks for it |
| 4 Hardening | `swiftui-expert` trace recording/analysis, `android-profiler` *(human)*, `compose-performance-audit`, `xcode-build-orchestrator` *(human)*, `android-r8-analyzer` *(human)*, the security skills, `iphone-duo-readiness` + `iphone-duo-design-review` *(human)* |
| 5 Cut-over | `android-play-policy-insights` *(human)* before submission; Duo App Store screenshot sizes from `iphone-duo-dual-pane-patterns` |
| 6 Steady state | Monthly `--outdated`, reviewed bumps, quarterly retire/adopt review (§6) |

## 4. Reconciliation notes

### swiftui-expert

Architecture-neutral, current, high quality. These of its rules are now **kit rules** (guidelines 05/06): Equatable
`UiState`, narrow inputs to subviews, cheap `init`, no `AnyView`, sheets as their own screen, `.task` cancellation,
availability gating. Overrides:

1. **View models stay.** The skill doesn't mandate an architecture. The kit's `@Observable` view model + `UiState` + `onAction` + effects pattern (05) is mandatory.
2. **Bindings:** use `Binding.udf(value) { onAction(...) }` (06). Never use `@Bindable` on a view model, and never mutate view-model state from a view. Don't flag `Binding.udf` as a closure binding.
3. **Strings:** use the generated `L10n` accessors (already-localized `String`, module bundle). `Text(L10n.authLoginTitle)` is correct. Don't flag it as "should be a literal / `LocalizedStringResource`".
4. **Colours, fonts, spacing:** DesignSystem tokens, even where the skill's examples use system colours or `.font(.title2)`. Tokens are built on text styles / `Font.custom(_:size:relativeTo:)` and `@ScaledMetric`, so Dynamic Type still works.
5. **Accessibility grouping:** `.accessibilityElement(children: .contain)` on containers holding identified elements. Use `.combine` / `.ignore` only on non-interactive leaf groups, because they hide child identifiers from Maestro and XCUITest.
6. **No Combine** (`.onReceive(publisher)` examples) in feature code.
7. **Previews:** preview `XContent` with fixture states. `@Previewable` (iOS 18) isn't needed.
8. **Navigation:** typed `[Route]` arrays rather than `NavigationPath`.
9. **Newer APIs** (iOS 18/26/27, Liquid Glass): only when the spec or design asks, always behind `#available`, with an iOS 17 fallback.
10. **Soft deprecations:** follow the skill. Flag them, but don't migrate during feature work.
11. **Its iPhone Duo / SDK 27 guidance** (`references/iphone-duo.md`, `ArrangementView`, reserved regions, hinge effects)
    falls under the iPhone Duo rules below. Apply it only when the spec's *Form factors* asks, behind `#available(iOS 27.1, *)`
    in the core UI adapter. It doesn't bypass ADR-0017.
12. **`@Observable` + `UiState`:** mutate state through the view model's `update { }` helper (06), so equal values don't notify observers.

### Xcode build optimization

1. **On demand, recommend-only.** The kit doesn't vendor the fixer. People apply changes through xcconfig, `project.yml` (XcodeGen) or `Project.swift` (Tuist), recorded in an ADR.
2. **Never while feature agents are building.** It runs repeated clean builds and deletes the DerivedData path you pass it. Run it in a dedicated session or worktree on a quiet machine. Never point `--derived-data-path` at a shared DerivedData folder.
3. **Blind spots:** it reads `project.pbxproj` only, so it can't see `Modules/Package.swift` target settings, xcconfigs, `project.yml` or Tuist manifests. Expect false positives for settings Xcode already defaults (upstream issue #19). Verify every finding with `xcodebuild -showBuildSettings`.
4. Skip its "share your results" / community-PR step (client confidentiality).
5. Its claim that explicit modules are "experimental" may be out of date for Xcode 26+. Verify before acting.
6. Add `.build-benchmark/` to `ios/.gitignore`.

### iPhone Duo

1. **Beta and young:** iOS/Xcode 27.1 beta APIs, a 20-day-old single-maintainer repo, AI-written, and by its own note never compiled. It stays **on demand** while the APIs are beta (ADR-0017 uses it only for two-pane specs and the Phase 4 audit).
2. **Gate everything:** `if #available(iOS 27.1, *)`, inside a small adapter in a core UI module. Feature code never calls Duo APIs directly. Add `@MainActor` to its `@Observable` samples.
3. "Run Xcode's App Resizability skill" is a **human step in Xcode**. Agents must not claim to have run it.
4. Tab sidebar: `.tabViewStyle(.sidebarAdaptable)` is iOS 18+. Use the DesignSystem `AdaptiveTabStyle` modifier (06), which gates it.
5. **Orientation locks don't apply on the inner display.** Every spec whose hybrid screen assumed portrait records this under *Form factors*.
6. **System bars only:** hand-rolled headers and tab bars don't adapt, so screens use `.toolbar` / `TabView` (now a guideline 06 rule).
7. **Toolbar overflow can hide identified items.** Keep primary actions out of overflow, and run the e2e flows in both compact and expanded layouts when the spec asks for both.
8. Hinge effects and fold-aware camera are iOS-only. They go in `decisions/divergences.md`. The Android counterpart is Jetpack WindowManager `FoldingFeature` via `android-adaptive`.

### Google Android skills

1. Official and evaluated, so **Google wins over community skills** wherever they overlap (Navigation 3, testing setup, AGP, edge-to-edge, predictive back, security).
2. The kit still wins on the ViewModel / `UiState` / `Action` / `Effect` pattern and the module layout (05, 07).
3. `navigation-3`: follow its Hilt and ViewModel-store entry-decorator guidance (07 requires it).
4. `testing-setup`: fakes-first, which matches the kit. Keep AC IDs in test names.
5. `play-policy-insights`: its scraper fetches your app's **public** Play listing. Run it on demand before release only.

### Community Android skills

Only three are vendored:

1. `compose-performance-audit` was written before strong skipping (default since Kotlin 2.0.20). Ignore "remember every lambda" and `remember { Modifier… }` advice unless a Compose compiler report shows an actual instability. Prefer a stability configuration file over mandating `ImmutableList`. Add compiler reports and Baseline Profiles to the audit.
2. `gradle-build-performance`: ignore kapt flags (use KSP). Never use `-x test -x lint` in CI. "Build > Analyze APK Build" doesn't exist (use Build Analyzer / Analyze APK). Check the Develocity version.
3. `android-emulator`: local smoke runs only. Its scripts echo typed text, so **never type credentials** through it. Run it from `android/`, because it uses the first `gradlew` it finds walking up. Maestro remains the parity gate.

## 5. Roles and loading

| Agent / session | Preloaded (`skills:`) | Also available |
|---|---|---|
| `ios-engineer` | `swiftui-expert` | reads the on-demand Duo skill files when the spec asks |
| `android-engineer` | — (guideline 07 is the always-on standard) | auto Android skills (`android-navigation-3`, `android-navigation-event`, `android-edge-to-edge`, `android-adaptive`, `android-testing-setup`, security) |
| `ios-quality-reviewer` | `swiftui-expert` | Duo review skills when in scope |
| `android-quality-reviewer` | `compose-performance-audit`, `android-intent-security`, `android-permissions-security` | `android-adaptive` |
| `parity-reviewer`, `rn-analyst` | — | — (cross-platform behaviour and hybrid code, not platform style) |
| Orchestrator (main session at workspace root) | — | auto skills fire only for `ios/**` / `android/**` files, so hybrid analysis and spec writing stay clean |

**Other agent tools** read `.agents/skills` but ignore Claude-specific fields (`paths`, `skills`, `disable-model-invocation`).
So `skills-sync` exposes **only model-invocable skills** there. On-demand skills stay reachable by path
(`.claude/skills/<name>/SKILL.md`) when a human asks for them. Name the skill files explicitly in prompts (guideline 04
§ Other agents). A tool running inside `ios/` or `android/` alone doesn't see workspace skills at all.

## 6. Adopting, updating and retiring skills

**Adopting (checklist):**
- [ ] Licence allows vendoring (keep the licence file; `skills-sync` copies it)
- [ ] Every file read, including scripts, hooks, MCP config and network calls. Anything that executes gets a note in §4
- [ ] Currency checked against the current Xcode/iOS and AGP/Kotlin/Compose versions
- [ ] Conflicts with the kit listed in §4, and mode chosen (preloaded / auto / on demand)
- [ ] Added to `skills/lock.json` with a full commit SHA, `paths`, `note`. `node tools/skills-sync.mjs` run
- [ ] **Trial** passed (below), recorded in `decisions/skills-evaluations.md`

**Trial:** take one `verified` feature. On a scratch branch, run the platform quality reviewer (or re-implement one small
AC) twice, once with the skill and once without. Compare true findings, false positives and conflicts with the kit,
plus build/test results and time/tokens. Adopt only if the skill finds real issues without adding contradictory noise.

**Updating and removing:** the full procedure, including how to **propose removing** a skill, is in
[`HOW_TO_UPDATE.md`](../HOW_TO_UPDATE.md) §8 and §10. In short: never auto-update. Monthly: `node tools/skills-sync.mjs --outdated`. To move a pin:
`--bump <source-id> [--to <tag|sha>]`, then `node tools/skills-sync.mjs`. Review the diff under `.claude/skills/`
(SKILL.md and any scripts), re-check the §4 notes, and open a PR reviewed by the platform lead. Workspace CI runs
`skills-sync --check`, which fails on local edits, missing skills or unpinned drift.

**Retiring:** remove a skill from the lock when models no longer need it (vendors retire skills for the same reason),
when it conflicts more than it helps, or when upstream goes stale on a fast-moving topic. Quarterly review with both
platform leads.
