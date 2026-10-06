# {{ID}} — Implementation contract

> Written by the orchestrator **before** parallel implementation (`guidelines/04-parallel-agent-workflow.md`, Step 1).
> Both platforms implement exactly these names and shapes. Platform agents never edit this file. They file
> Contract change requests in their `impl-<platform>.md`.
> Spec: [spec.md](spec.md) · Spec hash at contract time: `<approved_hash>`

## Modules and files

| Item | iOS | Android |
|---|---|---|
| Module | `Feature<Area>` | `:feature:<area>` |
| Screen | `Modules/Sources/Feature<Area>/<Screen>/<Screen>Screen.swift` | `feature/<area>/src/main/kotlin/.../<screen>/<Screen>Screen.kt` |
| View model | `.../<Screen>ViewModel.swift` | `.../<Screen>ViewModel.kt` |
| State / actions / effects | `.../<Screen>UiState.swift` | `.../<Screen>UiState.kt` |
| Repository | `Modules/Sources/CoreDataLayer/<X>Repository.swift` | `core/data/src/main/kotlin/.../<X>Repository.kt` |
| Tests | `Modules/Tests/Feature<Area>Tests/<Screen>ViewModelTests.swift` | `feature/<area>/src/test/.../<Screen>ViewModelTest.kt` |

## UiState

| Field | Neutral type | Default | Meaning |
|---|---|---|---|
| `email` | `String` | `""` | |
| `isSubmitting` | `Bool` | `false` | |
| `emailError` | `String?` (string key) | `null` | |

## Actions (user intents)

| Action | Payload | Handling (spec ref) |
|---|---|---|
| `emailChanged` | `value: String` | updates `email`, clears `emailError` |
| `submitTapped` | — | validate (AC01) → call `login` → effect |

## Effects (one-off)

| Effect | Payload | Screen/router does |
|---|---|---|
| `navigateToHome` | — | replace stack with Home |
| `showMessage` | `key: String` | shows snackbar/toast with string key |

## Domain and data interfaces

```text
interface AuthRepository {
  login(email: String, password: String) -> Result<Session, AppError>   // operationId: login
}
model Session { userId: ID, expiresAt: Instant }
```

## Shared identifiers

| Kind | Values |
|---|---|
| Test IDs | `login.emailField`, `login.passwordField`, `login.submitButton`, `login.emailError` |
| String keys | `auth.login.title`, `auth.login.error.invalidEmail` |
| Analytics | `login_submitted` fired on valid submit, before the request, `{ method: "email" }` |
| Deep links | — |
| Flags | — |

## Layout variants

| Variant (from spec *Form factors*) | iOS | Android | Test IDs that must stay reachable |
|---|---|---|---|
| compact (< 600dp / iOS horizontal `.compact`) | size class `.compact` | below `WIDTH_DP_MEDIUM_LOWER_BOUND` | all |
| compact landscape | `.compact` width or height, depending on device | phone in landscape (height-constrained) | all (scrollable, nothing clipped) |
| medium (600–840dp) | usually still `.compact` on iPhone Duo / iPad split view. Decide per spec | `isWidthAtLeastBreakpoint(WIDTH_DP_MEDIUM_LOWER_BOUND)` | all |
| expanded (≥ 840dp / iOS `.regular`) | e.g. `NavigationSplitView` / two-pane | `isWidthAtLeastBreakpoint(WIDTH_DP_EXPANDED_LOWER_BOUND)`, e.g. `ListDetailPaneScaffold` | all primary actions (no overflow menus) |

## Test plan (AC → test level per platform)

| AC | iOS | Android | E2E flow |
|---|---|---|---|
| {{ID}}-AC01 | unit (`<Screen>ViewModelTests`) | unit (`<Screen>ViewModelTest`) | `e2e/flows/<area>/<flow>.yaml` |

## Change log

| Date | Change | Reason (CCR #) |
|---|---|---|
