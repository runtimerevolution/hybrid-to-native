# 04 — Parallel agent workflow: one spec, two platforms

## Two modes: slice (default) and feature

Both modes keep the same guarantees: one approved spec and one contract per feature, the same names on both platforms,
AC-tagged tests on both, and parity and quality reviews before anything merges. What differs is how much ceremony each
feature carries.

| | **Slice mode (default)**, playbook `implement-slice` | **Feature mode**, playbook `implement-feature` (this file, Steps 0–5) |
|---|---|---|
| Unit of work | A vertical slice: features that together give something tappable | One feature |
| Contracts | Written for the whole slice in one batch, one human OK | One per feature; human OK for P0 |
| Build | One session per platform builds the slice in dependency order, tests green after each feature | One session per platform per feature |
| Contract problems | **CCR-and-continue**: log it, take the most conservative reading, keep going; resolved for both platforms once | Stop that part until the contract is fixed |
| Show the app | As soon as it builds with a screen, before any review | After merge |
| Reviews | One parity + quality pass per slice | Parity + quality per feature |
| Wording-only spec fixes | `spec.mjs amend --editorial`, acknowledged in one go at the end of the slice | Same |
| Use for | Everything, by default | Risky features: local data migration, payments and purchases, auth/security-sensitive flows (`PROJECT.md` § Working agreements), or when the product owner asks |

**Why slice mode is the default:** in the first pilot, the per-feature loop took about two days from the accepted handoff to the first
screen the product owner could tap. Seven human re-approvals in one day were caused by wording alignments. Batching the human
steps and the reviews per slice got both apps tappable within a day, without losing any parity check.

**The first engineering milestone is always a tappable slice** (launch → login → main screen) on both platforms. Order
wave 1 by what produces UI soonest. Non-UI features (for example the data migrator) never block the first screen. Build them in a
later slice, or in feature mode in parallel.

The rest of this file describes **feature mode** step by step. Slice mode runs the same steps once per slice, with the
batching above (see the `implement-slice` playbook).

## Feature mode

It's the same during the migration and after launch.

```
          ┌────────────┐   approve    ┌──────────────┐  approve (P0)  ┌───────────────────────┐
hybrid ─▶ │  spec.md   │ ───────────▶ │ contract.md  │ ─────────────▶ │ ios-engineer  (ios/)  │──┐
code      │ (neutral)  │   (human)    │ (shared names│    (human)     ├───────────────────────┤  │
          └────────────┘              │  and shapes) │                │ android-engineer      │──┤
                ▲                     └──────────────┘                │           (android/)  │  │
                │ contract change request      ▲                      └───────────────────────┘  │
                └──────────────────────────────┴──────────────── impl-ios.md / impl-android.md ◀─┘
                                                                              │
                     parity-reviewer ∥ ios-quality-reviewer ∥ android-quality-reviewer ◀─┘
                                                    │ review.md (+ review-quality-*.md): PASS / FAIL
                                                    ▼
                                    human review + merge of BOTH PRs ──▶ status: implemented
```

## Step 0: Preconditions (the orchestrator checks them)

- `node tools/spec.mjs check <ID>` passes: the spec is `approved` (or later) and hasn't changed since approval.
- Everything the spec depends on (`depends_on`) is at least `implemented` on both platforms.
- The contracts it references exist: API operations in `contracts/openapi`, string keys in `contracts/strings`,
  events in `contracts/analytics`. If one is missing, add it to `contracts/` first and regenerate on both platforms.

## Step 1: Contract (`contract.md`, template `templates/feature-contract.md`)

The orchestrator (main agent session at the workspace root) writes it. Before anyone writes code, the contract pins down every name the
two implementations must share:

- Module/package and file names on each platform
- `UiState` fields (neutral types, see `05-mirrored-architecture.md` § Type mapping)
- `Action`s (user intents) and `Effect`s (one-off events: navigate, show message, open URL)
- Repository/service interfaces and domain models, with neutral signatures
- Test IDs, string keys, analytics events (with the exact trigger point)
- For each AC: the test level on each platform, and the Maestro flow file if it's `e2e`

Human approval is **required for P0 features** and optional otherwise (`PROJECT.md` § Working agreements can change this).

## Step 2: Parallel implementation

Launch **both platform agents at the same time**. Each receives exactly the same inputs:

| Input | Path |
|---|---|
| Spec | `specs/features/<ID>/spec.md` |
| Contract | `specs/features/<ID>/contract.md` |
| Platform guideline | `guidelines/06-ios-guidelines.md` or `guidelines/07-android-guidelines.md` |
| Repo rules | `ios/AGENTS.md` or `android/AGENTS.md` |
| Reference screenshots | `specs/features/<ID>/assets/` |

Each platform agent:
1. Creates branch `feature/<ID>` in its own repo (or continues it).
2. Implements in **checkpoints** (one per screen state or AC group). At each checkpoint it builds, runs
   tests, and commits `[<ID>] <what>`.
3. Writes tests that carry the AC IDs (`10-testing-and-parity.md`).
4. Runs the repo's full check (build + lint + unit tests + relevant UI tests).
5. Writes `specs/features/<ID>/impl-<platform>.md` (template `templates/impl-notes.md`): what was built,
   test → AC mapping, deviations, **Contract change requests (CCR)**, open questions.
6. **Never** edits `spec.md`, `contract.md`, the other platform, or `hybrid/`.

**Contract change request:** if the contract is wrong or incomplete (a missing state, an impossible
signature), the agent stops that part, writes a CCR in its impl notes, and finishes whatever it can. The orchestrator
updates `contract.md`, then tells **both** agents about the change, even if only one asked for it.

## Step 3: Parity review

Launch `parity-reviewer` (read-only) after both agents finish. It runs the `parity-review` playbook and writes
`review.md` with verdict **PASS**, **PASS WITH NOTES**, or **FAIL**, and a numbered finding list tagged `[ios]`, `[android]` or `[both]`.

In the same message, also run the **platform quality reviewers** (for the priorities set in `PROJECT.md`, default P0 + P1):
`ios-quality-reviewer` and `android-quality-reviewer`. They preload the platform skills (guideline 14) and write
`review-quality-ios.md` / `review-quality-android.md`. They don't share the parity reviewer's context, so they catch
different mistakes. The orchestrator merges all verdicts into `review.md`, and the worst one wins.

**Verdicts and merging** (quality-review verdicts follow `templates/quality-review.md`: their PASS WITH NOTES items are
simply fixed in Step 4, with no spec change):
- **PASS**: merge both PRs.
- **PASS WITH NOTES**: each note is either fixed (back to Step 4) or accepted by the product owner as a platform
  difference. Accepting it means editing the spec's *Platform differences* and re-approving
  (`spec.mjs approve <ID> --by …`), because the content hash changes. Then merge.
- **FAIL**: back to Step 4.

## Step 4: Fix loop

The orchestrator sends each platform agent only its own findings. Repeat Steps 2–3 at most **3 times**. If it still
fails, escalate to the humans with the review attached. Don't loop forever.

## Step 5: Pull requests and merge

- One PR per repo, both titled `[<ID>] <spec title>` (commits inside use `[<ID>] <imperative summary>`). Each PR
  description links the spec, the contract, `review.md`, and the sibling PR.
- A human reviews each PR. **Merge both or neither.** If one platform must ship alone, you need an ADR
  and an entry in `decisions/divergences.md`.
- After merge: set spec status to `implemented` (`node tools/spec.mjs status <ID> implemented`) and regenerate
  `parity/STATUS.md`.

## Running it

### Claude Code (recommended: start the session at the workspace root)

```
/implement-feature AUTH-LOGIN
```

The skill writes the contract, launches `ios-engineer` and `android-engineer` subagents in one message (so
they run concurrently), then runs `parity-reviewer`. The two native repos are separate directories, so the
agents never touch the same files.

Start Claude Code **at the workspace root**, not inside `ios/` or `android/`. Claude Code only finds skills
between the working directory and the git root. Each native folder is its own git repo, so a session started
inside it won't see the workspace skills.

### Other agents (Codex, Cursor, Copilot, Gemini, Xcode / Android Studio agents)

Open two sessions, one per platform. Paste this prompt into both, changing only the platform. These tools don't
preload skills, so the prompt names the skill files to read (`.agents/skills` links to the same vendored set):

```text
You are the <iOS|Android> engineer for feature <ID> in the hybrid→native migration workspace.
Read, in order: AGENTS.md, PROJECT.md, guidelines/04-parallel-agent-workflow.md,
guidelines/05-mirrored-architecture.md, guidelines/<06-ios|07-android>-guidelines.md, <ios|android>/AGENTS.md,
guidelines/14-platform-skills.md §4, <.agents/skills/swiftui-expert/SKILL.md | the relevant .agents/skills/android-*/SKILL.md>,
specs/features/<ID>/spec.md, specs/features/<ID>/contract.md.
Implement the contract in <ios|android>/ only, on branch feature/<ID>, in checkpoints.
Tag every test with its AC ID. Run build, lint and tests. Write specs/features/<ID>/impl-<ios|android>.md
from templates/impl-notes.md. If the contract is wrong, write a Contract change request there and stop that part.
Do not edit spec.md, contract.md, the other platform, or hybrid/.
```

Then run the `parity-review` playbook in a third session. For platform quality, run one more session per platform
using `.claude/agents/ios-quality-reviewer.md` / `android-quality-reviewer.md` as the prompt. Tell it to read the skill files
those agents would preload (`.agents/skills/swiftui-expert/SKILL.md`; `.agents/skills/compose-performance-audit`,
`android-intent-security`, `android-permissions-security`).

Tools that only see one repo (for example cloud agents attached to `ios/` alone) can't read the workspace.
Paste the spec and contract into the task. The repo's own `AGENTS.md` carries the shared rules
(synced by `tools/sync-agents-md.mjs`).

## Rules of thumb

- **Same inputs, same time.** If you start one platform later, the second agent quietly reinterprets the spec. Build both together.
- **The contract is cheap; rework is expensive.** Spend the time on Step 1.
- **Keep sessions small.** One feature per session. For big features, one checkpoint group per session, with impl notes
  as the handover.
- **Agents report; humans decide.** Any change to scope, the spec or the contract goes through the orchestrator and, where required,
  a human.
