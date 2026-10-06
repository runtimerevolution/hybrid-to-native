# 07 — Android guidelines (Kotlin + Jetpack Compose)

Read `05-mirrored-architecture.md` first. This file covers the Android-specific choices *inside* that shape.
Repo-level commands live in `android/AGENTS.md` (template: `templates/repo-AGENTS-android.md`).
Reference architecture: Google's official app architecture guide and the *Now in Android* sample.

## Baseline (confirm in ADRs during Phase 0)

| Topic | Default | Notes |
|---|---|---|
| minSdk | The hybrid app's current `minSdkVersion` (24 for recent RN/Expo) | Compose doesn't need more. Raising it strands users on the last hybrid release, so decide it explicitly (ADR-0004) with Play Console device stats |
| targetSdk | The latest level Google Play requires | Edge-to-edge and predictive back are mandatory at recent targets |
| Language | Kotlin 2.x, K2 compiler | |
| UI | Jetpack Compose + Material 3; Views only through `AndroidView` for gaps | Compose BOM for versions |
| State | `ViewModel` + `StateFlow<UiState>`; `collectAsStateWithLifecycle()` in UI | |
| Navigation | Navigation 3 (or Navigation Compose with type-safe `@Serializable` routes) | Pick one (ADR). Deep links follow `contracts/deeplinks.md`. With Navigation 3, add the ViewModel-store entry decorator (`rememberViewModelStoreNavEntryDecorator()`, from `lifecycle-viewmodel-navigation3`) to `NavDisplay`'s `entryDecorators`. Otherwise `hiltViewModel()` is scoped to the Activity and state leaks between screens. Check the API name for your version |
| Async | Coroutines + Flow; `viewModelScope`; inject dispatchers | No RxJava, no `GlobalScope` |
| DI | Hilt | |
| Networking | Retrofit + OkHttp + kotlinx.serialization (or Ktor), client generated from `contracts/openapi` | Auth/refresh in an OkHttp `Authenticator`/interceptor |
| Persistence | DataStore for prefs; Room for structured data; Android Keystore (e.g. via Tink) for secrets | Jetpack `security-crypto` (EncryptedSharedPreferences) is **deprecated**. Don't adopt it |
| Modules | `:app`, `:core:*`, `:feature:*`; convention plugins in `build-logic/`; version catalog `gradle/libs.versions.toml` | |
| Build variants | Build types `debug`/`release` + flavors mapped from hybrid envs (`eas.json` profiles / `react-native-config` envs) | |
| Strings | `res/values*/strings.xml` generated from `contracts/strings` | Resource name = contract key with `.`/`-` → `_` |
| Tests | JUnit + kotlinx-coroutines-test + Turbine; fakes over mocks; Compose UI tests; Roborazzi or Paparazzi for screenshots | |
| Lint/format | Android Lint + ktlint (via Spotless) + detekt | CI fails on violations. When detekt doesn't support the project's Kotlin version yet (it often lags a major Kotlin release), run ktlint + Android Lint only and add detekt back when it catches up (ADR note) |
| compileSdk | **Latest stable** API level (may be higher than targetSdk) | Libraries often need it. Install it with Android Studio's SDK Manager (or `sdkmanager "platforms;android-NN"` if cmdline-tools are installed) |

## Feature code rules

- One screen = `XScreen` (gets the view model via `hiltViewModel()`, collects state and effects) + `XContent`
  (stateless, takes `state` and `onAction`). Previews and screenshot tests use `XContent`.
- `UiState` is an immutable `data class`, updated with `_state.update { it.copy(...) }`.
- Effects: `Channel` → `receiveAsFlow()`, collected in `LaunchedEffect` with lifecycle awareness.
- Every interactive element and state container gets `Modifier.testTag(...)` from the contract. Set
  `Modifier.semantics { testTagsAsResourceId = true }` at the root, so Maestro and UI Automator can see the tags.
  **Set it again inside every `Dialog`, `ModalBottomSheet` and `Popup`.** They're separate windows and don't inherit it.
- Accessibility: `contentDescription` on icon-only buttons; 48dp minimum touch targets
  (`Modifier.minimumInteractiveComponentSize()`); support font scaling (use `sp` via design-system typography only).
  Turn on automated accessibility checks in Compose UI tests (`enableAccessibilityChecks()`, Compose 1.8+ with the
  `ui-test-junit4-accessibility` artifact).
- Use design tokens from `:core:designsystem` (generated from `contracts/design-tokens`). No hard-coded colours or dimensions.
- Errors: map to `AppError` in the data layer. Show them with the shared error component.
- Logging: a single logging facade (e.g. Timber). Never log tokens or PII. Strip debug logs in release via R8.
- Handle configuration changes and process death: keep critical input in `SavedStateHandle`.
- Follow **State granularity** in 05. Child composables take only the fields they render. With strong skipping
  (default since Kotlin 2.0.20) you don't need to `remember` every lambda. Fix instability only where Compose compiler
  reports show it, and prefer a stability configuration file for external types.
- Navigation 3: keep the back stack with `rememberNavBackStack` + `@Serializable` `NavKey`s (it survives process death)
  **when the spec wants navigation restored**. A spec that treats a cold start as a normal launch wins: never restore past the
  launch gate or session check (05 § State restoration).
  Pop with `removeLastOrNull()`, because `removeLast()` can crash below API 35. `entryDecorators` keeps
  `rememberSaveableStateHolderNavEntryDecorator()` **first**, then adds the ViewModel-store decorator. Replacing the
  default list loses per-entry saved state (see the vendored `android-navigation-3` recipes).
- **Adaptive layout (every screen, ADR-0017 minimum):** the screen renders correctly at any size and orientation. Follow
  the spec's *Form factors* section for two-pane layouts. Use window size classes
  and Material 3 adaptive components (`NavigationSuiteScaffold`, `ListDetailPaneScaffold`) instead of checking screen size or
  device type. For hinge/posture use Jetpack WindowManager `FoldingFeature`. Apps targeting API 36 can't lock orientation
  or resizability on large screens (Android 16 ignores those restrictions at sw ≥ 600dp; the opt-out property is temporary
  and games are exempt), so every screen must work in both orientations there. Width breakpoints use
  `WindowSizeClass.isWidthAtLeastBreakpoint(…)` (window-core 1.4+), not the deprecated `WindowWidthSizeClass` enum. Edge-to-edge insets and predictive back
  on every screen (`android-edge-to-edge`, `android-navigation-event`).

### Coroutines rules
- Always rethrow `CancellationException`. Never wrap suspend calls in `runCatching` without rethrowing it.
- No `GlobalScope`. Long-lived work outside a screen uses an injected `@ApplicationScope CoroutineScope`.
- Dispatchers are injected (qualifier annotations), never hard-coded in repositories.
- Callback APIs → `callbackFlow { … awaitClose { unregister() } }`.
- View model tests set the main dispatcher (`Dispatchers.setMain`, or a `MainDispatcherRule`) and use `runTest`.

### Release builds and client services
- **Crashlytics (and similar) mapping/symbol upload is opt-in.** Enable it only in the release pipeline through a
  Gradle property (e.g. `-P<app>.crashlytics.uploadMapping=true`). It's off by default, so local release builds never upload.
- Agents never run release builds, uploads or deploy tasks against a client's Firebase / Sentry / store accounts from a
  local machine. Build `debug` variants locally. If a release build is needed to test R8, disable all upload tasks and say so.

### Networking and images
- `HttpLoggingInterceptor` only in debug builds, never `Level.BODY` in release (tokens and personal data).
- Coil 3 (`io.coil-kt.coil3`) with `coil-network-okhttp`. Coil 2 examples in older material don't apply.

## Testing rules

- Name tests after the AC. For unit tests, a backtick name works:
  ```kotlin
  @Test fun `AUTH-LOGIN-AC01 invalid email shows error and sends no request`() = runTest { ... }
  ```
  For **instrumented** tests (`androidTest`), older Android runtimes don't allow spaces in method names. Use
  camelCase and an `// AC: AUTH-LOGIN-AC01` comment on the line above.
- Put API decoding tests against the shared fixtures in `contracts/fixtures/`. `contracts-sync` copies them into a module's
  `src/test/resources` (default: `core/network/src/test/resources/fixtures`; change it in `contracts/sync.config.json`).
- UI tests / Maestro: select by test tag only.
- Screenshot tests (Roborazzi on Robolectric): set the size inside the test with `RuntimeEnvironment.setQualifiers(...)`,
  not with `@Config(qualifiers)`, and keep the module's `src/test/resources/robolectric.properties` pin (`sdk=35`) until
  Robolectric renders consecutive SDK 36 captures (blank images otherwise). The kit template does both.

## Things agents get wrong on Android (keep this list current)

- Using `collectAsState()` instead of `collectAsStateWithLifecycle()`.
- Passing the `ViewModel` or `NavController` deep into composables. Pass `state` and lambdas instead.
- Missing `remember` for expensive computations or `derivedStateOf` for fast-changing inputs. Genuinely unstable
  parameter types (shown by compiler reports) causing recomposition storms.
- Hard-coding dispatchers (`Dispatchers.IO`) in repositories instead of injecting them.
- Adding dependencies directly in module `build.gradle.kts` instead of the version catalog / convention plugins.
- Forgetting edge-to-edge insets, or blocking predictive back.
- Copying React patterns (global mutable stores, prop drilling through ten composables, effect chains).
- Using `SharedFlow(replay = 0)` + `tryEmit` for one-off effects. Events are dropped when nothing collects. Use the Channel pattern (05).
- Running a local release build that uploads mapping files or symbols to the client's Firebase project.
- Restoring navigation after process death past a launch gate the spec requires.
- Applying pre-2024 Compose performance advice (remember every lambda, `ImmutableList` everywhere) without compiler-report evidence.

## Recommended agent tooling for Android

Vendored skills and their overrides: `14-platform-skills.md` (official Google skills for Navigation 3, edge-to-edge,
adaptive, testing, security, AGP 9, R8, profiling, Play policy; three reviewed community skills). MCP servers and other tools:
`13-agent-skills-and-tools.md` (Android CLI, Android Studio agent mode).
