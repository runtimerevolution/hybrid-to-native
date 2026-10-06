# 05 — Mirrored architecture

Both apps use **the same shape and the same names**. A developer or agent who knows `LoginViewModel`
on iOS should find `LoginViewModel` on Android, with the same state fields, actions and effects. This is the
cheapest parity mechanism there is. It makes contracts easy to write, reviews mechanical, and later changes
predictable.

Each platform still uses its own idioms *inside* this shape (`06-ios-guidelines.md`, `07-android-guidelines.md`).

## Layers

```
UI layer        Screen (SwiftUI View / @Composable)  ── renders UiState, sends Action
                ViewModel                             ── owns UiState, handles Action, emits Effect
Domain (opt.)   UseCase                               ── only when logic is shared across ViewModels
Data layer      Repository (interface + Default impl) ── single source of truth for a data type
                DataSource (Remote / Local)           ── generated API client, DB, key-value, keychain
```

Rules:
- Screens have no business logic and never call repositories directly.
- ViewModels never import UI frameworks' navigation types. They emit `Effect.navigate(...)`.
- Repositories expose domain models, never DTOs. DTO ↔ domain mapping lives in the data layer.
- Everything is injected through initialisers or constructors, so fakes can replace it in tests.

## Unidirectional data flow: the shared pattern

```
          Action                        UiState
 Screen ──────────▶ ViewModel ──────────────────▶ Screen
                       │  Effect (one-off: navigate, toast, open URL)
                       └──────────────────────────▶ Screen / Router
```

**iOS**
```swift
@MainActor @Observable
final class LoginViewModel {
    private(set) var state = LoginUiState()
    let effects = EffectChannel<LoginEffect>()          // CoreUI helper, below
    private let authRepository: any AuthRepository
    @ObservationIgnored private var submitTask: Task<Void, Never>?

    init(authRepository: any AuthRepository) { self.authRepository = authRepository }

    func onAction(_ action: LoginAction) {
        switch action {
        case .emailChanged(let value):
            state.email = value
            state.emailError = nil
        case .submitTapped:
            submitTask?.cancel()                          // owned, cancellable work, not a fire-and-forget Task
            submitTask = Task { await submit() }
        }
    }

    private func submit() async {
        guard isValidEmail(state.email) else { state.emailError = "auth.login.error.invalidEmail"; return }
        state.isSubmitting = true
        defer { state.isSubmitting = false }
        switch await authRepository.login(email: state.email, password: state.password) {
        case .success: effects.send(.navigateToHome)
        case .failure(let error): state.error = error
        }
    }
}

// Screen: .task { for await effect in viewModel.effects.stream() { handle(effect) } }
```

`EffectChannel` is a small shared helper (one per app, in a core UI module). **Don't** expose a single
`AsyncStream` from the view model. When the screen's `.task` is cancelled (push, tab switch), that stream
terminates for good, and every later effect is silently lost.

```swift
/// One-subscriber, buffered effect channel. Mirrors Kotlin `Channel(BUFFERED).receiveAsFlow()`:
/// effects sent while no screen is listening are kept and delivered to the next subscriber.
@MainActor
public final class EffectChannel<Effect: Sendable> {
    private var continuation: AsyncStream<Effect>.Continuation?
    private var buffer: [Effect] = []

    public init() {}

    public func send(_ effect: Effect) {
        if let continuation, case .enqueued = continuation.yield(effect) { return }
        buffer.append(effect)
    }

    /// Call from the screen's `.task`. Each call starts a new subscription and replaces the previous one.
    public func stream() -> AsyncStream<Effect> {
        continuation?.finish()
        let (stream, continuation) = AsyncStream.makeStream(of: Effect.self)
        self.continuation = continuation
        for effect in buffer { continuation.yield(effect) }
        buffer.removeAll()
        return stream
    }
}
```

**Android**
```kotlin
@HiltViewModel
class LoginViewModel @Inject constructor(
    private val authRepository: AuthRepository,
) : ViewModel() {
    private val _state = MutableStateFlow(LoginUiState())
    val state: StateFlow<LoginUiState> = _state.asStateFlow()
    private val _effects = Channel<LoginEffect>(Channel.BUFFERED)
    val effects: Flow<LoginEffect> = _effects.receiveAsFlow()

    fun onAction(action: LoginAction) {
        when (action) {
            is LoginAction.EmailChanged -> _state.update { it.copy(email = action.value) }
            LoginAction.SubmitTapped -> viewModelScope.launch { submit() }
        }
    }

    private suspend fun submit() {
        if (!isValidEmail(_state.value.email)) {
            _state.update { it.copy(emailError = "auth.login.error.invalidEmail") }
            return
        }
        _state.update { it.copy(isSubmitting = true) }
        authRepository.login(_state.value.email, _state.value.password)
            .onSuccess { _effects.send(LoginEffect.NavigateToHome) }
            .onFailure { error -> _state.update { it.copy(error = error.toAppError()) } }
        _state.update { it.copy(isSubmitting = false) }
    }
}

// Screen: LaunchedEffect(Unit) { viewModel.effects.collect { effect -> handle(effect) } }
```

### State granularity (performance)

One `UiState` per screen keeps parity simple, but on iOS any write to `state` invalidates every view that reads it.
So both platforms follow these rules:

- `UiState` and every type inside it are **value types with equality**: `struct …: Equatable` on iOS, `data class` on
  Android (Compose also needs stable types; see 07). State changes go through one helper that only writes when the value
  changed: `_state.update { it.copy(…) }` on Android, `update { $0.email = value }` on iOS (06). On iOS, mutating
  `state.field` in place notifies observers even when the value is the same, so the helper matters.
- Only the root `XContent(state:onAction:)` receives the whole state. Its **subviews and child composables take only
  the fields they render**, as plain values, plus narrow callbacks.
- Values that change many times per second (timers, progress, scroll/drag offsets, live search results while typing) may live
  outside `UiState`, in a separate observable property or a per-row model. When you do this, list it in the contract
  under *UiState* with a note, and do it the same way on both platforms.
- View model `init` is cheap and starts no work. Loading starts from an action sent by the screen
  (`.task { viewModel.onAction(.appeared) }` / `LaunchedEffect(Unit) { viewModel.onAction(Appeared) }`).
  **`appeared` must be idempotent.** iOS `.task` fires again on every appear. Android `LaunchedEffect` fires again after
  configuration changes (rotation, fold, resize), which can't be prevented on large screens at API 36. Guard one-time
  loads and "screen viewed" analytics in the view model, or the platforms' network calls and events diverge.

### Adaptive layout (ADR-0017)

**Minimum, every screen, both platforms: it renders correctly at any size and orientation.** Nothing clipped, overlapping or
unreachable, and content keeps a readable max width. This holds even when phones lock orientation, because large screens,
split view and multi-window ignore locks. Layout reacts to available space and size classes, never to device idiom or
orientation. Two-pane / list-detail layouts appear where the spec's *Form factors* asks, the same way on both platforms
(contract § Layout variants). The layout-matrix tests in guideline 10 check this.

> Effects as a stream is our default (ADR-0003, to be confirmed in Phase 0). Android's official guidance
> prefers modelling events as state. If the team chooses that, change **both** platforms and this file.

## Naming map

| Concept | iOS | Android |
|---|---|---|
| Feature module | `Feature<Area>` (SPM target), e.g. `FeatureAuth` | `:feature:<area>`, e.g. `:feature:auth` |
| Core module | See the core module table below | `:core:<name>` |
| Screen | `LoginScreen: View` | `@Composable fun LoginScreen(...)` (+ stateless `LoginContent`) |
| State holder | `LoginViewModel` (`@Observable`) | `LoginViewModel : ViewModel` |
| UI state | `struct LoginUiState` | `data class LoginUiState` |
| Action | `enum LoginAction` | `sealed interface LoginAction` |
| Effect | `enum LoginEffect` | `sealed interface LoginEffect` |
| Repository | `protocol AuthRepository` + `DefaultAuthRepository` | `interface AuthRepository` + `DefaultAuthRepository` |
| Fake for tests | `FakeAuthRepository` | `FakeAuthRepository` |
| Domain model | `struct User` | `data class User` |
| DTO | `UserDTO` (generated) | `UserDto` (generated) |
| Route | `enum AppRoute: Hashable` case `login` | `@Serializable data object LoginRoute` / Nav3 key |
| Test ID | `.accessibilityIdentifier("login.emailField")` | `Modifier.testTag("login.emailField")` |
| String | `L10n.authLoginTitle`, `L10n.authLoginGreeting(name:count:)` (generated) | `stringResource(R.string.auth_login_title)`, `pluralStringResource(R.plurals.cart_items, count, count)` |

Names come from the contract. If a platform idiom forces a different name (e.g. `UserDTO` vs `UserDto`),
the table above is the only allowed difference.

### Core modules

| Responsibility | iOS (SPM target) | Android (Gradle module) |
|---|---|---|
| HTTP client (generated), auth middleware | `CoreNetwork` | `:core:network` |
| Repositories, domain models | `CoreDataLayer` | `:core:data` |
| Database | `CoreDatabase` | `:core:database` |
| Key-value prefs, keychain / keystore | `CoreStorage` | `:core:datastore` |
| Tokens, components, strings (generated) | `DesignSystem` | `:core:designsystem` |
| Analytics (generated events) | `CoreAnalytics` | `:core:analytics` |
| Legacy data migration | `CoreLegacyMigration` | `:core:legacymigration` |
| Test fakes and fixtures | `CoreTesting` | `:core:testing` |

Never name an iOS module after an Apple framework (`CoreData`, `CoreLocation`, `CoreML`…). The module shadows the
framework, and `import CoreData` stops finding `NSPersistentContainer`. That's why the data layer is `CoreDataLayer`.

## Folder mirror

```
ios/                                        android/
  App/                                        app/
    <AppName>App.swift  (entry, DI root)        src/main/.../MainActivity.kt, <AppName>Application.kt
    AppRouter.swift / RootView.swift            navigation/AppNavHost.kt
  Modules/            (local SPM package)     core/
    Sources/                                    network/  data/  database/  datastore/
      CoreNetwork/  CoreDataLayer/ ...          designsystem/  analytics/  testing/
      DesignSystem/  CoreAnalytics/           feature/
      FeatureAuth/                              auth/
        Login/                                    src/main/.../login/
          LoginScreen.swift                         LoginScreen.kt
          LoginViewModel.swift                      LoginViewModel.kt
          LoginUiState.swift                        LoginUiState.kt   (state, actions, effects)
    Tests/                                        src/test/.../login/LoginViewModelTest.kt
      FeatureAuthTests/Login/LoginViewModelTests.swift  src/androidTest/.../login/LoginScreenTest.kt
  UITests/                                    (Maestro flows live in the workspace: e2e/)
```

## Type mapping (for contracts)

| Neutral (in contract) | Swift | Kotlin |
|---|---|---|
| `String`, `Int`, `Bool`, `Double` | `String`, `Int`, `Bool`, `Double` | `String`, `Int`/`Long`, `Boolean`, `Double` |
| `Decimal` (money) | `Decimal` | `BigDecimal` |
| `Instant` (UTC timestamp) | `Date` | `kotlin.time.Instant` / `java.time.Instant` |
| `LocalDate` | `DateComponents` or a small `LocalDate` struct | `java.time.LocalDate` / kotlinx `LocalDate` |
| `List<T>` / `Map<K,V>` | `[T]` / `[K: V]` | `List<T>` / `Map<K, V>` |
| `T?` | `T?` | `T?` |
| `enum { a, b }` | `enum: String, CaseIterable` | `enum class` |
| `oneOf { A(x), B }` (sum type) | `enum` with associated values | `sealed interface` |
| `ID` | `String` (or tagged `struct UserID`) | `String` (or `@JvmInline value class UserId`) |
| `Loadable<T>` | `enum Loadable<T> { case idle, loading, loaded(T), failed(AppError) }` | `sealed interface Loadable<out T>` |

## Shared cross-cutting types (define once per platform, in core modules)

- `AppError`: the same cases on both platforms (`network`, `unauthorized`, `server(code)`, `validation(field)`,
  `decoding` (a 2xx response that doesn't match the contract), `unknown`). It maps from the backend error codes in `contracts/errors.md`.
- **State restoration after the app is killed** follows the spec, never a platform default. If the spec says a cold start is a
  normal launch (a session check or launch gate decides the first screen), don't restore the navigation stack
  (`rememberNavBackStack` on Android, `@SceneStorage` / state restoration on iOS) past that gate. Restore only what the spec lists.
- `Loadable<T>`: see above.
- `AnalyticsEvent`: generated from `contracts/analytics`.
- `AppRoute` + deep-link parser: generated or hand-written from `contracts/deeplinks.md`, with a shared test table.
- `FeatureFlag`: hand-written enum on each platform, kept in step with `contracts/flags.md` (the parity reviewer checks it).

## When the platforms really differ

Some things have no 1:1 equivalent: iOS widgets vs Android app widgets, background work (BGTaskScheduler vs
WorkManager), share extensions, predictive back. Keep the **domain and data layers mirrored**. Let the platform-specific
adapter differ, and record it in `decisions/divergences.md` with a link to the spec.
