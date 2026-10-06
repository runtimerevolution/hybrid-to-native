# ADR-0016: Platform skill set and precedence

- **Status:** accepted (2026-09-29), amended with `HOW_TO_UPDATE.md`
- **Applies to:** both

## Context

Agents write better platform code when they load current, expert guidance on SwiftUI, Compose, navigation, performance,
accessibility, security and new form factors. Community and vendor "agent skills" provide it, but they change weekly, some
contain outdated or wrong advice, some run scripts, and some contradict the kit's parity rules (e.g. binding styles,
event patterns).

## Options

| Option | Pros | Cons |
|---|---|---|
| No third-party skills; only kit guidelines | Full control | We'd have to maintain platform craft ourselves, and it would go stale |
| Install plugins from marketplaces, tracking `main` | Easy, auto-updates | Unreviewed changes reach every agent; scripts change under us |
| **Curated set, vendored at pinned commits, with a precedence rule** | Reviewable diffs, reproducible, conflicts documented; other agent tools get the model-invocable subset via `.agents/skills` | Manual bumps (monthly); Claude-only fields (`paths`, preloads, on-demand) aren't honoured by other tools |

## Decision

Adopt the curated set in `skills/lock.json`, vendored into `.claude/skills/` (and exposed as `.agents/skills`) by
`tools/skills-sync.mjs` at pinned commits. Precedence: spec + contract → kit guidelines + ADRs → vendor-official skills
→ community skills (`guidelines/14-platform-skills.md` §1). Platform quality reviewers preload the review skills.
Scripted or build-heavy skills are on demand only.

## Consequences

- **`HOW_TO_UPDATE.md`** is the single procedure for updating every third-party dependency (app libraries, vendor SDKs,
  toolchains, generators, test/CI tooling, MCP servers) **and** the skills. It includes how anyone can **propose removing a
  skill** that's no longer needed (§10, `templates/skill-removal-proposal.md`).
- `skills-sync --check` runs in workspace CI. Bumps are PRs reviewed by the platform lead.
- Guidelines 05/06/07 absorbed the best rules from the skills, so the always-on standard doesn't depend on a skill being loaded.
- Each new or bumped skill needs a trial entry in `decisions/skills-evaluations.md`.
