#!/usr/bin/env sh
# Idempotent per-machine setup for ~/.claude. Safe to re-run.
# Usage: sh bootstrap.sh
set -eu

DIR="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
# Pin every node helper to THIS directory. detect-capabilities.js and health-check.js
# resolve their target via claude-paths.js getClaudeHome() (CLAUDE_HOME, else ~/.claude),
# while this script works on $DIR. Without this export the two disagree whenever the repo
# is not checked out at ~/.claude — bootstrap would write machine.json here while the
# scripts read (and overwrite) the one in ~/.claude.
CLAUDE_HOME="$DIR"
export CLAUDE_HOME
EXAMPLE="$DIR/machine.example.json"
MACHINE="$DIR/machine.json"

echo "==> Bootstrapping ~/.claude in $DIR"

# 1. machine.json — copy from example only if absent (never clobber).
if [ -f "$MACHINE" ]; then
  echo "  machine.json: exists, leaving as-is"
else
  cp "$EXAMPLE" "$MACHINE"
  echo "  machine.json: created from machine.example.json"
fi

# 2. knowledgeVaultPath — prompt + validate if still a placeholder / missing dir.
VAULT="$(sed -n 's/.*"knowledgeVaultPath"[[:space:]]*:[[:space:]]*"\(.*\)".*/\1/p' "$MACHINE")"
case "$VAULT" in
  ""|"/absolute/path/to/knowledge-vault")
    printf "  knowledgeVaultPath is unset. Enter absolute path to your knowledge-vault (blank to skip): "
    read -r ANSWER || ANSWER=""
    if [ -n "$ANSWER" ]; then
      # Escape slashes for sed replacement.
      ESC="$(printf '%s' "$ANSWER" | sed 's/[\/&]/\\&/g')"
      sed "s/\"knowledgeVaultPath\"[[:space:]]*:[[:space:]]*\"[^\"]*\"/\"knowledgeVaultPath\": \"$ESC\"/" "$MACHINE" > "$MACHINE.tmp" && mv "$MACHINE.tmp" "$MACHINE"
      VAULT="$ANSWER"
      echo "  knowledgeVaultPath set to $VAULT"
    else
      echo "  WARN: knowledgeVaultPath left unset — edit machine.json before using the vault."
    fi
    ;;
  *)
    echo "  knowledgeVaultPath: $VAULT"
    ;;
esac
[ -n "${VAULT:-}" ] && [ "$VAULT" != "/absolute/path/to/knowledge-vault" ] && [ ! -d "$VAULT" ] && \
  echo "  WARN: knowledgeVaultPath does not exist on disk: $VAULT"

# 3. Tooling on PATH — bootstrap only needs node itself; everything else is
#    declared in scripts/dependencies.json and reported by health-check below.
#    (Keeping a second hardcoded tool list here is what let qpdf go unchecked.)
if command -v node >/dev/null 2>&1; then
  echo "  ok: node -> $(command -v node)"
else
  echo "  WARN: 'node' not found on PATH — hooks, statusline, scripts, and the checks"
  echo "        below all need it. Install Node.js, then re-run this script."
fi

# 3b. Python venv for bundled skill scripts (docx/pptx/xlsx/pdf, image).
#     Homebrew/system pythons on macOS are PEP 668 "externally managed", so
#     `pip install` into them is refused. A dedicated venv sidesteps that and
#     keeps skill deps off the system interpreter. .venv is ignored by the
#     top-level /* allowlist, so it never syncs.
VENV="$DIR/.venv"
if command -v python3 >/dev/null 2>&1; then
  PYBIN="$VENV/bin/python3"
  [ -f "$PYBIN" ] || { echo "  Creating python venv at $VENV..."; python3 -m venv "$VENV" >/dev/null 2>&1 || echo "  WARN: venv creation failed."; }
  if [ -f "$PYBIN" ]; then
    PKGS="$(node -e 'try{console.log(JSON.parse(require("fs").readFileSync("'"$DIR"'/scripts/dependencies.json","utf8")).python.map(m=>m.package).join(" "))}catch(e){process.exit(1)}' 2>/dev/null || echo "openpyxl pypdf Pillow")"
    echo "  Installing skill packages: $PKGS"
    "$PYBIN" -m pip install --quiet --upgrade pip >/dev/null 2>&1 || true
    # shellcheck disable=SC2086
    "$PYBIN" -m pip install --quiet $PKGS || echo "  WARN: package install failed — re-run, or install manually into $VENV."
    # Record the interpreter so skills/scripts resolve it via claude-paths.js.
    node -e '
      const fs=require("fs"),f="'"$MACHINE"'";
      const j=JSON.parse(fs.readFileSync(f,"utf8"));
      if(j.pythonPath!=="'"$PYBIN"'"){j.pythonPath="'"$PYBIN"'";fs.writeFileSync(f,JSON.stringify(j,null,2)+"\n");console.log("  machine.json: pythonPath set");}
      else console.log("  machine.json: pythonPath already set");
    ' 2>/dev/null || echo "  WARN: could not record pythonPath in machine.json (set it by hand)."
  fi
else
  echo "  WARN: python3 not found — bundled skill scripts (xlsx/pdf/image) will not run."
  echo "        On Windows use 'py -3'; avoid the Microsoft Store 'python' stub."
fi

# 4. Capability manifest — probe CLIs and write machine.json -> capabilities (HAL layer).
if command -v node >/dev/null 2>&1; then
  echo "  Detecting capabilities..."
  node "$DIR/scripts/detect-capabilities.js" || echo "  WARN: capability detection failed (non-fatal)."
else
  echo "  WARN: node not found — skipping capability detection (re-run after installing Node)."
fi

# 5. Drift check — verify this machine's state matches documented policy (read-only).
if command -v node >/dev/null 2>&1; then
  echo "  Running health check..."
  node "$DIR/scripts/health-check.js" || echo "  WARN: health check reported failures above — fix before relying on this machine."
fi

cat <<'EOF'

==> Next steps
  1. Confirm machine.json paths (knowledgeVaultPath etc.) are correct for this machine.
  2. If gws is new here: gcloud auth login  &&  gws auth setup  &&  gws auth status
  3. Start Claude Code in any repo and verify the statusline appears. (Vault hot-cache is no longer
     auto-loaded — pull it on demand via the knowledge-vault skill.)
  4. Adding a NEW top-level file/dir to sync? Add a '!/name' line to .gitignore (allowlist model).
Done.
EOF
