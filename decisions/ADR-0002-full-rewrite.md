# ADR-0002: Strategy — full rewrite, ship when at parity

- **Status:** accepted
- **Applies to:** workspace

## Context

Options were a full rewrite (hybrid stays live until cut-over) or an incremental "strangler" (native shells hosting
remaining RN screens).

## Decision

**Full rewrite.** Both native apps are built alongside the live hybrid app and released as an update to the same
store listings once every P0 feature is `verified` and the upgrade test passes (`guidelines/01-migration-plan.md`).

## Consequences

- No brownfield RN embedding, so there's no bridge code to maintain in the native apps.
- The hybrid app is frozen to critical fixes, and each change is mirrored into its spec.
- The cut-over is one big event per platform. Mitigate with phased/staged rollout, remote kill switches and a
  non-destructive local data migration (`guidelines/11-cutover-and-release.md`).
