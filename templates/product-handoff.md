# Product handoff — <App name>

> New-app mode (guideline 15 § Phase 1 gate). The new-app counterpart of the analysis handoff: nothing reaches the
> development team until the product owner and both platform leads accept this file. Written by `/define-product`.

- **Sources:** `analysis/sources/README.md` (<!-- n sources -->) · **Brief:** `analysis/product-brief.md`
- **Analysts:** <!-- tech leads --> · **Started:** <!-- date --> · **Ready for review:** <!-- date -->
- **Status:** in progress | ready for review | accepted | changes requested
- **Reviewed by:** <!-- product owner --> · <!-- iOS lead --> · <!-- Android lead -->

## Gate checklist (guideline 15 § Phase 1)

| Item | Status | Evidence |
|---|---|---|
| Every journey in the brief maps to feature IDs. Each feature has a priority, a wave and at least one source | ☐ | `analysis/feature-catalog.md` |
| Every source is indexed with a version and an owner. Conflicts between sources are decided or open with an owner | ☐ | `analysis/sources/README.md` |
| Workshop notes used as evidence are confirmed by the product owner | ☐ | `analysis/sources/workshop-*.md` |
| Backend approach decided (ADR-0018), and the wave-1 API exists, is drafted contract-first with a mock, or the BaaS data model is drafted | ☐ | `decisions/ADR-0018-*.md`, `contracts/` |
| Design source decided (ADR-0019). Wave-1 designs exist, or the product owner accepts "design during the slice" for named features | ☐ | `decisions/ADR-0019-*.md`, Figma links in the catalog |
| Tracking plan for wave 1, or "no analytics in v1" recorded | ☐ | `contracts/analytics/events.json` |
| Locales and the copy owner known | ☐ | `PROJECT.md` § Identity |
| Store identity decided: name, bundle ID / applicationId, stores, countries, developer accounts (or an owner and a date) | ☐ | `PROJECT.md` § Identity |
| Non-functional targets set: accessibility level, performance budgets (cold start, app size), offline, privacy | ☐ | `analysis/product-brief.md` § Quality targets |
| Risks ranked, each with an owner | ☐ | `analysis/risks.md` |
| Product owner reviewed the feature catalog and the waves | ☐ | this file § Decisions |

## Summary

| | Count |
|---|---|
| Journeys | |
| Features (P0 / P1 / P2) | |
| Sources (docs / design files / workshops) | |
| Open questions | |
| High risks | |

## Decisions needed

| # | Decision | Options | Recommendation | Owner | Due |
|---|---|---|---|---|---|
| 1 | | | | | |

## Proposed wave 1

The first slice should reach a tappable screen on both platforms early (guideline 01 § Phase 2).

| Feature ID | Why first | Depends on | Design ready? | API ready? | Size |
|---|---|---|---|---|---|

## Top risks

| Risk | Impact | Likelihood | Mitigation | Owner |
|---|---|---|---|---|

## Kit feedback raised during product definition

See `kit-feedback.md`: <!-- n entries, blockers: … -->
