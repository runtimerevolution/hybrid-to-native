---
name: implement-slice
description: 'Build a vertical slice (several approved features that together give something tappable, e.g. launch → login → main screen) on iOS and Android at once. Contracts are written and approved in one batch, one engineer session per platform builds the features in dependency order, the app is shown running early, and one review pass covers the whole slice. This is the default way to build; use implement-feature only for risky features. Argument: the slice ID (specs/slices/<SLICE-ID>.md) or a list of feature IDs.'
argument-hint: '<SLICE-ID> | <FEATURE-ID> <FEATURE-ID>…'
---

# implement-slice: the default build loop

Guideline 04 § Slice mode explains why. In short: per-feature ceremony delays the first screen the product owner can tap.
A slice keeps every parity guarantee (one contract per feature, AC-tagged tests on both platforms, parity and quality
reviews) but batches the human steps and the reviews.

**Use `implement-feature` instead** for features in `PROJECT.md` § Working agreements → *Feature mode required for*
(by default: local data migration, payments and purchases, auth/security-sensitive flows), or when the product owner asks.

## Step 0: Define the slice

- If `$ARGUMENTS` is a slice ID, read `specs/slices/<SLICE-ID>.md`. If it's a list of feature IDs, create the slice file
  from `templates/slice.md` (next free `SLICE-NN`), with the features in **dependency order** and a one-line **demo goal**
  ("launch → log in → see the home list").
- A good slice ends in something the product owner can tap. The first slice of a project is always the thinnest path to a
  real screen: shell, session, login, main screen. Non-UI features (e.g. the data migrator) go into a later slice or run in feature mode
  alongside. They never block the first screen.
- Preconditions (stop and report if any fails): every spec is `approved` (`node tools/spec.mjs check <ID>` each),
  dependencies outside the slice are implemented, and contracts referenced (`contracts/`) exist.

## Step 1: Contracts for the whole slice, approved once

- Write every feature's `contract.md` (`templates/feature-contract.md`) in one go, so names line up across the slice
  (shared state holders, routes, repositories).
- Show the batch to the user once: a short table (feature → screens, state, actions, effects, test IDs) plus the files.
  Contract approval for the slice is one human OK.
- `node tools/spec.mjs status <ID> in-progress` for each. Set the slice status to `building`.

## Step 2: Build: one session per platform, in dependency order

Launch `ios-engineer` and `android-engineer` **in the same message**. Give each:
- the slice file, and the spec + contract of every feature in order;
- the instruction to build **feature by feature, in the slice order**: tests tagged with AC IDs, build + lint + tests
  green after each feature, then commit `[<FEATURE-ID>] …` on branch `slice/<SLICE-ID>`;
- **CCR-and-continue:** if a contract is wrong or ambiguous, record a Contract change request in `impl-<platform>.md`,
  take the **most conservative reading** (the one closest to the spec, easiest to change later), mark it in the code
  with `// CCR-<n>`, and keep going. Stop only if the feature can't be built at all.
- **Show it running:** as soon as the app builds with a visible screen, launch it on the simulator/emulator and save
  screenshots to `specs/features/<ID>/assets/<platform>/`. Report "tappable" in the impl notes. Don't wait for reviews.

When both finish: collect CCRs from both platforms, decide each once, update the contracts, and send the resolution to
**both** platforms in one follow-up round. Use editorial amendments for wording-only spec fixes
(`spec.mjs amend <ID> --editorial "<reason>" --by <who>`). They don't need a re-approval until the slice review.

## Step 3: Demo

Tell the user the slice is tappable: how to run each app (scheme / Gradle task, simulator / emulator) and the
screenshots. Collect product-owner feedback now. Behaviour changes go into the specs (a real approval). Polish and
wording go to the review round.

## Step 4: One review pass for the slice

Launch in one message:
- `parity-reviewer` over all the slice's features (`node tools/parity-report.mjs --slice <SLICE-ID>`), writing
  `specs/slices/<SLICE-ID>-review.md`;
- `ios-quality-reviewer` and `android-quality-reviewer` over the slice branch diff, writing
  `specs/slices/<SLICE-ID>-review-quality-ios.md` / `…-android.md`.
Fix loop: one fix round per platform with all findings, at most 3 rounds for the slice, then escalate.

## Step 5: Acknowledge, merge, close

- The product owner acknowledges all editorial amendments and approves any changed specs **in one command**:
  `node tools/spec.mjs approve --slice <SLICE-ID> --by "<name>"`.
- One PR per repo for the slice, titled `[<SLICE-ID>] <demo goal> (<FEATURE-IDs>)`, linking the slice file, the
  reviews and the sibling PR. Ask before pushing or opening PRs. Merge both or neither.
- After the merge: `node tools/spec.mjs status <ID> implemented` for each feature, slice status `merged`,
  `node tools/parity-report.mjs --out parity/STATUS.md`.
- Propose guideline lines for any mistake the agents repeated, and kit-feedback entries for any kit gap.
