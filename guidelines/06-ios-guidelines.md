# 06 — iOS guidelines (Swift + SwiftUI)

Read `05-mirrored-architecture.md` first. This file covers the iOS-specific choices *inside* that shape.
Repo-level commands (build, test, lint) live in `ios/AGENTS.md` (template: `templates/repo-AGENTS-ios.md`).

## Baseline (confirm in ADRs during Phase 0)

| Topic | Default | Notes |
|---|---|---|
| Min iOS | **iOS 17**, a deliberate trade-off (ADR-0004) | Recent RN/Expo apps support iOS 15.1+. Raising the minimum strands users on iOS 15–16 on the last hybrid release (it keeps working while the backend supports it). Check their share in analytics. The architecture here assumes iOS 17 (`@Observable`). If you must support iOS 16, use `ObservableObject` + `@Published` on **every** screen and update 05. iOS 15 also lacks `NavigationStack` |
| Language | Swift 6 language mode, strict concurrency | Xcode 26+ app targets default to `MainActor` isolation, but **Swift packages don't**. Set `swiftSettings: [.defaultIsolation(MainActor.self)]` on the `Modules/` targets, or keep them nonisolated. Decide once (ADR) and apply it everywhere |
| UI | SwiftUI; UIKit only via `UIViewRepresentable` for gaps | |
| State | Observation (`@Observable`), `@State` for view-local state | No `ObservableObject`/`@Published` in new code |
| Navigation | `NavigationStack(path:)` with a `Hashable` route enum per flow; `TabView` for tabs | Deep links → route parser (shared table in `contracts/deeplinks.md`) |
| Async | async/await, structured concurrency, `.task {}` for view-bound work | No new `DispatchQueue`/Combine in feature code |
| Networking | `URLSession` + client generated from `contracts/openapi` (swift-openapi-generator) | Auth/refresh in a middleware, not in features |
| Persistence | `UserDefaults` for small prefs; SwiftData or GRDB for structured data; Keychain for secrets | Choose one DB (ADR) |
| DI | Initialiser injection; a composition root in `App/`; SwiftUI `Environment` for app-wide services | Avoid global singletons in features |
| Modules | One local Swift package `Modules/` with `Core*`, `DesignSystem`, `Feature*` targets | App target stays thin |
| Project file | **XcodeGen** `project.yml` (the kit template, `/scaffold-native`; the `.xcodeproj` is generated and gitignored), or Xcode synchronized folders / Tuist (ADR-0006) | Agents edit `.pbxproj` badly. Adding a file must not require editing it. After adding a target, run `xcodegen generate` |
| Dependencies | Swift Package Manager only | No CocoaPods |
| Strings | String Catalog (`.xcstrings`) + typed `L10n` accessors, both generated from `contracts/strings` into `DesignSystem` | Use `L10n.authLoginGreeting(name:count:)`. `String(localized: "auth.login.greeting \(name)")` looks up a *different* key (`auth.login.greeting %@`). Strings resolve through `Bundle.module`, so previews and package tests show real text |
| Tests | Swift Testing (`@Test`, `#expect`) for unit tests; XCUITest only where Maestro can't reach; snapshot tests (swift-snapshot-testing) for UI states | |
| Lint/format | SwiftLint + swift-format (or SwiftFormat); pick one formatter | Config committed; CI fails on violations |

## Feature code rules

- One screen = `XScreen` (owns the view model, collects effects) + `XContent` (pure view taking
  `state` and `onAction`). Previews and snapshot tests use `XContent` with fixture states.
- `XViewModel` is `@MainActor @Observable final class`, with `private(set) var state`.
- Effects: `EffectChannel` (see 05), consumed in `.task { for await effect in viewModel.effects.stream() { ... } }`.
  Never expose one long-lived `AsyncStream`. It dies the first time the screen disappears.
- Views read only `state`. Two-way bindings go through actions with the shared helper (in `DesignSystem`):
  ```swift
  extension Binding {
      /// Unidirectional binding: reads from immutable UI state, writes by sending an action.
      @MainActor static func udf(_ value: Value, send: @escaping @MainActor (Value) -> Void) -> Binding<Value> {
          Binding(get: { value }, set: { send($0) })
      }
  }
  // TextField(L10n.authLoginEmail, text: .udf(state.email) { onAction(.emailChanged($0)) })
  ```
  Never use `@Bindable` on a view model, and never mutate view-model state from a view.
- Follow **State granularity** in 05: `UiState: Equatable`, subviews get only the fields they render, view model `init`
  does no work, and loading starts from `.task { viewModel.onAction(.appeared) }`.
- Extract real `View` types, not computed properties or functions returning `some View`. No `AnyView`, no `.if` modifier.
- Sheets and full-screen covers are **their own screen** (own `XScreen` + view model), presented from an effect with
  `sheet(item:)`, and they dismiss themselves via `\.dismiss`. No `onSave`/`onCancel` closure chains.
- Navigation paths are typed arrays (`[AppRoute]`), not `NavigationPath`. Restore them after the app is killed only if the spec
  says so, and never past the launch gate or session check (05 § State restoration).
- APIs newer than the deployment target (iOS 18/26/27, Liquid Glass) only behind `#available`, with an iOS 17 fallback,
  and only when the spec or design asks for them.
- State writes go through a private helper that skips equal values (see 05):
  ```swift
  private func update(_ change: (inout LoginUiState) -> Void) {
      var next = state
      change(&next)
      if next != state { state = next }
  }
  ```
- **Adaptive layout (every screen, ADR-0017 minimum):** the screen renders correctly at any size and orientation. System bars only (`.toolbar`, `TabView` with the DesignSystem `AdaptiveTabStyle`
  modifier, which applies `.tabViewStyle(.sidebarAdaptable)` behind `if #available(iOS 18, *)`, since that API isn't on iOS 17). No hand-rolled headers or tab bars. Respect per-edge safe areas. Never branch on device idiom,
  screen size or orientation; use size classes and available space. Large-screen and foldable behaviour (iPhone Duo)
  follows the spec's *Form factors* section and ADR-0017. Duo-only APIs live behind `#available(iOS 27.1, *)` in a core UI adapter.
- Every interactive element and every state container gets `.accessibilityIdentifier` from the contract. On a
  container (`VStack`, `List` row), add `.accessibilityElement(children: .contain)` first. Otherwise the identifier is
  applied to the children, and Maestro/XCUITest can't find the container.
- Support Dynamic Type (no fixed font sizes, use `DesignSystem` text styles), VoiceOver labels on icon-only
  buttons, and a minimum 44pt tap target.
- Use design tokens from `DesignSystem` (generated from `contracts/design-tokens`). No hard-coded colours or spacing.
- Errors: map to `AppError` in the data layer. Views show `AppError` via the shared error component.
- Logging: `os.Logger` with a subsystem per module. Never log tokens or PII.

## Testing rules

- Test view models with fakes (`FakeXRepository`), not mocks of URLSession.
- Name tests after the AC: `@Test("AUTH-LOGIN-AC01 invalid email shows error and sends no request")`.
- Put API decoding tests against the shared fixtures in `contracts/fixtures/`. `contracts-sync` copies them into a test target
  (e.g. `Modules/Tests/CoreNetworkTests/Fixtures`, declared as `resources: [.copy("Fixtures")]` in `Package.swift`).
- UI tests / Maestro: rely on accessibility identifiers only, never on text or position.

## Things agents get wrong on iOS (keep this list current)

- Using deprecated APIs (`NavigationView`, `onChange(of:perform:)` single-param, `foregroundColor`). Prefer
  current APIs for the deployment target.
- Creating `ObservableObject` view models out of habit. Use `@Observable`.
- Doing work in `init` of a view or view model instead of `.task`.
- Launching unstructured `Task {}` without cancellation handling in long-lived work.
- Forgetting `@MainActor` on UI state, or sprinkling `nonisolated`/`@unchecked Sendable` to silence warnings.
- Editing `project.pbxproj` by hand. If a new file needs a pbxproj edit, the project setup is wrong. Fix the setup.
- Copying React patterns (a giant "container" view, prop drilling through ten initialisers, `useEffect`-like
  `onAppear` chains).
- Passing the whole `state` to every subview, or making `UiState` non-`Equatable`.
- Copying the hybrid app's JS-drawn header or tab bar instead of using system bars.
- Claiming to have "run" an Xcode-only tool (e.g. Xcode's App Resizability check). Agents can't. Say it needs a human.

## Recommended agent tooling for iOS

Vendored skills and their overrides: `14-platform-skills.md` (`swiftui-expert` is preloaded by `ios-engineer` and
`ios-quality-reviewer`; the Xcode build-optimization skills are on-demand and recommend-only; the iPhone Duo skills
depend on ADR-0017). MCP servers and other tools: `13-agent-skills-and-tools.md` (Xcode MCP `xcrun mcpbridge`, MobileBuildMCP).
