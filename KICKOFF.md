# Kickoff: start the process for one app

One app = one workspace = one agent session. The kit folder (where this file comes from) is only used to *create* and
*update* workspaces. App code never goes into the kit, and kit improvements reach workspaces through `kit-feedback.md`
and `tools/kit-update.mjs`.

```
kit (this folder)  ──init-workspace.sh──▶  <app>-native/  (workspace: AGENTS.md, guidelines, tools, specs…)
        ▲                                       ├── hybrid/   (the RN/Expo repo, read-only; not in a new app)
        │                                       ├── ios/ android/  (Phase 2: /scaffold-native)
        └──── kit-feedback.md (no client code) ◀┘   and back: node tools/kit-update.mjs --from <kit>
```

## 1. Create the workspace (terminal, once per app)

Pick a folder next to your other projects and run the kit's init script with the app's git URL. The clone uses your
own git credentials.

```bash
"<path-to-kit>/tools/init-workspace.sh" ~/Projects/<app>-native --hybrid <git-url-of-the-rn-app>
```

**New app, no hybrid?** Use `--new` instead of `--hybrid`, and put the PRD, briefs and other written sources in
`analysis/sources/` (or list their links there):

```bash
"<path-to-kit>/tools/init-workspace.sh" ~/Projects/<app>-native --new
```

`/kickoff` then runs product definition (`/define-product`: sources, workshops, brief, catalog, product handoff) instead of
discovery. Guideline 15 has the whole new-app lifecycle.

**Monorepo** (backend, web and mobile in one repo)? Add `--app <folder>`, for example `--app apps/mobile`, or leave it out and
`/kickoff` will list the candidates and ask. If the repo has several React Native apps, create one workspace per app, each
with its own `--app`.

It copies the kit, clones the app into `hybrid/`, creates `kit-feedback.md`, records the kit version (`.kit-version`),
and initialises the workspace as its own git repo (for specs, analysis and decisions).

## 2. Start the session

Open the **workspace folder** (`~/Projects/<app>-native`, not `hybrid/`) in Claude Code, as a new session, and type:

```text
/kickoff
```

It asks who you are (analyst, engineer, stakeholder, QA) and shows the process from that role's point of view. For analysts
it checks the setup, pins the production version, fills `PROJECT.md`, runs discovery, and writes `analysis/HANDOFF.md`, the
document the product owner and the other platform lead accept before any development starts.

**Run it as often as you like, and switch roles freely.** Name the role to skip the question:
`/kickoff stakeholder`, then later `/kickoff engineer`. Re-running never redoes or overwrites work. Discovery only moves
forward in the analyst view, so if you're the one doing everything, spend most of Phase 1 in `/kickoff analyst`.

### Other agent tools (Codex, Cursor, Gemini…)

Open the workspace folder and paste:

```text
You are working in a two-platform native workspace (a hybrid→native migration, or a new app: see workspace.config.json
"mode"). Read AGENTS.md and PROJECT.md, then open .claude/skills/kickoff/SKILL.md and follow it step by step. Ask me
which role I have before starting. hybrid/ (if present) is read-only. Record every problem with the kit itself in kit-feedback.md (no client code, secrets or personal data).
```

## 3. First app = pilot: bring the learnings back

The first workspace is also a test of the kit. When the analysis is done (or whenever you hit something blocking):

1. Open `kit-feedback.md` in the workspace and check it holds no client material.
2. In a **kit** session (the kit folder, not the workspace), paste its contents or give its path, and ask for the kit to be improved.
3. Pull the improved kit into the workspace:
   ```bash
   node tools/kit-update.mjs --from "<path-to-kit>"
   ```
   It replaces only kit-owned files (guidelines, tools, templates, playbooks, skills). It never touches `PROJECT.md`,
   `specs/`, `analysis/`, `contracts/`, `e2e/` or your decisions. If a kit file was edited in the workspace, it stops and lists it.
   Record that file in `kit-feedback.md` first, then re-run with `--force`.

## 4. Later apps

Same steps. Each app gets its own workspace and its own session. Check the kit version a workspace uses with
`node tools/kit-update.mjs --status`.
