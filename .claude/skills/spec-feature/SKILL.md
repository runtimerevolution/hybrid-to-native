---
name: spec-feature
description: 'Write one feature as a platform-neutral spec (specs/features/<ID>/spec.md) with numbered acceptance criteria, evidence citations, platform differences and open questions. In a migration the evidence is the React Native / Expo code; in a new app it is the product sources (PRD, Figma, confirmed workshop notes). Use when the user wants to specify, document or update a feature before building it natively. Argument: the feature ID, e.g. AUTH-LOGIN.'
---

# spec-feature: write the spec from the evidence

> **New-app mode** (`workspace.config.json` → `"mode": "new"`, guideline 15): the evidence is the product sources, not
> `hybrid/`. Steps 2, 3 and 6 change as marked **[new app]**. `spec.mjs new` already gives the right template
> (`sources:` instead of `hybrid_sha` / `hybrid_refs`, *Conflicts and gaps in the sources*, `assets/design/`).

Input: a feature ID (`$ARGUMENTS`), and its row in `analysis/feature-catalog.md` if one exists.
Read `guidelines/03-feature-specs.md` first. It defines the format, the rules and the quality checklist.

## Steps

1. **Scaffold** if needed: `node tools/spec.mjs new <ID> "<title>" --priority <P> --wave <N>`.
   If the spec already exists and isn't `draft`, you're making a **change**. Follow § Changing an approved spec below.

2. **Collect evidence.** Start from the catalog row's routes and paths. Follow the data:
   screen → hooks → state → services/API → storage (guideline 02 §4 table). If subagents are available, delegate
   the reading to `rn-analyst` with a precise question list. Record `hybrid_sha` and `hybrid_refs` in the front matter.
   **[new app]** Start from the catalog row's journeys and sources. Read the PRD sections, the *confirmed* workshop
   decisions and the design frames (Figma MCP server, or the exports). List the source IDs in `sources:` and cite them in
   every AC's *Evidence*. Unconfirmed workshop notes aren't evidence.

3. **Observe if possible.** If the hybrid app runs locally (simulator + Metro) and the user agrees, walk the flow,
   capture each state as `specs/features/<ID>/assets/hybrid/<state>.png` (or with a Maestro flow and
   `takeScreenshot`), and confirm what the code suggests.
   **[new app]** Put each state's design frame in `specs/features/<ID>/assets/design/<state>.png` (or link the Figma node).
   Missing states (loading, empty, error, offline, large text) still get rows in *Screens and states*, and an open
   question for the designer.

4. **Fill every section of the template.** Describe behaviour in neutral words. Use contract vocabulary for
   operation IDs, string keys, analytics events and test IDs. If one doesn't exist in `contracts/` yet, add it there
   (or list it under *Open questions* if its shape is unclear).

4b. **Form factors** (ADR-0017): fill in every row. Evidence comes from the inventory (`orientation`, iPad support,
   orientation-lock libraries) and the screen's layout code. If nothing changes on large screens, write "same as phone,
   max content width". `spec.mjs approve` refuses an empty section. Add an iPad row if the hybrid app supports iPad.
   **[new app]** Evidence comes from `PROJECT.md` (devices, phone orientation policy) and the design frames.

5. **Write acceptance criteria.** One behaviour each, Given/When/Then, numbered `<ID>-AC01…`, each with
   *Evidence* and *Test level* (`unit` / `ui` / `e2e`; at least one `e2e` for P0 journeys). Cover every state in
   *Screens and states*, every validation rule, every error type, and every analytics event.

6. **Separate facts from doubts.**
   - Behaviour that looks wrong → *Known hybrid issues*, with a recommendation (don't encode it as an AC).
     **[new app]** Sources that disagree, or a gap none of them covers → *Conflicts and gaps in the sources*, with a
     recommendation. Never fill a gap with a requirement nobody stated.
   - Anything that depends on backend/remote config, or that you can't confirm → *Open questions*, with an owner.
   - Every `Platform.OS` / `.ios.tsx` / `.android.tsx` branch → *Platform differences* (keep, or propose unifying).

7. **Self-check** against the checklist at the end of guideline 03. Then run
   `node tools/parity-report.mjs --feature <ID>` to confirm the tool finds your ACs.

8. **Hand over.** Leave `status: draft`. Tell the user what's needed for approval (the open questions) and the
   command they'll run: `node tools/spec.mjs approve <ID> --by "<name>"`. Never approve a spec yourself.

## Changing an approved spec

- Edit only what changes. Add ACs with new numbers. Strike removed ACs (`~~**<ID>-AC04**~~ (removed)`) and never reuse
  their numbers. Add a *Change log* row.
- The content hash will no longer match. That's intended. The spec needs re-approval before `implement-feature`
  can build the delta.
- Say explicitly which ACs are new, changed or removed, so the contract delta is obvious.
