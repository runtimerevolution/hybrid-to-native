# Analysis handoff — <App name>

- **Hybrid analysed:** `<repo>` @ `<sha>` (`<tag / release>`), OTA: <!-- none / channel + latest update -->
- **Analysts:** <!-- tech leads --> · **Started:** <!-- date --> · **Ready for review:** <!-- date -->
- **Status:** in progress | ready for review | accepted | changes requested
- **Reviewed by:** <!-- product owner --> · <!-- the other platform lead -->

## Gate checklist (guideline 01 § Phase 1)

| Item | Status | Evidence |
|---|---|---|
| Every route and screen maps to one feature ID (or is out of scope) | ☐ | `analysis/feature-catalog.md` |
| Every value stored on the device has a decision (migrate / keep / drop) | ☐ | `analysis/data-at-rest.md` |
| Data migration planned | ☐ | `analysis/data-migration.md` |
| Every high-risk dependency has a native replacement or an open question | ☐ | `analysis/integrations.md`, `analysis/native-code.md` |
| Risks ranked, each with an owner | ☐ | `analysis/risks.md` |
| Golden Maestro flows recorded for every critical journey | ☐ | `e2e/flows/` |
| Orientation locks and iPad support noted for *Form factors* | ☐ | `analysis/inventory/INVENTORY.md` § Project |
| Product owner reviewed the feature catalog and the waves | ☐ | this file § Decisions |

## Summary

| | Count |
|---|---|
| Routes / screens | |
| Features (P0 / P1 / P2) | |
| Values stored on the device | |
| Custom native modules | |
| High risks | |

## Decisions needed

| # | Decision | Options | Recommendation | Owner | Due |
|---|---|---|---|---|---|
| 1 | | | | | |

## Proposed wave 1

| Feature ID | Why first | Depends on | Size |
|---|---|---|---|

## Top risks

| Risk | Impact | Likelihood | Mitigation | Owner |
|---|---|---|---|---|

## Kit feedback raised during the analysis

See `kit-feedback.md`: <!-- n entries, blockers: … -->
