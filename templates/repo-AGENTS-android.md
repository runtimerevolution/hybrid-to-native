# AGENTS.md — <AppName> Android

Native Android app (Kotlin + Jetpack Compose). The iOS app is built from the same specs, at the same time.
This repo usually sits inside the workspace as `android/`. Paths such as `guidelines/…`, `specs/…` and
`contracts/…` below refer to that workspace (`../` from here). If you can only see this repo, ask for the
spec and contract to be pasted into the task.

Also create `CLAUDE.md` next to this file containing the single line `@AGENTS.md`.

## Commands

```bash
./gradlew assembleDebug                         # build
./gradlew testDebugUnitTest                     # unit tests (all modules)
./gradlew :feature:<area>:testDebugUnitTest     # one module
./gradlew recordRoborazziDebug                  # record layout-matrix references (then commit them)
./gradlew verifyRoborazziDebug                  # screenshot tests (or: verifyPaparazziDebug)
./gradlew connectedDebugAndroidTest             # instrumented tests (emulator running)
./gradlew lintDebug spotlessCheck              # lint / format (spotlessApply fixes formatting; add detekt if the team uses it)
maestro test -e APP_ID=<applicationId> e2e        # shared e2e flows (from the workspace root)
```

## Repo map

| Path | What |
|---|---|
| `app/` | `MainActivity`, `Application`, navigation host, push/deep-link handling |
| `core/*` | network (generated client), data, database, datastore, analytics, designsystem, testing, legacy data migration |
| `feature/*` | One module per feature area, mirroring `Feature*` on iOS |
| `build-logic/` | Gradle convention plugins |
| `gradle/libs.versions.toml` | All dependency versions |
| `**/generated/` | Generated from `contracts/`. **Do not edit** |

## Android-specific rules

- Follow `guidelines/05-mirrored-architecture.md` and `guidelines/07-android-guidelines.md`.
- Add dependencies only through the version catalog and convention plugins.
- minSdk <x>, targetSdk <y>. Don't change either without an ADR.

<!-- shared:begin rules -->
<!-- (filled by tools/sync-agents-md.mjs from the workspace AGENTS.md — do not edit here) -->
<!-- shared:end rules -->

<!-- shared:begin conventions -->
<!-- shared:end conventions -->
