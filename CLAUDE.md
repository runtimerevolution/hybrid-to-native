@AGENTS.md
@PROJECT.md

## Claude Code specifics

- Start a new workspace with `/kickoff` (re-run it any time; `/kickoff engineer`, `/kickoff stakeholder` etc. switch role). The playbooks in `AGENTS.md` are Claude Code **skills**. Invoke them as `/rn-analyze` (or `/define-product` for a new app), `/spec-feature AUTH-LOGIN`, `/scaffold-native`,
  `/implement-slice SLICE-01` (default build loop), `/implement-feature AUTH-LOGIN` (risky features), `/parity-review AUTH-LOGIN`, `/port-native-module <Name>`, `/plan-data-migration`.
- **Subagents** in `.claude/agents/`:
  - `rn-analyst`: read-only. Explores `hybrid/` and answers "how does X work today?" with file:line evidence.
  - `ios-engineer` / `android-engineer`: implement one feature in their own repo. They can run in parallel.
  - `parity-reviewer`: read-only. Compares both implementations against the spec and contract.
  - `ios-quality-reviewer` / `android-quality-reviewer`: read-only platform-craft reviews with preloaded skills.
- **Platform skills** (`swiftui-expert`, `android-*`, `iphone-duo-*`, `xcode-build-*`…) are vendored third-party
  skills, scoped with `paths` to `ios/**` / `android/**`. Never edit them in place. Guideline 14 has the precedence and
  overrides. On-demand ones run only when a human invokes them (`/xcode-build-orchestrator`).
- When building a feature, launch `ios-engineer` and `android-engineer` **in the same message** so they run
  concurrently. They work in different git repos, so they don't need worktree isolation.
- Each native repo has its own `AGENTS.md` / `CLAUDE.md` with build and test commands. Claude Code loads them
  when it works on files in that directory.
- Keep this file and `AGENTS.md` short. Detail belongs in `guidelines/`. When an agent keeps making the same mistake,
  add one line to the right guideline (see `guidelines/12-long-term-maintenance.md` § Agent instruction hygiene).
