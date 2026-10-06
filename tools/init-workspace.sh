#!/usr/bin/env bash
# init-workspace.sh — create a new workspace (one per app) from this kit, in one of two modes.
#
# Usage:
#   tools/init-workspace.sh <target-dir> [--hybrid <git-url>] [--app <folder-inside-repo>] [--ios <git-url>] [--android <git-url>]
#   tools/init-workspace.sh <target-dir> --new [--ios <git-url>] [--android <git-url>]
#   (--hybrid: migration mode, the React Native / Expo app to rewrite. --app: for monorepos, the RN app's folder inside it,
#    e.g. apps/mobile; /kickoff asks if omitted. --new: a new app with no hybrid, guideline 15.)
#
# Copies the kit (AGENTS.md, CLAUDE.md, PROJECT.md, guidelines, templates, tools, .claude, skeleton folders),
# initialises the workspace git repo, clones the given repos into hybrid/ ios/ android/, and seeds each
# native repo's AGENTS.md + CLAUDE.md from the templates (only if they don't exist yet). Empty native repos are fine:
# /scaffold-native generates the projects in Phase 2.
set -euo pipefail

KIT="$(cd "$(dirname "$0")/.." && pwd)"
[[ $# -ge 1 ]] || { sed -n '2,9p' "$0"; exit 1; }
TARGET="$1"; shift
HYBRID_URL="" IOS_URL="" ANDROID_URL="" APP_DIR="" NEW=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    --new) NEW=1; shift ;;
    --hybrid) HYBRID_URL="$2"; shift 2 ;;
    --app) APP_DIR="$2"; shift 2 ;;
    --ios) IOS_URL="$2"; shift 2 ;;
    --android) ANDROID_URL="$2"; shift 2 ;;
    *) echo "unknown option $1"; exit 1 ;;
  esac
done

[[ -z "$NEW" || ( -z "$HYBRID_URL" && -z "$APP_DIR" ) ]] || { echo "--new can't be combined with --hybrid or --app"; exit 1; }
mkdir -p "$TARGET"
TARGET="$(cd "$TARGET" && pwd)"
[[ "$TARGET" != "$KIT" ]] || { echo "target must differ from the kit folder"; exit 1; }

echo "→ copying kit into $TARGET"
rsync -a \
  --exclude '.git/' --exclude '/hybrid/' --exclude '/ios/' --exclude '/android/' \
  --exclude '/analysis/inventory/' --exclude '/specs/features/*/' --exclude '/parity/STATUS.md' --exclude '/parity/status.json' --exclude '/parity/DEPENDENCIES.md' \
  --exclude '.DS_Store' --exclude '/.skills-cache/' --exclude '/.kit-manifest.json' --exclude '/.kit-version' \
  --exclude '/kit-feedback.md' --exclude '/kit-feedback-patches/' \
  "$KIT/" "$TARGET/"

cd "$TARGET"
[[ -d .git ]] || { git init -q && echo "→ initialised workspace git repo"; }
if [[ -n "$NEW" ]]; then
  # New-app mode (guideline 15): no hybrid/, product sources instead of discovery.
  if ! grep -q '"mode": "new"' workspace.config.json 2>/dev/null; then
    printf '{\n  "mode": "new"\n}\n' > workspace.config.json
    cp templates/PROJECT.new.md PROJECT.md
    echo "→ new-app mode: workspace.config.json, PROJECT.md (new-app variant)"
  fi
  mkdir -p analysis/sources
  [[ -f analysis/sources/README.md ]] || cp templates/sources-index.md analysis/sources/README.md
fi

clone() { # url dir
  if [[ -n "$1" && ! -d "$2" ]]; then echo "→ cloning $1 into $2/"; git clone -q "$1" "$2"; fi
}
clone "$HYBRID_URL" hybrid
clone "$IOS_URL" ios
clone "$ANDROID_URL" android

seed() { # dir template
  if [[ -d "$1" && ! -f "$1/AGENTS.md" ]]; then
    cp "templates/$2" "$1/AGENTS.md"
    [[ -f "$1/CLAUDE.md" ]] || echo "@AGENTS.md" > "$1/CLAUDE.md"
    echo "→ seeded $1/AGENTS.md and $1/CLAUDE.md (fill in the placeholders)"
  fi
}
seed ios repo-AGENTS-ios.md
seed android repo-AGENTS-android.md
if [[ -f ios/AGENTS.md || -f android/AGENTS.md ]]; then node tools/sync-agents-md.mjs || true; fi
if [[ -n "$APP_DIR" ]]; then node tools/rn-inventory.mjs --set-app "hybrid/${APP_DIR#/}" || echo "! --app ${APP_DIR}: not a React Native app folder; /kickoff will ask"; fi
[[ -f kit-feedback.md ]] || { cp templates/kit-feedback.md kit-feedback.md && echo "→ created kit-feedback.md"; }
node tools/kit-update.mjs --stamp --from "$KIT" >/dev/null && echo "→ recorded kit version $(cat VERSION) in .kit-version"

SOURCES_HINT=""
[[ -z "$NEW" ]] || SOURCES_HINT=$'\n     Put the PRD, briefs and other written sources in analysis/sources/ (or list their links in its README.md).'
cat <<EOF

✔ Workspace ready: $TARGET ($([[ -n "$NEW" ]] && echo "new app" || echo "migration"))

Next steps
  1. Open $TARGET (the workspace root$([[ -z "$NEW" ]] && echo ", not hybrid/")) in a new Claude Code session and type:  /kickoff
     It asks your role, fills PROJECT.md with you and, for analysts, runs $([[ -n "$NEW" ]] && echo "product definition up to the product handoff" || echo "discovery up to the analysis handoff").
     (Other agents: KICKOFF.md has the prompt to paste.)${SOURCES_HINT}
  2. Record every problem with the kit itself in kit-feedback.md, and bring it back to the kit (KICKOFF.md §3).
EOF
