---
name: rn-analyze
description: 'Run Phase 1 discovery on the React Native / Expo app in hybrid/ and produce the analysis pack (inventory, architecture, feature catalog, integrations, data at rest, native code, risks). Use when starting a migration, when someone asks "what does the hybrid app contain?", or to refresh analysis after hybrid changes.'
---

# rn-analyze: discovery of the hybrid app

Goal: a complete, evidence-backed map of `hybrid/` that the team can turn into feature specs and waves.
Read `guidelines/02-reading-react-native-source.md` before starting. **Never modify `hybrid/`.**

## Steps

1. **Pin the version.** First, list the branches: `node tools/rn-inventory.mjs --find-apps --branches` shows the RN app
   folders and versions on each branch by last commit, without checking anything out. The default branch can be years
   old while the live app sits on another branch. Then: Record `git -C hybrid rev-parse --short HEAD` and the branch/tag. Ask the user whether
   this is the production release, and whether an OTA update is live on top of it (guideline 02 §0). Don't continue
   on an unknown version without saying so in `analysis/architecture.md`.

2. **Run the scanner.** It analyses the app folder saved in `workspace.config.json` (set by `/kickoff`). If it says the
   folder isn't a React Native app, run `node tools/rn-inventory.mjs --find-apps` and ask which folder it is.
   ```bash
   node tools/rn-inventory.mjs --out analysis/inventory
   ```
   Read `analysis/inventory/INVENTORY.md` in full. It's your map, not your conclusion. Every item is a lead to verify.

3. **Resolve the config** if the inventory says the config is dynamic or the app is Expo managed (CNG). Only do this in a scratch copy,
   never in `hybrid/` (e.g. `cp -R hybrid /tmp/hybrid-scratch && cd /tmp/hybrid-scratch && npx expo config --type public --json`).
   Ask before running anything that installs packages or needs network access.

4. **Deep-read in parallel.** If you can run subagents, launch `rn-analyst` subagents in one message, each with one
   slice. They're read-only and **return** their findings. You (the orchestrator) write the `analysis/` files.
   Otherwise do the slices one after another:
   - A: entry point, providers, state management, networking layer (auth, refresh, errors) → `analysis/architecture.md`
   - B: navigation tree and every screen → feature grouping → `analysis/feature-catalog.md` (draft)
   - C: every SDK / service integration, push, deep links, analytics wrapper, flags → `analysis/integrations.md`
   - D: every persisted value (inventory *Data at rest* + manual search) → `analysis/data-at-rest.md`
   - E: native modules, config plugins, `patches/`, WebViews → `analysis/native-code.md`
   Every claim needs a `hybrid/<path>:<line>` citation. Mark inferences as *inferred*.

5. **Write the feature catalog** (`analysis/feature-catalog.md`):

   | Feature ID | Name | Routes / screens | Hybrid paths | Depends on | Priority | Wave | Size (S/M/L) | Notes |
   |---|---|---|---|---|---|---|---|---|

   - Every route and screen in the inventory must appear in exactly one feature (or be explicitly out of scope).
   - Always include the core features: `CORE-SESSION` (auth state, token storage/refresh), `CORE-NETWORK`,
     `CORE-SHELL` (launch, splash gating, tabs/root navigation, force update), `CORE-ANALYTICS`, `CORE-PUSH`,
     `CORE-DEEPLINKS`, `CORE-SETTINGS` where they apply.
   - Split anything larger than about 10 ACs (guideline 01 § Sizing).
   - Propose waves by dependency: core first, then primary journeys, then secondary features.

6. **Write `analysis/risks.md`**: start from the inventory's risk table, then add what you found. Columns: risk,
   impact (H/M/L), likelihood (H/M/L), evidence, mitigation, owner (leave blank for humans).

7. **Seed contracts where evidence is clear** (don't invent anything):
   - `contracts/deeplinks.md` from the linking config / route tree
   - `contracts/analytics/events.json` with every event name found (description + `feature`, properties if visible)
   - `contracts/strings/<locale>.json` copied from hybrid i18n files (flatten namespaces as described in guideline 08)

7b. **Read-only check.** After the parallel slices finish, run `git -C hybrid status --porcelain` (and the same in any other
   repo you read). Report anything that changed or appeared. Never clean it up yourself: tell the user what and where.

8. **Handoff document.** Write or refresh `analysis/HANDOFF.md` from `templates/analysis-handoff.md` (the Phase 1 gate).

9. **Report back** to the user: counts (routes, features, deps, persisted keys, native modules), top 5 risks,
   open questions for the product owner, and the proposed first wave. Suggest the next step:
   `node tools/spec.mjs new <ID> "<title>"` + `/spec-feature <ID>` for each wave-1 feature, and
   `/plan-data-migration`.

## Done when

- [ ] The six `analysis/*.md` files (architecture, feature-catalog, integrations, data-at-rest, native-code, risks) exist and cite evidence
- [ ] Every inventory route/screen maps to a feature ID
- [ ] Every inventory data-at-rest row appears in `data-at-rest.md` with a proposed action (keep/migrate/drop)
- [ ] Every high-risk dependency has a native replacement or an open question
