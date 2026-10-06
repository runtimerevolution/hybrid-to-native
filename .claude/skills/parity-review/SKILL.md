---
name: parity-review
description: 'Check the iOS and Android implementations of a feature against its spec and contract (AC test coverage, names, strings, analytics, test IDs, states, visual comparison) and write specs/features/<ID>/review.md with a PASS / PASS WITH NOTES / FAIL verdict. Use after implementing a feature, before merging PRs, or for a periodic parity audit ("--all").'
---

# parity-review: are both apps building the same thing?

Input: a feature ID, or `--all` for an audit of every `implemented`/`verified` feature (`$ARGUMENTS`).
**Read-only on code.** You only write `review.md` (and, for `--all`, a summary to the user).
Template: `templates/parity-review.md`. Background: `guidelines/10-testing-and-parity.md`.

## Steps

1. **Load the truth.** Read `spec.md`, `contract.md`, `impl-ios.md` and `impl-android.md` for the feature, plus
   `decisions/divergences.md`. Note the spec hash (`node tools/spec.mjs list`).

2. **Traceability.**
   ```bash
   node tools/parity-report.mjs --feature <ID>
   ```
   Every active AC must be covered on each platform in `platforms`, and in `e2e/` when its test level includes
   `e2e`. A missing test is a **blocker**. Open a sample of the tests the report lists and check they really
   exercise the AC, not just mention its ID.

3. **Contract conformance.** For each platform, find the files the contract names and compare:
   `UiState` fields and defaults, `Action` and `Effect` cases, repository signatures, test IDs
   (`accessibilityIdentifier` / `testTag`), string keys, analytics event names, properties and trigger points.
   Any mismatch is a **blocker**.

4. **Behavioural parity.** Walk each AC and each state in *Screens and states* through both code paths:
   validation rules, error mapping (`AppError` cases), loading/empty/offline handling, navigation effects,
   caching/refresh rules. A user-visible difference that isn't in the spec's *Platform differences* or in
   `divergences.md` is **major**.

5. **Visual comparison** (when `assets/{hybrid,ios,android}/` screenshots exist): view the matching images side by side.
   Report missing or extra elements, wrong content or order, and broken states. Don't report pixel differences or
   native idioms (navigation bars, fonts, system controls).

6. **Platform quality, light pass**: only when `ios-quality-reviewer` / `android-quality-reviewer` aren't run for this
   feature's priority (see `PROJECT.md` § Working agreements; by default P2). Look for obvious violations of
   `06-ios-guidelines.md` / `07-android-guidelines.md` "Things agents get wrong", accessibility (labels,
   Dynamic Type / font scale, touch targets), no hard-coded strings/colours, no secrets or PII in logs.

7. **Write `review.md`** with a verdict:
   - **FAIL**: any blocker
   - **PASS WITH NOTES**: majors listed with a proposed resolution (fix, or add to *Platform differences* for
     product-owner approval), no blockers
   - **PASS**: only minors, or nothing
   Each finding has an ID, platform tag `[ios]`/`[android]`/`[both]`, severity, `file:line` evidence and a suggested fix.

8. **Report** the verdict and the blocker count to the orchestrator or user. For `--all`, give a table of
   feature → verdict and list the drift found.

## Rules

- Evidence, not opinion. Every finding cites files and lines on the platform(s) concerned.
- Don't fix code, and don't edit the spec or the contract. Recommend.
- Judge against the spec and contract, not against your own preference or the hybrid code.
