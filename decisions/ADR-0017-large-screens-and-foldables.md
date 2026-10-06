# ADR-0017: Large screens and foldables

- **Status:** accepted (2026-09-29)
- **Applies to:** both

## Context

- **iPhone Duo** (Apple's foldable, iOS 27.1) runs every iPhone app on a 7.6" inner display, and **that display ignores
  supported-orientation locks**. Its APIs are still in beta.
- **Android 16** (targetSdk 36) ignores orientation, resizability and aspect-ratio restrictions on large screens
  (smallest width ≥ 600dp). The opt-out is temporary, and Play requires recent targetSdk levels.
- **iPad:** if the hybrid app shipped with `ios.supportsTablet: true` (or an iPad device family), the native update
  must keep supporting iPad (verify App Store Connect's rules for removing device families before deciding otherwise).
- Split view, multi-window, Stage Manager and freeform windows can resize any screen at any moment on both platforms.
- Many RN apps lock portrait (`app.json` `orientation`, `expo-screen-orientation`, `react-native-orientation-locker`).
  `tools/rn-inventory.mjs` reports the lock and the tablet flag.

## Options

| Option | Pros | Cons |
|---|---|---|
| A. Adapt safely everywhere, with the same single-column layout on large screens | Cheap, the same on both platforms | Large screens look sparse |
| **B. A as the minimum + list-detail / two-pane where the spec's *Form factors* asks** | Good large-screen UX where it matters, decided per feature, parity kept | More design and test work per feature |
| C. Full fold/posture-aware UX (hinge effects, tabletop mode, camera accessories) | Showcases new hardware | iOS 27.1 beta APIs, mostly platform-specific, divergence-heavy |

## Decision

**Option B.**

1. **Minimum, every screen, both platforms: it must render correctly at any size and orientation.**
   Nothing clipped, overlapping or unreachable. Content keeps a readable max width. System bars only, per-edge safe areas and
   insets. No layout decisions based on device idiom, screen size or orientation, only on available space and size classes.
   This holds even where the app locks orientation on phones, because large screens, split view and multi-window
   ignore or override locks.
2. **Two-pane / list-detail** (iOS `NavigationSplitView`, with Duo patterns behind `#available`; Android
   `ListDetailPaneScaffold` / `NavigationSuiteScaffold`) wherever the spec's *Form factors* section asks for it, identically
   on both platforms.
3. **Fold/posture-specific UX (option C)** is opt-in per spec, recorded in `decisions/divergences.md`, and built only once
   the iOS 27.1 APIs leave beta.
4. **Phone orientation policy** (whether phones allow landscape) is a product decision recorded in `PROJECT.md`. The default
   is the same as the hybrid app. Point 1 applies either way.

## Consequences

- **Tests make the minimum checkable** (guideline 10 § Layout matrix). Every screen's `XContent` has snapshot/screenshot tests
  for **compact portrait, compact landscape and expanded**, plus iPad if supported. P0 e2e flows also run on one large
  device per platform (iPhone Duo inner display or iPad; a foldable or tablet emulator).
- The spec template's *Form factors* section is mandatory, and `spec.mjs approve` refuses an empty one.
- Contracts list the layout variants and the test IDs that must stay reachable in each.
- Quality reviewers check the layout matrix tests exist and that nothing branches on idiom or orientation.
- iPhone Duo skills stay on demand while their APIs are beta. `iphone-duo-adaptive-layout`, `…-vertical-bars` and
  `…-dual-pane-patterns` are read when a spec asks for two-pane layouts; `iphone-duo-readiness` and `…-design-review` run in Phase 4.
