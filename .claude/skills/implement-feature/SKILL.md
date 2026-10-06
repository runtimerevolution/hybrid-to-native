---
name: implement-feature
description: 'Feature mode: build ONE approved feature on iOS and Android with its own contract, parallel build and per-feature reviews. Use for risky features (local data migration, payments and purchases, auth/security-sensitive flows) or when the product owner asks for a single feature to go through the full loop. For normal work use implement-slice. Argument: the feature ID.'
---

# implement-feature: one contract, two platforms, in parallel (feature mode)

> **Slice mode is the default** (`implement-slice`, guideline 04). Use this playbook for risky features (local data
> migration, payments and purchases, auth/security-sensitive flows; see `PROJECT.md` § Working agreements), or when the product owner
> asks for a single feature to go through the full loop.

Input: a feature ID (`$ARGUMENTS`). You're the **orchestrator**. You write the contract and coordinate. The platform
agents write the code. Read `guidelines/04-parallel-agent-workflow.md` (the full procedure) and
`guidelines/05-mirrored-architecture.md` first.

## Step 0: Preconditions (stop and report if any fails)

```bash
node tools/spec.mjs check <ID>          # approved and unchanged since approval
node tools/spec.mjs list                # dependencies (depends_on) at least implemented
```
- Contracts referenced by the spec exist (`contracts/openapi` operation IDs, `contracts/strings` keys,
  `contracts/analytics` events). If one is missing, add it to `contracts/` and run `node tools/contracts-sync.mjs`.
- `ios/` and `android/` exist and each has an `AGENTS.md`.

## Step 1: Contract

- New feature: write `specs/features/<ID>/contract.md` from `templates/feature-contract.md`.
  Existing contract (spec change): update only the delta, and add a *Change log* row naming the new/changed ACs.
- Fill in: module/file paths on both platforms, `UiState` fields with neutral types, `Action`s, `Effect`s,
  repository interfaces and domain models, test IDs, string keys, analytics events with trigger points, and the
  AC → test-level table.
- **P0 feature:** show the contract to the user and wait for approval before Step 2. Otherwise continue.
- `node tools/spec.mjs status <ID> in-progress`

## Step 2: Parallel implementation

Launch **both subagents in the same message** so they run concurrently:

- `ios-engineer`: "Implement feature <ID> in ios/ following specs/features/<ID>/contract.md. Branch feature/<ID>.
  <For a change: only these ACs: …>. Write specs/features/<ID>/impl-ios.md when done."
- `android-engineer`: the same prompt, with android/ and impl-android.md.

Give both **identical** information. Without subagents (other tools), follow the manual two-session procedure in
guideline 04 § Other agents.

## Step 3: Collect results

Read `impl-ios.md` and `impl-android.md`.
- **Contract change requests:** decide on each CCR. Update `contract.md` (log the change), then send the change
  to **both** agents (resume them, or launch new ones with the delta), even if only one asked.
- **Failed checks:** send the agent back with the failing output. Never accept "tests not run".

## Step 4: Parity review

Launch the reviewers **in one message** so they run in parallel:
- `parity-reviewer` → `review.md` (behaviour and contract, both platforms)
- `ios-quality-reviewer` → `review-quality-ios.md` and `android-quality-reviewer` → `review-quality-android.md`
  (platform craft, with preloaded skills), for the priorities listed in `PROJECT.md` § Working agreements (default P0 + P1)

Merge the verdicts into `review.md` (the worst verdict wins). Keep each platform's quality findings for that platform's
agent. Verdict handling (PASS / PASS WITH NOTES / FAIL) is in guideline 04 § Step 3.

## Step 5: Fix loop (max 3 rounds)

Send each platform agent only its own findings (`[ios]`, `[android]`, `[both]`). Re-run Step 4. After 3 failed
rounds, stop and escalate to the user with `review.md`.

## Step 6: Wrap up

- Regenerate status: `node tools/parity-report.mjs --out parity/STATUS.md --json parity/status.json`
- Give the user the two branches to open as PRs, titled `[<ID>] <spec title>`, each linking spec, contract,
  review and the sibling PR. Ask before pushing or opening PRs yourself.
- After the humans merge **both** PRs: `node tools/spec.mjs status <ID> implemented`. If notes were accepted as
  platform differences, the spec was edited, so re-approve first (`spec.mjs approve`) or the status change is refused.
- If agents repeated a mistake, propose one line for the right guideline's *Things agents get wrong* list.
