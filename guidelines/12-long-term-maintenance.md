# 12 — Long-term maintenance of two native apps

The main risk of two codebases is **drift**: features, behaviour and quality quietly diverge. These practices
keep the cost of two native apps close to the cost of one.

## 1. Spec-first changes, forever

Every change that users can see goes through the same loop as the migration (`04-parallel-agent-workflow.md`):

1. Update `spec.md`: add or strike ACs, add a *Change log* line, and set status back to `approved` once signed off.
2. Update `contract.md` with the delta only.
3. `/implement-feature <ID>` builds the delta on both platforms at once.
4. `/parity-review <ID>` → both PRs → merge both.

Bug fixes: if the bug is in behaviour shared by both platforms, add an AC that reproduces it and fix both. If it's
platform-specific, fix it in that repo with a test, and check the other platform for the same bug.

## 2. One owner per feature, not per platform

Assign features to a person or pair who owns them **on both platforms**. Platform leads own quality and
architecture. Feature owners own parity.

## 3. Same release train

- Same marketing version on both platforms (`2.14.0`), released in the same week.
- A feature ships on both or on neither. Exceptions need an ADR and a `decisions/divergences.md` entry with an
  end date.
- Release notes come from the specs changed since the last release (the feature IDs in merged PR titles).

## 4. Keep contracts authoritative

- Change APIs in `contracts/openapi` first (ideally owned by the backend and consumed from there), then
  `contracts-sync` on both platforms.
- Design changes come in through `contracts/design-tokens` and the design-system components. Never through feature screens.
- New strings are added to `contracts/strings` only. Hand edits to the generated catalogs fail `contracts-sync --check`.
  Hard-coded UI text in code isn't caught by that, so add a lint rule on each platform (a SwiftLint custom rule against
  string literals in `Text(...)`, Android Lint `HardcodedText` / a detekt rule) and use `L10n` / `R.string` only.
- New analytics events go into `contracts/analytics/events.json` in the same PR as the spec change.

## 5. Watch the parity signals

| Signal | Where | Target |
|---|---|---|
| AC coverage per platform | `parity/STATUS.md` | 100% for `implemented`/`verified` features |
| Platform lag | Merge dates of sibling PRs | Same day |
| Divergences | `decisions/divergences.md` | Few, each with a reason and an end date |
| Crash-free sessions | Crash reporting, per platform | Within 0.3 pt of each other |
| Shared e2e suite | Nightly CI | Green on both |
| Analytics diffs | Nightly for P0 flows | No unexpected diffs |

Run a **parity audit** each month: `/parity-review --all` (or the playbook over every `verified` feature) plus
`parity-report --strict`. File the gaps as normal spec changes.

## 6. Symmetric refactors

Architecture changes (new navigation library, DI change, networking rewrite) are done on **both platforms in the
same period**, recorded in one ADR, and reflected in `05-mirrored-architecture.md`. An asymmetric architecture
makes every future contract harder.

## 7. Dependency hygiene

Follow [`HOW_TO_UPDATE.md`](../HOW_TO_UPDATE.md) for every third-party update (libraries, vendor SDKs, toolchains,
generators, CI tooling, skills). In short:

- Renovate/Dependabot on both repos, with weekly grouped updates and monthly major updates.
- Update Xcode/Swift and AGP/Kotlin/Compose on a fixed schedule (e.g. within 4–6 weeks of stable releases).
  Do it on both platforms in the same period.
- Keep SDK equivalents aligned (same Firebase/Sentry/analytics SDK generations).

## 8. Agent instruction hygiene

The guidelines are code. Treat them like code:

- **Keep always-loaded files small.** `AGENTS.md`, `CLAUDE.md` and `PROJECT.md` are read on every session. Detail
  goes in `guidelines/`, loaded when needed.
- **Every repeated agent mistake becomes one line** in the right guideline's *Things agents get wrong* list,
  in the same PR as the fix. Delete lines that no longer apply. Stale rules cost tokens and confuse agents.
- **Shared rules live once.** The golden rules and conventions in the workspace `AGENTS.md` are copied into each
  native repo's `AGENTS.md` by `node tools/sync-agents-md.mjs`. That's needed because some tools (Codex, cloud agents) never read
  files above a repo's git root. CI runs it with `--check`.
- **Version the kit.** When several apps use this kit, keep a changelog in `README.md` and bring improvements
  back to the template.
- **Review guideline changes** like any other PR: one platform lead + one other reviewer.
- Platform skills are pinned and vendored (`14-platform-skills.md`). Check `skills-sync --outdated` monthly, bump
  through reviewed PRs (`HOW_TO_UPDATE.md` §8), and run a trial before adopting anything new. When a skill stops earning its
  place, anyone can propose removing it (`HOW_TO_UPDATE.md` §10). Re-evaluate the whole set and the MCP servers quarterly
  (`13-agent-skills-and-tools.md`). Vendors retire skills once models no longer need them.

## 9. Documentation that stays true

- Specs are the living documentation. Anyone asking "how does X work?" should find the answer in `specs/`, and the
  `rn-analyst` should no longer be needed after cut-over.
- ADRs record *why*. Specs record *what*. Code records *how*. Don't duplicate across them.
- Each spec's `hybrid_refs` stays after cut-over for history. Add `ios_refs` / `android_refs` when useful.

## 10. Onboarding

New people (and new agents) read, in order: `README.md` → `AGENTS.md` → `PROJECT.md` → `01-migration-plan.md` →
`05-mirrored-architecture.md` → their platform guideline → one `verified` feature folder end to end.
