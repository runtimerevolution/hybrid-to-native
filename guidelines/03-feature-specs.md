# 03 — Feature specs

A feature spec is a **platform-neutral** description of behaviour. It is the source of truth that both native
implementations are built from and verified against. Template: `templates/feature-spec.md`.
Scaffold one with `node tools/spec.mjs new <FEATURE-ID> "<title>"`.

## Files per feature

```
specs/features/<FEATURE-ID>/
  spec.md          # what the feature does (this guide)            — product-approved
  contract.md      # how both platforms name and shape it           — written by implement-feature
  impl-ios.md      # what the iOS agent did, deviations, CCRs       — ios-engineer
  impl-android.md  # same for Android                               — android-engineer
  review.md        # parity review verdict                          — parity-reviewer
  assets/          # screenshots of the hybrid app, diagrams
```

## Front matter (parsed by tools, keep the keys exact)

```yaml
---
id: AUTH-LOGIN
title: Log in with email and password
status: draft          # draft | approved | in-progress | implemented | verified | deferred | dropped
priority: P0           # P0 needed for cut-over, P1 soon after, P2 nice to have
wave: 1
depends_on: [CORE-SESSION, CORE-NETWORK]
platforms: [ios, android]
hybrid_sha: 1a2b3c4
hybrid_refs:
  - hybrid/src/screens/auth/LoginScreen.tsx
  - hybrid/src/services/auth.ts
---
```

**New app** (guideline 15): `hybrid_sha` / `hybrid_refs` are replaced by `sources:`, the IDs from
`analysis/sources/README.md` (e.g. `[prd, figma, workshop:2026-10-02]`). `spec.mjs new` writes the right variant.

## Writing rules

1. **Describe behaviour, not implementation.** "Submitting with an invalid email shows `auth.login.error.invalidEmail`
   under the field and doesn't call the API." Not "set `errors.email` in react-hook-form".
2. **No framework words.** No `useState`, `Redux`, `SwiftUI`, `ViewModel`. The spec must still make sense if
   both platforms change framework.
3. **Cite evidence.** Each rule that came from hybrid code carries a `hybrid/...:line` reference. In a new app, each rule
   cites a source ID (`prd:§3.2`, `figma:<node-id>`, `workshop:<date>#D03`), and only confirmed workshop notes count.
4. **Every state is explicit.** Loading, empty, content, error (per error type), offline, partial data,
   permission denied. If the hybrid app has no handling for a state, say so and ask under *Open questions*.
5. **Use the contract vocabulary for shared artefacts.** String keys, analytics event names, test IDs and API
   operation IDs are written exactly as in `contracts/`.
6. **Acceptance criteria are testable, numbered, and permanent.** Use Given/When/Then. One behaviour per AC.
   IDs never change: when you remove an AC, strike it through, mark it `(removed)`, and never reuse the number.
7. **Platform differences are explicit and justified.** E.g. "Android: system back on step 2 returns to step 1;
   iOS: swipe-back does the same." Anything not listed here must behave the same on both platforms.
8. **Don't port bugs.** Under *Known hybrid issues*, list anything that looks wrong, with a recommendation.
   The product owner decides: fix it, keep it, or file it for later. In a new app the section is *Conflicts and gaps in
   the sources*: never fill a gap with a requirement nobody stated.

## Acceptance criteria format

```markdown
- **AUTH-LOGIN-AC01**: Given the login screen, when the email is not a valid address and the user taps
  `login.submitButton`, then `auth.login.error.invalidEmail` is shown and no request is sent.
  _Evidence: hybrid/src/screens/auth/LoginScreen.tsx:42 (zod schema)_ · _Test level: unit + e2e_
```

- Put the AC ID in bold at the start of a list item. `tools/parity-report.mjs` finds ACs with the pattern
  `<FEATURE-ID>-AC<NN>`. An AC runs until the next AC or heading, so it may use several lines or nested bullets.
- **Platform-scoped AC:** add `_Platforms: ios_` (or `android`) when an AC only applies to one platform, for example a migrator
  step that has nothing to read on a never-shipped platform. The parity report then only expects a test on that platform. Explain the
  reason in *Platform differences*, or the report warns.
- Suggest a **test level** for each AC: `unit` (view model / repository logic), `ui` (screen state rendering),
  `e2e` (shared Maestro flow), or `manual` (can't be automated, e.g. a real push from the backend. The parity
  report then doesn't require a test, so use it sparingly and justify it). Critical journeys need at least one `e2e` AC.

## Lifecycle

| Status | Meaning | Who moves it |
|---|---|---|
| `draft` | Written from hybrid evidence, has open questions | analyst agent |
| `approved` | Open questions resolved, product owner signed off | product owner |
| `in-progress` | `contract.md` exists, implementation started on both platforms | orchestrator (implement-feature) |
| `implemented` | Both PRs merged, parity review PASS (or PASS WITH NOTES resolved) | orchestrator, after the leads merge |
| `verified` | Shared e2e flows green on both, QA sign-off | QA |
| `deferred` / `dropped` | Not in cut-over scope / not rebuilt | product owner |

**Wording-only edits after approval** (no acceptance criterion added, removed or changed in meaning, e.g. aligning a
term with the contract): `node tools/spec.mjs amend <ID> --editorial "<reason>" --by "<who>"`. The spec stays approved,
the change is logged, and the product owner acknowledges all pending amendments at once (`spec.mjs approve <ID>`, or
`--slice <SLICE-ID>`), usually at the slice review. The tool refuses when the set of ACs changed. `implemented` /
`verified` need the amendments acknowledged first. The change log doesn't count toward the approval hash, and approving an
unchanged approved spec does nothing.

**Real changes after approval:** edit the spec in a PR on the workspace repo. Add a line to the *Change log*
section, add or strike ACs, and set status back to `approved` if it was further along. The `implement-feature`
playbook then builds only the delta.

## Quality checklist (the reviewer uses it too)

- [ ] Every hybrid route owned by this feature is listed in *Entry points* or *Screens*
- [ ] Every state has an AC
- [ ] Every API operation is in `contracts/openapi` and referenced by operation ID
- [ ] Every string key exists in `contracts/strings`
- [ ] Every analytics event exists in `contracts/analytics` with the same name and properties as hybrid
- [ ] Every locally persisted value is in `analysis/data-at-rest.md`
- [ ] *Form factors* filled in (ADR-0017): every screen renders at any size and orientation; two-pane layouts named where wanted; iPad row if supported
- [ ] Platform differences are listed, or explicitly "none"
- [ ] Open questions have an owner, or none are left (required for `approved`)
