#!/usr/bin/env sh
# Idempotent per-machine setup for ~/.claude. Safe to re-run.
# Usage: sh bootstrap.sh
set -eu

DIR="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
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

# 3. Tooling on PATH — warn (don't fail) if missing.
for tool in node gws gcloud gh; do
  if command -v "$tool" >/dev/null 2>&1; then
    echo "  ok: $tool -> $(command -v "$tool")"
  else
    echo "  WARN: '$tool' not found on PATH."
    case "$tool" in
      gws)    echo "        install: npm i -g @googleworkspace/cli ; then gcloud auth login && gws auth setup" ;;
      gcloud) echo "        install the Google Cloud SDK; on Windows open a fresh terminal so PATH updates" ;;
      node)   echo "        install Node.js (skills, scripts, and the statusline need it)" ;;
      gh)     echo "        install GitHub CLI (gh); used by /brief, /pr, github-ops; then: gh auth login" ;;
    esac
  fi
done

# python note (informational).
command -v python3 >/dev/null 2>&1 || echo "  NOTE: use 'py -3' (Windows) or 'python3'; avoid the bare 'python' Store stub."

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
