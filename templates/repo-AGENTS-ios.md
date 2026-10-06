# AGENTS.md — <AppName> iOS

Native iOS app (Swift + SwiftUI). The Android app is built from the same specs, at the same time.
This repo usually sits inside the workspace as `ios/`. Paths such as `guidelines/…`, `specs/…` and
`contracts/…` below refer to that workspace (`../` from here). If you can only see this repo, ask for the
spec and contract to be pasted into the task.

Also create `CLAUDE.md` next to this file containing the single line `@AGENTS.md` (Claude Code and Xcode's Claude agent read `CLAUDE.md`).

## Commands

```bash
# Project generation (kit-scaffolded projects): the .xcodeproj is generated from project.yml and gitignored.
# Run after cloning, pulling, or adding files/targets. Never edit the .xcodeproj by hand
xcodegen generate
# Build (pick the scheme/destination used in CI)
xcodebuild -project <App>.xcodeproj -scheme <App> -destination 'platform=iOS Simulator,name=<iPhone model>' build
# Unit + layout-matrix snapshot tests: the app scheme runs the package test targets.
# `swift test` would build for macOS and fail on iOS-only APIs, so use xcodebuild
xcodebuild -project <App>.xcodeproj -scheme <App> -destination 'platform=iOS Simulator,name=<iPhone model>' test
# UI / snapshot tests
xcodebuild -project <App>.xcodeproj -scheme <App> -destination '…' test -only-testing:<App>UITests
# Lint / format
swiftlint --strict
swift format lint --recursive --strict App Modules
# Shared e2e flows (from the workspace root)
maestro test -e APP_ID=<bundle id> e2e
```

## Repo map

| Path | What |
|---|---|
| `App/` | Entry point, composition root (DI), root navigation, push/deep-link handling |
| `Modules/Sources/Core*` | Networking (generated client), persistence, analytics, feature flags, legacy data migration |
| `Modules/Sources/DesignSystem` | Tokens (generated) and shared components |
| `Modules/Sources/Feature*` | One target per feature area, mirroring `:feature:*` on Android |
| `Modules/Tests/*` | Unit and snapshot tests |
| `**/Generated/` | Generated from `contracts/`. **Do not edit** |

## iOS-specific rules

- Follow `guidelines/05-mirrored-architecture.md` and `guidelines/06-ios-guidelines.md`.
- Adding a file must not require editing `project.pbxproj` by hand (XcodeGen `project.yml`, synchronized folders or Tuist).
  New modules go in `Modules/Package.swift`; a new test target is also listed in `project.yml` § schemes.
- Deployment target: iOS <x>. Swift 6 language mode. Don't lower either without an ADR.
- `.build-benchmark/` (output of the on-demand Xcode build-optimization skills) is gitignored. Their findings are
  recommendations; apply them via xcconfig / `Project.swift` in a reviewed PR (guideline 14 §4).

<!-- shared:begin rules -->
<!-- (filled by tools/sync-agents-md.mjs from the workspace AGENTS.md — do not edit here) -->
<!-- shared:end rules -->

<!-- shared:begin conventions -->
<!-- shared:end conventions -->
