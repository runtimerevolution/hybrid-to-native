---
id: {{ID}}
title: {{TITLE}}
status: draft
priority: P1
wave: 0
depends_on: []
platforms: [ios, android]
hybrid_sha:
hybrid_refs: []
approved_by:
approved_hash:
---

# {{ID}}: {{TITLE}}

> Platform-neutral behaviour spec. Rules: `guidelines/03-feature-specs.md`. No framework words.
> Cite hybrid evidence as `hybrid/<path>:<line>`.

## Summary

<!-- 2–4 sentences: what the user can do and why it matters. -->

## Entry points

| Entry | Detail |
|---|---|
| Route / screen | <!-- e.g. /login, shown when there's no session --> |
| Deep link | <!-- pattern from contracts/deeplinks.md, or "none" --> |
| Push notification | <!-- type → destination, or "none" --> |
| Other | <!-- widget, shortcut, share target… --> |

## Screens and states

<!-- One subsection per screen. Put screenshots in assets/hybrid/<state>.png. -->

### <Screen name>

| State | When | What the user sees | Screenshot |
|---|---|---|---|
| loading | | | |
| content | | | |
| empty | | | |
| error: network | | | |
| error: <type> | | | |
| offline | | | |

## Form factors and adaptive layout

<!-- Required by ADR-0017. Both platforms support the same rows. Differences go to Platform differences. -->

| Form factor | Layout | Notes |
|---|---|---|
| Phone, compact width | <!-- the baseline layout --> | |
| Large / unfolded (iPhone Duo inner display, Android foldables & tablets) | <!-- e.g. same column, max width; or list-detail two panes --> | |
| iPad (only if the hybrid app supports it today) | <!-- or "n/a" --> | |
| Orientation | <!-- every screen renders in both orientations (ADR-0017). Describe any landscape-specific layout; phone lock follows PROJECT.md --> | |
| Fold / posture specific | <!-- usually "none"; hinge-aware behaviour is iOS/Android specific → divergence register --> | |

## Actions and behaviour

| # | User action | Result | Evidence |
|---|---|---|---|
| 1 | | | |

## Business rules and validation

<!-- Exact rules, limits, formats, calculation formulas. Link shared test vectors in contracts/fixtures/. -->

## Data and API

| Operation (operationId) | When called | Request essentials | Response handling | Caching / retry |
|---|---|---|---|---|
| | | | | |

## Local data

| Key / table (see analysis/data-at-rest.md) | Read / write | Content | Survives logout? |
|---|---|---|---|
| | | | |

## Navigation out

| Trigger | Destination | Presentation (push / modal / replace) |
|---|---|---|
| | | |

## Analytics

| Event (contracts/analytics) | Fired when | Properties |
|---|---|---|
| | | |

## Strings

<!-- Keys from contracts/strings used by this feature. -->

## Accessibility and test IDs

| Element | Test ID | Accessibility label (string key) | Notes |
|---|---|---|---|
| | | | |

## Feature flags / remote config

<!-- Keys from contracts/flags.md and their effect, or "none". -->

## Permissions

<!-- Which permissions, when requested, what happens on deny, or "none". -->

## Platform differences

<!-- Intentional differences only, each with a reason. Everything else must behave the same. Or "none". -->

## Acceptance criteria

<!-- Format: - **{{ID}}-AC01**: Given …, when …, then …  _Evidence: hybrid/…:NN_ · _Test level: unit|ui|e2e_
     An AC may span several lines or nested bullets (it ends at the next AC or heading).
     Only for one platform? add _Platforms: ios_ (or android) and explain it under Platform differences. -->

- **{{ID}}-AC01**: Given …, when …, then …
  _Evidence: hybrid/…_ · _Test level: unit_

## Known hybrid issues (don't port blindly)

| Issue | Evidence | Recommendation | Decision (product owner) |
|---|---|---|---|
| | | | |

## Open questions

| # | Question | Owner | Answer |
|---|---|---|---|
| 1 | | | |

## Out of scope

## Change log

| Date | Change | By |
|---|---|---|
| {{DATE}} | Draft created | |
