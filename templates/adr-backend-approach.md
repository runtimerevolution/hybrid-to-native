# ADR-0018: Backend approach

- **Status:** proposed <!-- proposed → accepted -->
- **Date:** <!-- -->
- **Deciders:** <!-- product owner, backend lead, iOS lead, Android lead -->

## Context

Both apps need the same backend contract, and agents build each feature against it. Guideline 15 § Backend approach
describes the three options. <!-- What exists today: an API? a backend team? a deadline? data residency rules? -->

## Options

| | A. Existing API | B. Contract-first, built in parallel | C. Backend-as-a-service |
|---|---|---|---|
| Source of truth | the backend's OpenAPI, copied to `contracts/openapi/api.yaml` | `contracts/openapi/api.yaml`, written first and reviewed by the backend lead | `contracts/data-model.md` (collections/tables, fields, rules) + security rules in the backend repo |
| Apps build against | dev / staging environment | a mock server generated from the contract, then dev | the vendor's local emulator, then a dev project |
| Client code | generated from OpenAPI (ADR-0008) | generated from OpenAPI (ADR-0008) | the vendor's official SDKs on both platforms (ADR-0014) |
| Fixtures | scrubbed real responses | written with the contract, and used by the mock | exported emulator data |
| Changes | backend change → new contract → CCR | contract change request first, then both sides | data-model change → rules + both apps |
| Risk | the API doesn't fit the mobile journeys | backend drifts from the contract → contract tests needed | vendor lock-in; logic in rules is hard to test |

## Decision

<!-- A / B / C, and why. For B: the mock tool, who runs the backend's contract tests, and the date the real
     environment replaces the mock. For C: the vendor, region, and how rules are tested. -->

## Consequences

- `PROJECT.md` § Backend and § Environments are filled in.
- `contracts/README.md` says where the contract lives and how it's regenerated.
- Specs name operations (`operationId`) or data-model entities, never URLs.
