---
name: kickoff
description: 'Start or resume the process in a workspace (a hybrid → native migration, or a new app), from the point of view of one role (analyst, engineer, stakeholder or QA). Safe to run again at any time, for example to switch role: /kickoff stakeholder, then /kickoff engineer. Checks the setup, fills PROJECT.md, and for analysts runs discovery (migration) or product definition (new app) up to the handoff. Use as the first command in a new workspace, or when someone asks "how do I start?", "where are we?" or "what do I need to do?".'
argument-hint: '[analyst | engineer | stakeholder | qa]'
---

# kickoff: start (or resume) the process for this app, for one role

Analysis always comes first (guideline 01 § Phase 1 gate). Nothing reaches the development team until the analysis
handoff is accepted. Each run shows the process from one role's point of view. **Run it as often as you like and switch
roles freely.** One person can hold several roles (a tech lead may be analyst first and engineer later). Roles describe
the task at hand, not permissions.

**Re-running is safe:** files are created only if missing, answers already in `PROJECT.md` aren't asked again, and
discovery isn't re-run unless the analyst asks for a refresh.

## 0. Where are we?

**Mode first:** `workspace.config.json` → `mode`. `"new"` means a new app with no hybrid predecessor: follow
§ New-app mode below wherever it differs, and skip every `hybrid/` check. Anything else (or no `mode`) is a migration.

Check, and report in a short table:
- This is a workspace: `AGENTS.md`, `tools/`, `VERSION` exist. Run `node tools/kit-update.mjs --status` for the kit version.
- `hybrid/` exists and is a git repo (`git -C hybrid rev-parse --short HEAD`). If it's missing, tell the user to clone it
  (`git clone <url> hybrid` from the workspace root, or re-run `tools/init-workspace.sh … --hybrid <url>`) and stop.
- The React Native app folder in `workspace.config.json` (`hybrid.app`), or "not confirmed yet".
- `ios/` and `android/`: present or not. Before Phase 2 they're usually empty or missing. That's fine.
- `PROJECT.md` § Current status (phase), and `analysis/HANDOFF.md`: missing / in progress / ready for review / accepted.
- **Which branch is checked out in `hybrid/`, and is it the live one?** If the version isn't pinned yet, run
  `node tools/rn-inventory.mjs --find-apps --branches` and show it. Every view may otherwise draw conclusions from a stale
  default branch. Checking out another branch needs the user's OK.
- `git -C hybrid status --porcelain` is clean. If not, report the changed files. `hybrid/` is read-only, so don't clean it yourself.
- `kit-feedback.md` exists. If not, create it from `templates/kit-feedback.md`.

## New-app mode (`"mode": "new"`, guideline 15)

The same roles, views and rules, with these differences:
- **§0:** instead of the `hybrid/` rows, report `analysis/sources/README.md` (number of sources, and whether a design
  file is indexed), `analysis/product-brief.md` (missing / draft), confirmed vs draft workshop notes, and
  `analysis/HANDOFF.md` (the **product** handoff).
- **Stakeholder:** decisions waiting are ADR-0018 (backend approach) and ADR-0019 (design source), the first release's
  scope, store identity (name, bundle ID / applicationId, stores, countries, developer accounts), quality targets, workshop
  notes waiting for confirmation, and open questions in the brief. There's no hybrid change policy and no *Store status* row.
- **Engineer:** the same, plus: Phase 2 starts with `/scaffold-native`. Before the handoff, the useful reading is
  guideline 15, then 04, 05, 06 / 07, 10 and 14.
- **QA:** critical journeys come from the brief. Golden flows are written from the specs, not recorded (guideline 15
  § Golden reference). Instead of the upgrade test, plan first-install, permission and account-deletion tests.
- **Analyst:** follow the `define-product` playbook (index sources → brief → workshops → catalog and waves → ADR-0018 /
  ADR-0019 drafts, tracking plan, store identity → product handoff) instead of §5 steps 1–7. `PROJECT.md` is the new-app
  variant (`templates/PROJECT.new.md`). Set § Current status to *Phase 1 Product definition*.
- Not used: `rn-inventory`, `rn-analyze`, `plan-data-migration`, the test-hooks branch.

## 1. Which role this time?

- If the arguments (`$ARGUMENTS`) name a role, use it without asking. Accept common synonyms:
  *analyst* (tech lead, lead, discovery); *engineer* (dev, developer, ios, android); *stakeholder* (po, product owner,
  product, manager, management, client); *qa* (tester, quality).
- Otherwise ask (one question): **Analyst** (tech lead running discovery) · **Engineer** · **Stakeholder** · **QA**.
- Then show that role's view (§2–§5). Only read what exists. Write to files only what the user confirms.
- **End every view** with the line: *Switch role at any time: `/kickoff analyst` · `/kickoff engineer` · `/kickoff stakeholder` · `/kickoff qa`.*
  Before the handoff is accepted, add: *Discovery moves forward only in the analyst view.*

## 2. Stakeholder view

For product owners and management. The questions are what's decided, what's at risk, and what needs their sign-off.

1. **Where we are:** phase, handoff status, and (from Phase 2) `node tools/spec.mjs list` totals by status plus the
   coverage line of `parity/STATUS.md` (regenerate it with `node tools/parity-report.mjs --out parity/STATUS.md`).
2. **Decisions waiting for you**, gathered from:
   - `analysis/HANDOFF.md` § Decisions needed (if it exists);
   - `decisions/README.md` § To decide;
   - `PROJECT.md` § Working agreements still at their defaults (phone orientation policy, which priorities need contract
     approval, which get platform quality reviews) and empty rows in § People;
   - draft specs with open questions (`spec.mjs list`, then each spec's *Open questions*);
   - `PROJECT.md` § Current status → *Hybrid change policy* still empty (the freeze policy is a Phase 0 decision, and urgent
     if the hybrid repo shows recent feature commits: `git -C hybrid log --since=60.days --oneline | wc -l`);
   - § Identity → *Store status* per platform still empty (shipped / never shipped);
   - editorial amendments waiting for acknowledgement (`spec.mjs list` shows "+N editorial").
   Offer to record their answers in **one** batched question. Write only what they confirm.
3. **Scope and waves:** the feature catalog and proposed wave 1 (`analysis/feature-catalog.md`, `HANDOFF.md`), or
   "not analysed yet, the analyst view produces this".
4. **Top risks:** from `HANDOFF.md`, else the risk table in `analysis/inventory/INVENTORY.md`, else "not scanned yet".
5. **What you'll sign off, and when:** the analysis handoff (Phase 1), each spec, and release and kill criteria (Phase 5).
   Also how progress is measured (guideline 01 § Sizing and tracking).
6. **Read more:** the stakeholder view of `docs/kit-guide.html`, or of the app's brief artifact if one was published.

## 3. Engineer view

For iOS and Android developers.

**Before the handoff is accepted:**
1. **What's coming:** the proposed wave 1 and draft specs, if any.
2. **Get ready**, and report what's missing without installing anything: `xcodebuild -version`, `$ANDROID_HOME` / the
   Android CLI, `maestro --version`, `node -v`, `node tools/skills-sync.mjs --check`.
3. **Read, in this order**, with one line on what each gives you: guidelines 04 (the loop), 05 (the shared shape),
   06 / 07 (your platform), 10 (tests and parity), 14 (skills and precedence).
4. **Native repos:** whether `ios/` and `android/` exist. They're created at the start of Phase 2 by `/scaffold-native`,
   from the kit's templates (`templates/native/`).
5. **Conventions:** feature and AC IDs, branch names, commit and PR titles (`AGENTS.md` § Conventions).

**After the handoff (Phase 2 and later):**
1. **Ready to build:** approved specs whose `depends_on` are implemented (`spec.mjs list`), in wave order.
2. **In progress:** specs `in-progress`, their `impl-*.md` notes and review verdicts.
3. **Gaps:** the parity-report gaps for this wave.
4. **How to start:** slices are the default: `/implement-slice <SLICE-ID>` (or a list of feature IDs). Risky features
   (data migration, payments, auth/security) use `/implement-feature <ID>`. Always run from the workspace root.

## 4. QA view

**Before the handoff:** `maestro --version`. Candidate critical journeys (from the feature catalog, or from the
inventory's routes). Golden flows recorded so far (`e2e/flows/`). The status of the `migration/test-hooks` branch in
`hybrid/`. Pointers to the upgrade-test plan (guideline 11) and the layout matrix (guideline 10).
**After:** `parity-report` for the current wave, the latest e2e results (`e2e/results/`), and features waiting for `verified`.

## 5. Analyst view

If `analysis/` already has content, ask first: **resume** (continue from the first open row of the `HANDOFF.md`
checklist) or **refresh** (re-run the scan and update the analysis). Don't redo work that's already there without asking.

1. **Where is the React Native app?** Repositories often hold a backend, a web frontend and the mobile app in different
   folders. Skip this step if `workspace.config.json` already names it and the user doesn't want to change it. Otherwise run
   `node tools/rn-inventory.mjs --find-apps` and show the table.
   - **Exactly one RN app, at the repo root, and no other parts:** save it without asking (`--set-app hybrid`).
   - **Otherwise ask** (one question): "Which folder is the React Native app for this workspace?" Offer each detected
     `react-native app` path as an option, plus "another folder". In the same question batch, ask which folders are the
     **backend** and the **web frontend** (multi-select from the detected ones, or none).
   - **More than one RN app:** one workspace per app. This workspace takes the one the analyst picks. For each other app, tell them to
     create its own workspace: `tools/init-workspace.sh ~/Projects/<app2>-native --hybrid <same url> --app <folder>`.
   - Save the answers: `node tools/rn-inventory.mjs --set-app <app> [--set-backend <paths>] [--set-web <paths>]`
     (writes `workspace.config.json`). Local packages the app imports are followed automatically. Add any that aren't
     detected with `--set-shared <paths>`.
   - Record the layout in `PROJECT.md` § Identity (*App folder* row).
2. **Prerequisites.** `node -v` (18+), `git --version`. Optional: `maestro --version`, `xcodebuild -version`,
   `$ANDROID_HOME`. Report missing optional tools without failing. Run `node tools/skills-sync.mjs --check`.
3. **Pin the version.** Show `node tools/rn-inventory.mjs --find-apps --branches` (if §0 didn't already), then ask which
   branch and tag are in production, and whether OTA updates (expo-updates / CodePush) are live. Ask which stores each platform
   is published on. A platform that never shipped changes the plan (guideline 11 § Platform not shipped yet).
   Show `git -C hybrid log -1 --oneline`. Checking out another commit in `hybrid/` needs the user's OK. Never edit
   files in `hybrid/`.
4. **Scan.** `node tools/rn-inventory.mjs --out analysis/inventory`. Summarise the project table and the risks.
5. **Fill `PROJECT.md`.** Take the identity rows from the inventory (bundle IDs, RN/Expo version, workflow, OTA, min OS,
   orientation, iPad). Ask for whatever is still empty in **one** batched question: app name, store version, signing,
   people, environments. Set § Current status to *Phase 1 Discovery*.
6. **Discovery.** Follow the `rn-analyze` playbook, then `plan-data-migration`.
7. **Handoff document.** Write `analysis/HANDOFF.md` from `templates/analysis-handoff.md`, with every checklist row
   filled with evidence or marked open, the decisions needed from the product owner, a proposed wave 1, and the top risks.
   Set its status to *ready for review* only when every row has evidence.
8. **App brief (optional).** Offer to publish a per-app brief as an artifact: the same role prompt (analysts, engineers,
   stakeholders, QA) and structure as `docs/kit-guide.html`, filled with this app's data from `analysis/` and
   `analysis/HANDOFF.md`. Publish only if the user wants it. The brief is private until they share it.
9. **Report.** Counts (routes, features, stored values, native modules, high risks), top 5 risks, open decisions,
   the proposed wave 1, the handoff status, and the number of kit-feedback entries. Next step: the product owner and the other
   platform lead review `analysis/HANDOFF.md` (they can run `/kickoff stakeholder` to see what needs their decision). After
   they accept, write the wave-1 specs (`/spec-feature`).

## Rules

- `hybrid/` is read-only (the only exception is the `migration/test-hooks` branch, guideline 10). That includes the
  backend and web folders in a monorepo. They are evidence, not migration targets. In a new app, the product sources
  are read-only in the same way: record them, never rewrite them.
- Views other than the analyst's only read. They change files only when the user confirms an answer to record.
- Ask before installing anything and before any network access beyond `git fetch` in `hybrid/` (or, in a new app, reading the
  design file through a configured Figma MCP server).
- **Pilot runs:** record every kit gap in `kit-feedback.md` as you go. That includes a tool that failed or misread something, a guideline that
  didn't fit this app, or a step you had to improvise. Describe the problem generically, with no client code, secrets or personal data.
  Don't silently patch kit files. If a patch is unavoidable to continue, keep it minimal and record it (template § Local patches).
