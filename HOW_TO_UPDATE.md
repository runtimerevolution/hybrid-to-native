# How to update third-party dependencies and skills

This is the single procedure for keeping **everything we didn't write** current: app libraries, vendor SDKs,
toolchains, code generators, test/CI tooling, MCP servers and **third-party agent skills**. It also covers how to
**propose removing a skill** that's no longer worth it. It implements ADR-0016.

Two rules apply to every update:

1. **Both platforms move together.** Vendor SDKs (analytics, crash reporting, flags, push, payments) and toolchains are
   updated on iOS and Android in the same week, in sibling PRs. If an update changes user-visible behaviour, it goes through
   the normal spec process (`guidelines/12-long-term-maintenance.md` §1). It isn't a "dependency bump".
2. **Nothing floats.** Every dependency is pinned (SPM `Package.resolved`, the Gradle version catalog, `skills/lock.json`,
   MCP server versions). Updates are reviewed PRs, never auto-merged, so a revert is always one PR away.

## 1. Start with the inventory

```bash
node tools/deps-report.mjs --out parity/DEPENDENCIES.md   # every pin on both platforms + vendor pairs + skill pins
node tools/skills-sync.mjs --outdated                     # skill pins vs upstream
```

`parity/DEPENDENCIES.md` shows vendor SDKs **side by side**. A vendor that's "missing" on one platform, or two very
different generations of the same SDK, is the first thing to fix. Branch- or revision-pinned SPM packages are flagged,
because update bots can't track them.

## 2. Cadence and owners

| What | Cadence | Owner | Notes |
|---|---|---|---|
| App libraries, patch/minor | Weekly bot batch | Platform devs | Grouped PRs from Renovate/Dependabot (§3) |
| App libraries, major | Monthly, planned | Platform lead | Read the migration guide first; may need an ADR |
| Vendor SDKs with a backend | Monthly, **same week on both platforms** | Both leads | §5: check identity, events, privacy |
| Xcode / Swift / iOS SDK | Within 4–6 weeks of a stable release | iOS lead | Apple sets a yearly minimum SDK for App Store uploads (usually each spring). Never miss it |
| AGP / Gradle / Kotlin / Compose BOM | Within 4–6 weeks of a stable release | Android lead | Keep Kotlin and the Compose compiler plugin aligned |
| Android `targetSdk` | Before Google Play's yearly deadline (end of August) | Android lead | Read the behaviour changes. Large-screen rules affect ADR-0017 |
| Code generators, linters, formatters | Monthly | Both leads | Regenerate on both platforms in the same PR pair (§6) |
| Test and CI tooling (Maestro, simulators/emulator images, CI runners) | Monthly, and with every Xcode update | QA + leads | §7 |
| Third-party agent skills | Monthly `--outdated`, quarterly review | Both leads | §8. Removal proposals: §10 |
| MCP servers, Claude Code plugins, Android CLI | Monthly | Both leads | §9 |
| Workspace tools (Node LTS only; the tools have no npm dependencies) | With each Node LTS | Any | `node --check tools/*.mjs` and the CI checks |
| `hybrid/` | **Frozen.** Security fixes only, until cut-over | Tech leads | Any change must be mirrored in the affected specs |

**Naming:** branch `deps/<yyyy-mm-dd>-<topic>` (same name in both repos when paired), commits and PR titles
`[DEPS] <what>`, e.g. `[DEPS] Firebase 12.3 (iOS) / BoM 34.3 (Android)`. Each PR links its sibling.

## 3. Update bots (starting point)

Use Renovate (or Dependabot) on **both** native repos, with the same schedule and grouping. That way paired updates arrive together.
This Renovate config is a starting point; check it against the current Renovate docs:

```json
{
  "extends": ["config:recommended"],
  "schedule": ["before 6am on monday"],
  "timezone": "UTC",
  "prConcurrentLimit": 6,
  "labels": ["deps"],
  "commitMessagePrefix": "[DEPS]",
  "packageRules": [
    { "matchUpdateTypes": ["major"], "dependencyDashboardApproval": true },
    { "matchPackageNames": ["/firebase/i"], "groupName": "firebase" },
    { "matchPackageNames": ["/sentry/i"], "groupName": "sentry" },
    { "matchPackageNames": ["/^androidx\\.compose/"], "groupName": "compose" },
    { "matchPackageNames": ["/^org\\.jetbrains\\.kotlin/", "/^com\\.google\\.devtools\\.ksp/"], "groupName": "kotlin" },
    { "matchPackageNames": ["/^com\\.android\\.tools\\.build/", "/^com\\.android\\.application/", "/^com\\.android\\.library/"], "groupName": "agp" }
  ]
}
```

Renovate reads `Package.swift` (put all external iOS dependencies in `Modules/Package.swift`, not only in the Xcode
project) and `gradle/libs.versions.toml`. Bots don't update Xcode, CI images, skills or MCP servers. Those follow §4–§9.

## 4. Per-platform procedure

### iOS

1. Change the version requirement in `Modules/Package.swift` (or accept the bot PR), then resolve:
   ```bash
   cd ios/Modules && swift package resolve         # updates Modules/Package.resolved
   cd ios && xcodebuild -resolvePackageDependencies -project <App>.xcodeproj -scheme <App>
   ```
   Commit both `Package.resolved` files. `deps-report` flags conflicting pins between them.
2. Read the release notes of every updated package. Look for breaking API changes, a raised minimum iOS, Swift 6 concurrency
   changes, privacy-manifest changes.
3. Run the full repo check from `ios/AGENTS.md` (build, lint, unit, snapshot tests). Review snapshot diffs deliberately:
   UI-library updates can legitimately change them.
4. **Xcode / Swift update:** update CI runner images and `ios/.xcode-version` in the same PR. Fix new warnings (don't
   suppress them). Handle deprecations with the `swiftui-expert` soft-deprecation rule (flag now, migrate in a planned PR).
   Optionally run the build benchmark before and after (human-run: `/xcode-build-benchmark`, guideline 14 §4).
5. After SDK changes, regenerate the privacy report (Xcode → Archive → Generate Privacy Report) and update the App Store privacy labels.

### Android

1. Change `gradle/libs.versions.toml` (or accept the bot PR). BOM-managed libraries (Compose, Firebase) change through the BOM version.
2. **AGP / Gradle / Kotlin:** use the AGP Upgrade Assistant or the vendored skill (human-run: `/android-agp-9-upgrade`).
   Update the wrapper with `./gradlew wrapper --gradle-version <x>` (run it twice so the wrapper jar updates too).
   Keep Kotlin, KSP and the Compose compiler plugin on matching versions.
3. **targetSdk:** read that release's behaviour changes (edge-to-edge, predictive back, large-screen orientation and
   resizability rules). Update the affected guideline 07 lines and the ADR-0017 tests.
4. Run the full repo check from `android/AGENTS.md` (build, lint/detekt/spotless, unit, screenshot tests). For release builds, check
   R8 (human-run: `/android-r8-analyzer`) and APK/AAB size against the baseline.
5. After SDK changes, update Play Console's **Data safety** form if data collection changed.

## 5. Vendor SDKs (the parity-sensitive ones)

Update them **on both platforms in the same week**, as sibling PRs, and check:

- [ ] Same SDK generation on both platforms afterwards (`deps-report` vendor table)
- [ ] Changelog read for **identity** (user/device IDs, `distinct_id`, app user ID), **event API** and **consent** changes
- [ ] `node tools/analytics-diff.mjs` on the P0 flows (guideline 10), with no unexpected differences
- [ ] Crash reporting still symbolicates (dSYM upload / R8 mapping upload in CI)
- [ ] Remote config / feature-flag defaults unchanged (`contracts/flags.md`)
- [ ] Privacy manifest (iOS) and Data safety (Android) updated if collection changed

## 6. Code generators, linters and formatters

- **OpenAPI generators** (swift-openapi-generator + runtime/transport; openapi-generator or Ktor on Android). Update them on both
  platforms in paired PRs, rebuild, and run the decoding tests against `contracts/fixtures/`. Generated code is committed, so
  review its diff.
- **Style Dictionary** (design tokens): pin its version where the config lives (`contracts/design-tokens/`), rebuild, and review the
  generated Swift/Kotlin diff.
- **`tools/contracts-sync.mjs`** is ours. After changing generator behaviour, run `node tools/contracts-sync.mjs --check`.
- **SwiftLint / swift-format / ktlint / detekt / Spotless**: update, run with `--fix`/`format` in a separate commit, then fix
  the remaining violations by hand. Never relax rules to make an update pass without a lead's approval.
- **Snapshot libraries** (swift-snapshot-testing, Roborazzi/Paparazzi): update, re-record only after a human has reviewed the diffs.

## 7. Test and CI tooling

- **Maestro CLI:** run the full `e2e/` suite on both platforms before and after. Check that `id:` selectors, `runFlow: when`
  and JUnit output still behave the same (`parity-report --e2e-results`).
- **Simulator / emulator images and CI runners:** update them together with Xcode/AGP. Keep the device list in CI in step
  with the large-screen devices ADR-0017 requires.
- **CI actions / orbs:** pin them to versions (or SHAs) and update monthly like everything else.
- **Robolectric:** after a bump, delete the `sdk=35` pin in `robolectric.properties` on one module, run
  `./gradlew recordRoborazziDebug`, and look at every image. Remove the pin everywhere only if no capture is blank.

## 7b. The kit's native project templates (kit maintainers)

`templates/native/` pins its own versions: `templates/native/android/gradle/libs.versions.toml`, `ProjectConfig.kt`
(compileSdk / targetSdk tokens in `tools/scaffold-native.mjs`), `GRADLE_VERSION` and `SNAPSHOT_TESTING_VERSION` in
`tools/scaffold-native.mjs`, and the CI images in both `.github/workflows/*.yml`. They only affect projects scaffolded
afterwards: existing app repos update through §4 like any other project (each records its template in `.kit-template.json`).
To update them: bump, run `scaffold-native` into a scratch workspace, build, test, record and run both apps, and check
`swift format lint --strict` and `spotlessCheck lintDebug` before releasing the kit.

## 8. Third-party agent skills

Pinned in `skills/lock.json` and vendored into `.claude/skills/` (guideline 14).

```bash
node tools/skills-sync.mjs --outdated                    # which sources moved upstream
# read the upstream compare link it prints: SKILL.md changes, new/changed scripts, licence
node tools/skills-sync.mjs --bump <source-id> [--to <tag|sha>]
node tools/skills-sync.mjs                               # re-vendor
git diff -- .claude/skills skills/                       # review what agents will now read
node tools/skills-sync.mjs --check
```

Review checklist for a skill bump:
- [ ] Every **script, hook or MCP config** that changed has been read (what it runs, what it touches, any network access)
- [ ] Licence unchanged (or still compatible)
- [ ] **Replace rules still apply.** Rules marked `"required": true` make the sync fail loudly if the upstream text they patch has changed. Rewrite the rule, or drop it if upstream fixed the issue
- [ ] Guideline 14 §4 overrides re-checked against the new content. Add new conflicts, remove ones upstream resolved
- [ ] Mode still right (preloaded / auto / on demand). Agents that preload it still work (`--check` verifies preloads)
- [ ] For substantial changes, a quick trial (guideline 14 §6) is logged in `decisions/skills-evaluations.md`
- [ ] PR reviewed by the platform lead. For shared impact (a precedence or mode change), both leads

Never edit files under `.claude/skills/<vendored>/` by hand. `--check` fails on it. Change the lock (replace rules,
exclude globs, mode flags) and re-sync. **Adding** a new skill follows guideline 14 §6 (adoption checklist + trial).

## 9. MCP servers, plugins and CLIs

- Pin versions in the MCP configuration (e.g. `npx -y <package>@<version>`), never `@latest`. List each server in `PROJECT.md` § Agent tooling.
- On update: read the changelog, re-check **telemetry defaults** (e.g. MobileBuildMCP's opt-out variable), watch for renames
  (packages and env vars), and confirm the tools the playbooks rely on still exist.
- Claude Code plugins: disable auto-update for third-party marketplaces and update deliberately. Don't install a second,
  unpinned copy of a skill we already vendor (e.g. `android skills add` for skills that are in `skills/lock.json`).
- Android CLI / Xcode agent features: update with the toolchain (§4).

## 10. Proposing to remove a skill

A skill costs context, adds rules that can conflict, and has to be re-reviewed at every bump. Remove it when it no longer earns
its place. **Anyone** can propose a removal. Platform leads decide.

**Open a proposal when any of these is true:**

| Signal | How you notice |
|---|---|
| **Models already do it.** A trial without the skill finds the same issues | Guideline 14 §6 trial, or the quality reviews show no findings that cite the skill |
| **It's mostly overridden.** Most of its advice is in the guideline 14 §4 overrides | The overrides list for it keeps growing |
| **Nobody uses it.** An on-demand skill wasn't invoked for two quarters; an auto skill is never cited under "Skills applied" in quality reviews | `review-quality-*.md` files, impl notes, team feedback |
| **Superseded.** A vendor-official skill now covers the same ground (vendor wins, guideline 14 §1) | Upstream release notes, `--outdated` |
| **Stale.** No upstream activity for 6+ months on a fast-moving topic, or its APIs are deprecated | `--outdated`, `deps-report` age column |
| **Retired upstream.** The vendor removed or deprecated it | Upstream changelog |
| **Noise.** Reviewers report false positives or advice that contradicts the kit | Quality review "Skill advice deliberately not applied" sections |
| **Risk.** Licence change, new scripts with network or file-system reach, or a maintainer change you can't vet | Bump review (§8) |

**Procedure:**

1. Copy `templates/skill-removal-proposal.md` to `decisions/skill-proposals/<yyyy-mm-dd>-remove-<skill>.md` and fill in
   the evidence (signals, trial result, what rules would be lost, who preloads it).
2. Open a PR with the proposal. The platform lead reviews it (both leads if the skill affects shared behaviour). Leave it open for at least a few days for comments.
3. **If accepted**, in the same PR:
   - In `skills/lock.json`: remove the entry, or set `"enabled": false` if it might come back (it stays documented).
   - Move any rule worth keeping into the platform guideline (06/07) **before** removing the skill, so the knowledge isn't lost.
   - Remove it from agent preloads (`skills:` in `.claude/agents/*.md`) and from any playbook or guideline that names it:
     `grep -rn "<skill-name>" .claude/agents .claude/skills/*/SKILL.md guidelines AGENTS.md CLAUDE.md HOW_TO_UPDATE.md`
     (the vendored copy itself will be deleted).
   - Update the guideline 14 tables (move it to *Considered and not adopted* with the reason) and §4 notes.
   - Run `node tools/skills-sync.mjs`, which deletes the folder and its `.agents/skills` link. Then run `--check`, which fails if an
     agent still preloads it.
   - Log the decision in `decisions/skills-evaluations.md`.
4. **If rejected**, record why in the proposal and keep it for the next quarterly review.
5. Amend ADR-0016 only if the removal changes the precedence rules or the overall approach, not for individual skills.

## 11. Verification checklist (every update PR)

- [ ] Full repo check passes: build, lint, unit, snapshot/screenshot tests
- [ ] Maestro smoke (or full suite for toolchain/vendor updates) passes on both platforms
- [ ] `node tools/parity-report.mjs --strict` and the other workspace CI checks pass
- [ ] Vendor updates: §5 checklist, `analytics-diff` clean
- [ ] Major/toolchain updates: app size and cold start compared with the baseline
- [ ] `parity/DEPENDENCIES.md` regenerated. `PROJECT.md` § Agent tooling updated if tooling changed
- [ ] Sibling PR linked (paired updates), and both PRs merge together

## 12. Rolling back

Everything is pinned, so revert the update PR(s) and re-run the checks. For skills: revert the lock change and run
`node tools/skills-sync.mjs`. After a bad release, a store build can't be rolled back. Ship a fix forward
(guideline 11 § Rollout).
