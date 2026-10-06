# 15 — New app: from product definition to launch

The kit also builds an app that has no hybrid predecessor. The core loop is the same: spec → contract → iOS and Android
in parallel → parity review. What changes is where the evidence comes from (product sources, not code) and how the app
reaches users (new store listings, not an update).

A workspace is in new-app mode when `workspace.config.json` has `"mode": "new"`. Create one with
`tools/init-workspace.sh <dir> --new`. `/kickoff`, `spec.mjs` and the playbooks read the mode.

## What changes

| Topic | Migration | New app |
|---|---|---|
| Evidence for specs | hybrid code, `hybrid/<path>:<line>` | product sources: PRD, briefs, Figma, confirmed workshop decisions (`analysis/sources/`) |
| Phase 1 | Discovery (`rn-analyze`) | Product definition (`/define-product`) |
| Phase 1 gate | analysis handoff | product handoff (`analysis/HANDOFF.md` from `templates/product-handoff.md`) |
| Strategy | ADR-0002: full rewrite, ship at parity | ADR-0002 doesn't apply. The product owner sets the first release's scope |
| Contracts | derived from the hybrid app (strings and events verbatim) | written: OpenAPI or data model per ADR-0018, copy in `contracts/strings/`, tracking plan, tokens from the design file |
| Parity | native vs hybrid golden reference, and iOS vs Android | iOS vs Android, both against the spec and the designs |
| Golden reference | recorded on the hybrid app | Maestro flows written from the specs; design frames; iOS vs Android analytics diff |
| Device data | migrated from the hybrid app | none: no `plan-data-migration`, no upgrade test |
| Store | same listing, the update keeps users | new listings. The bundle ID / applicationId is permanent from the first upload |
| Not used | | `rn-analyze`, `rn-inventory`, `plan-data-migration`, `port-native-module`, the test-hooks branch, guideline 02, and guideline 11 § Local data migration |

Everything else applies unchanged: guidelines 03–08, 10, 12–14, slice mode, the parity and quality reviewers, ADR-0017.

## Phases and gates

### Phase 0: Setup and decisions
- `init-workspace.sh --new`, then `/kickoff`. `PROJECT.md` is the new-app variant (`templates/PROJECT.new.md`).
- Decide and record: **ADR-0018 backend approach** (`templates/adr-backend-approach.md`), **ADR-0019 design source** (below),
  ADR-0004 min OS (there's no hybrid analytics, so use market data; the default is iOS 17 and minSdk 26), ADR-0014 SDK vendors
  (pick once, same vendor on both platforms), plus the usual 0003–0012.
- Accounts, each with an owner: Apple Developer Program (an organisation account if the app is published under a
  company), App Store Connect, Google Play Console. Personal Play accounts must run a closed test with a minimum number
  of testers for 14 days before they get production access, so check the current rule early or use an organisation account.

**Gate:** ADR-0018 and ADR-0019 accepted. `PROJECT.md` § Identity filled in, or each gap has an owner and a date.

### Phase 1: Product definition (`/define-product`)
Collect and index the sources, run workshops, then write the brief (`analysis/product-brief.md`), the journeys, the feature
catalog with waves (`analysis/feature-catalog.md`), the wave-1 tracking plan and the quality targets.

**Gate: product handoff.** As in a migration, nothing reaches the development team before this gate passes. The product
owner and both platform leads accept `analysis/HANDOFF.md` when:
- every journey maps to feature IDs, and each feature has a priority, a wave and at least one source;
- every source is indexed with a version and an owner, and every conflict between sources is decided or open with an owner;
- workshop notes cited as evidence are confirmed by the product owner;
- the backend for wave 1 is usable: the API exists, a contract-first draft has a running mock, or the BaaS data model is drafted;
- wave-1 designs exist, or the product owner accepts "design during the slice" for named features;
- the wave-1 tracking plan exists (or "no analytics in v1" is recorded);
- locales and the copy owner are known;
- store identity is decided (name, IDs, stores, countries, accounts);
- quality targets are set: there is no hybrid baseline to compare with, so the targets come from the brief.

### Phase 2: Foundations
`/scaffold-native` generates both projects from the kit templates and shows them running. Contracts follow ADR-0018. Design
tokens come from the design file (guideline 08). The first slice reaches a tappable screen on both platforms, as in a
migration.

### Phase 3: Feature waves
The same loop as guideline 01 § Phase 3. Specs cite source IDs. When a source changes (a new PRD version, an edited Figma
frame), list the affected specs in `analysis/sources/README.md` § Re-check and change them through the normal spec
change process (guideline 03). This is the new-app equivalent of the hybrid freeze policy.

### Phase 4: Hardening
No upgrade test. Instead: first install and onboarding on clean devices, permission prompts and denials, account
creation and **in-app account deletion** (both stores require it when users can create accounts), privacy (App Privacy
details, Google Play Data safety, the iOS privacy manifest), accessibility, every locale, offline and poor network,
and the quality targets from the brief, measured on mid-range devices.

### Phase 5: Launch
- Store listings: name, subtitle / short description, screenshots for every required device size, privacy policy URL,
  age rating, support URL, and App Review notes with a review account if login is required (never a real user's account).
- TestFlight (external testing needs a beta review) and Play closed testing, then production. Launch on both stores the same
  day unless an ADR says otherwise.
- Decide the safety net in advance: remote-config kill switches, and a soft launch in a few countries if the product
  owner wants one. Guideline 11 § Rollout still applies from the first update on. The first release has no upgrade path to protect.

### Phase 6: Steady state
Guideline 12, unchanged.

## Product sources (`analysis/sources/`)

`analysis/sources/README.md` (from `templates/sources-index.md`) indexes every source with a stable ID, type, version or
date, owner and location. Specs put the IDs in `sources:` (front matter) and in each AC's *Evidence*:

| Source | Citation |
|---|---|
| PRD section | `prd:§3.2` |
| Brief page | `brief:p4` |
| Figma frame | `figma:<node-id>` (frame name in words next to it) |
| Workshop decision | `workshop:2026-10-02#D03` |

- Store copies (Markdown, PDF) when allowed, otherwise link. Never secrets, credentials or personal data.
- Sources disagree? The product owner decides, the decision goes in a workshop note, and the spec cites that note.
- A gap (a state the PRD doesn't describe, a frame with no error state) goes in the spec's *Conflicts and gaps in the
  sources* or *Open questions*, never into an invented requirement.

## Workshops with Claude

`/define-product workshop <topic>` runs a structured session with the product owner (and anyone else they bring). Each
session covers one topic: vision and users, one journey, the business rules of one area, quality targets, analytics, or
launch.

- The agent asks at most four questions at a time, summarises back what it heard, and writes
  `analysis/sources/workshop-<date>-<topic>.md` from `templates/workshop-notes.md`. Each decision gets an ID (`D01`…).
- The agent may **propose** (options, a default, a typical flow from similar apps). A proposal is recorded as one and
  becomes a decision only when the product owner accepts it.
- The notes count as evidence only after the product owner confirms them (`status: confirmed`). Use roles, not people's names.

## Designs (ADR-0019)

Decide in ADR-0019 which file is the design source, who owns it, and how agents read it:
- **Figma MCP server** (the desktop app's Dev Mode server, or Figma's remote server): agents read frames, screenshots, variables
  and Code Connect mappings directly. Add it per guideline 13 §3 and §8 (one server, read-only, scoped to the design file).
- **Without MCP:** export the wave's frames as PNG into `specs/features/<ID>/assets/design/` and the variables as JSON.
- **Tokens:** Figma variables → `contracts/design-tokens/` (DTCG JSON, from an export plugin or the Variables REST API on
  Enterprise plans) → Style Dictionary → both platforms (guideline 08). Hard-coded colours and spacing are review findings.
- **Code Connect** (optional) maps design-system components to the SwiftUI and Compose components once they exist.

Designs define layout and visuals. The spec defines behaviour. Frames usually miss states (loading, empty, error, offline, large
text), and the spec still requires every one. Designs are often drawn for one platform: functional parity, native idioms
(guideline 01 § What parity means). Differences go under the spec's *Platform differences*.

## Backend approach (ADR-0018)

| Option | Contract | Apps build against | Watch out for |
|---|---|---|---|
| **A. Existing API** | the backend's OpenAPI, copied to `contracts/openapi/api.yaml` (write it from the docs and confirm with the backend team if there's none) | dev / staging | endpoints that don't fit the mobile journeys: raise them in Phase 1 |
| **B. Contract-first, built in parallel** | `contracts/openapi/api.yaml`, written first and reviewed by the backend lead with each slice | a mock generated from the contract (e.g. `npx @stoplight/prism-cli mock contracts/openapi/api.yaml`; ask before installing) plus `contracts/fixtures/` | drift: the backend runs contract tests against the same file; every change is a contract change request |
| **C. BaaS** (Firebase, Supabase…) | `contracts/data-model.md`: entities, fields, types, indexes, who can read and write | the vendor's local emulator, then a dev project | logic in security rules: test the rules; same SDK vendor on both platforms |

Specs name operations (`operationId`) or data-model entities, never URLs. Never point agents at production data.

## Analytics, strings and accessibility from scratch

- **Tracking plan:** write `contracts/analytics/events.json` in Phase 1 from the journeys and success metrics. Use
  `object_action` names in snake_case, typed properties, and a `feature` and `description` on each event. With no
  hybrid baseline, the analytics diff compares the iOS and Android streams of the same Maestro flow:
  `node tools/analytics-diff.mjs ios.jsonl android.jsonl`.
- **Copy:** written in `contracts/strings/<base>.json` with `<feature>.<screen>.<element>` keys and reviewed by the copy owner.
  Translations come back as `contracts/strings/<locale>.json`. Agents never hard-code copy.
- **Test IDs:** there are no hybrid `testID`s to reuse, so every ID follows `<screen>.<element>` (AGENTS.md § Conventions).

## Golden reference

There's no running app to record. The reference is built from the specs:
1. Each critical journey in the brief gets a Maestro flow in `e2e/flows/`, written from the specs' e2e ACs before or
   during the slice, and run on both apps.
2. The design frames are the visual reference. Reviewers compare the layout-matrix images against them.
3. iOS vs Android analytics diffs (above).

## Things agents get wrong (new apps)

- Filling a gap in the PRD with a plausible requirement. Write an open question instead.
- Treating a Figma frame as the whole behaviour spec, so loading, error and empty states go missing.
- Copying an iOS-only design onto Android verbatim (back behaviour, sheets, typography).
- Hard-coding copy or colours "until the contract exists". Add the key or token to `contracts/` first.
- Using a placeholder bundle ID in anything that gets uploaded.
