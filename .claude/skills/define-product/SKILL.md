---
name: define-product
description: 'New-app mode, Phase 1: turn written docs (PRD, briefs), Figma designs and workshops with the product owner into the product brief, journeys, feature catalog with waves, tracking plan and the product handoff. Use in a workspace whose workspace.config.json has "mode": "new", when the user wants to define, scope or plan a new app, ingest a PRD, or run a workshop. Arguments: nothing (resume), "workshop <topic>", or "refresh".'
argument-hint: '[workshop <topic> | refresh]'
---

# define-product: from product sources to the product handoff (new app)

Read `guidelines/15-new-app.md` first. This is the new-app counterpart of `rn-analyze`. Its output is the
**product handoff** (`analysis/HANDOFF.md`), and nothing reaches the development team before that is accepted.

**Ground rules**
- Sources are evidence. You never invent a requirement. A gap becomes an open question with an owner, and a suggestion of
  yours stays a *proposal* until the product owner accepts it.
- Every statement in the brief, the catalog and the specs cites a source ID from `analysis/sources/README.md`.
- No secrets, credentials or personal data in `analysis/`. Workshop notes use roles, not names.
- Reading a file outside the workspace needs the user's OK. It stays read-only, and you record its path and version in the index.

## Arguments

- none: resume from the first unchecked row of `analysis/HANDOFF.md` (or start at Step 1 if it doesn't exist).
- `workshop <topic>`: run one workshop (Step 3) and update whatever it changes.
- `refresh`: a source changed. Re-index it (Step 1) and list the affected features and specs under *Re-check*.

## Step 1: Index the sources

1. Create `analysis/sources/README.md` from `templates/sources-index.md` if it's missing.
2. Ask the user (one batched question) for what exists: written docs (PRD, briefs, research), the design file, earlier
   decisions, constraints (legal, brand, deadline), and who owns each.
3. For each source: give it an ID, record its version or date and owner, and store a copy in `analysis/sources/` (Markdown
   or PDF) if the user agrees, or a link. Read it fully.
4. **Designs:** if a Figma MCP server is configured, list the pages and frames for the journeys and record the file key
   and version. If not, ask for exported frames (PNG) and variables (JSON). Record the choice for ADR-0019.
5. Write down, with citations: the journeys the sources describe, the rules, the conflicts between sources, and the gaps.
   These drive the workshops.

## Step 2: Draft the brief

Write `analysis/product-brief.md` from `templates/product-brief.md`: problem and goal, users, journeys (`J01`…), scope of the
first release, quality targets, constraints and success metrics. Mark everything the sources don't answer as an open
question, then go to Step 3 to close the most important ones.

## Step 3: Workshops (`/define-product workshop <topic>`)

One topic per session, in this order unless the user picks: **vision and users → each critical journey → business rules
per area → quality targets → analytics → launch.**

1. Create `analysis/sources/workshop-<date>-<topic>.md` from `templates/workshop-notes.md` and add it to the index.
2. Start with what the sources already say, with citations, and the open questions for this topic.
3. Ask **at most four questions at a time** (use the question tool when available, with your recommended option first
   and labelled as such). After each round, summarise what you heard and how it changes the brief.
4. Record each answer as a decision (`D01`…) or as an open question with an owner. Mark your own suggestions as
   proposals, and turn them into decisions only when the product owner accepts them.
5. At the end, read the decisions back. Set `status: confirmed` and `confirmed_by` only when the product owner confirms.
   Unconfirmed notes aren't evidence.

## Step 4: Feature catalog and waves

Write `analysis/feature-catalog.md`:

| Feature ID | Title | Journeys | Sources | Priority | Wave | Depends on | Design ready? | API ready? |
|---|---|---|---|---|---|---|---|---|

- Feature IDs follow `AREA-NAME`. One feature is one screen or one flow, about 10 ACs or fewer (guideline 01 § Sizing).
- Wave 1 must reach a tappable screen on both platforms early: app shell, then the first journey's entry screen.
- Payments, purchases and auth/security-sensitive features are built in feature mode (`PROJECT.md` § Working agreements).

## Step 5: Contracts and decisions to prepare

- **ADR-0018 backend approach:** write `decisions/ADR-0018-backend-approach.md` from `templates/adr-backend-approach.md`
  with the options filled in from what you learned. The product owner and the backend lead decide.
- **ADR-0019 design source:** `templates/adr.md`. Record the Figma file and owner, whether agents use the MCP server or exports,
  and the token pipeline.
- **Tracking plan:** draft `contracts/analytics/events.json` for wave 1 from the journeys and success metrics
  (guideline 15 § Analytics), or record "no analytics in v1".
- **Copy:** the base locale file `contracts/strings/<base>.json` starts here, with keys for the wave-1 screens if the copy exists.
- **Store identity:** fill `PROJECT.md` § Identity with the user. Confirm the bundle ID / applicationId explicitly,
  because it can't change after the first upload.
- `analysis/risks.md`: ranked risks with owners (vendor, backend readiness, design readiness, review-guideline risks such as
  login-only apps, payments or user-generated content).

## Step 6: Product handoff

Write `analysis/HANDOFF.md` from `templates/product-handoff.md`. Fill every checklist row with evidence, or mark it open.
Set the status to *ready for review* only when every row has evidence. Then report: counts (journeys, features by priority,
sources, open questions, high risks), the top 5 risks, the decisions needed, the proposed wave 1, and the number of
kit-feedback entries.

Next step: the product owner and both platform leads review the handoff (`/kickoff stakeholder` shows what needs their
decision). After they accept it, write the wave-1 specs (`/spec-feature`), then `/scaffold-native` and the first slice.
