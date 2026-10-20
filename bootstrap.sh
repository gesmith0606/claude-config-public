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

# 4. ~/.local/bin on PATH for login shells, plus links to the repo-shipped CLIs.
#    Done before installs so `uv tool install` shims (which land there) probe as present.
BIN="$HOME/.local/bin"
mkdir -p "$BIN"
PROFILE="$HOME/.profile"; [ "$(uname)" = Darwin ] && PROFILE="$HOME/.zprofile"
# shellcheck disable=SC2016  # literal line, expanded by the login shell
PATHLINE='case ":$PATH:" in *":$HOME/.local/bin:"*) ;; *) export PATH="$HOME/.local/bin:$PATH" ;; esac'
if grep -qxF "$PATHLINE" "$PROFILE" 2>/dev/null; then
  echo "  ok: ~/.local/bin on PATH via $PROFILE"
else
  printf '\n# User CLIs: ArtCraft *-cli and symlinks to the yt/reddit skill CLIs (~/.claude/skills/*/bin).\n%s\n' "$PATHLINE" >> "$PROFILE"
  echo "  added ~/.local/bin to PATH in $PROFILE (new terminals pick it up)"
fi
case ":$PATH:" in *":$BIN:"*) ;; *) PATH="$BIN:$PATH"; export PATH ;; esac

# 4a. Bitwarden shell helpers (bwu/bwl/bwadd/bwcopy/ghpat) — functions, so they must be
#     sourced into interactive shells. One guarded line; skipped where the rc file still
#     defines bwu inline (the pre-repo setup) so the two never double-define.
RC="$HOME/.bashrc"; [ "$(uname)" = Darwin ] && RC="$HOME/.zshrc"
BWLINE="[ -f \"$DIR/scripts/bw-shell.sh\" ] && . \"$DIR/scripts/bw-shell.sh\""
if grep -qxF "$BWLINE" "$RC" 2>/dev/null; then
  echo "  ok: Bitwarden helpers sourced from $RC"
elif grep -q '^bwu()' "$RC" 2>/dev/null; then
  echo "  ok: $RC defines bwu inline (to use the synced copy, replace that block with: $BWLINE)"
else
  printf '\n# Bitwarden helpers: bwu, bwl, bwadd, bwcopy, ghpat (synced in ~/.claude/scripts).\n%s\n' "$BWLINE" >> "$RC"
  echo "  added Bitwarden helpers to $RC (new terminals pick them up)"
fi

link() { # link <target> <link>: create once, never clobber something else
  if [ "$(readlink "$2" 2>/dev/null || true)" = "$1" ]; then echo "  ok: $2 -> $1"
  elif [ -e "$2" ] || [ -L "$2" ]; then echo "  WARN: $2 exists and is not a link to $1 — leaving it"
  else ln -s "$1" "$2" && echo "  linked: $2 -> $1"; fi
}
link "$DIR/skills/youtube/bin/yt" "$BIN/yt"
link "$DIR/skills/reddit/bin/reddit" "$BIN/reddit"

# 5. Capability manifest — probe CLIs and write machine.json -> capabilities (HAL layer),
#    then offer to install what is missing. The list and the install commands come from
#    scripts/dependencies.json via health-check.js --missing-installs; nothing is hardcoded here.
if command -v node >/dev/null 2>&1; then
  echo "  Detecting capabilities..."
  node "$DIR/scripts/detect-capabilities.js" || echo "  WARN: capability detection failed (non-fatal)."
  MISSING="$(node "$DIR/scripts/health-check.js" --missing-installs 2>/dev/null || true)"
  # ArtCraft CLIs have their own opt-in step below, so they are left out of both lists.
  AUTO="$(printf '%s\n' "$MISSING" | awk -F'\t' '$1=="auto" && $2 !~ /craft-cli$/ {print $2 "\t" $3}')"
  MANUAL="$(printf '%s\n' "$MISSING" | awk -F'\t' '$1=="manual" && $2 !~ /craft-cli$/ {print "    " $2 ": " $3}')"
  if [ -n "$AUTO" ]; then
    echo "  Missing CLIs bootstrap can install:"
    printf '%s\n' "$AUTO" | awk -F'\t' '{print "    " $1 ": " $2}'
    printf "  Install all of the above now? [y/N] "
    read -r ANSWER || ANSWER=""
    case "$ANSWER" in
      [yY]*)
        TAB="$(printf '\t')"; OLDIFS="$IFS"; IFS='
'
        set -f
        for LINE in $AUTO; do
          NAME="${LINE%%"$TAB"*}"; CMD="${LINE#*"$TAB"}"
          if command -v "${CMD%% *}" >/dev/null 2>&1; then
            echo "  -> $CMD"
            sh -c "$CMD" || echo "  WARN: $NAME install failed — run by hand: $CMD"
          else
            echo "  SKIP $NAME: '${CMD%% *}' is not on PATH yet — install it, then re-run bootstrap"
          fi
        done
        set +f; IFS="$OLDIFS"
        node "$DIR/scripts/detect-capabilities.js" >/dev/null || true
        ;;
      *) echo "  Skipped installs (re-run bootstrap to be asked again)." ;;
    esac
  else
    echo "  ok: no installable CLIs missing"
  fi
  if [ -n "$MANUAL" ]; then
    echo "  Missing CLIs to install by hand:"
    printf '%s\n' "$MANUAL"
  fi
else
  echo "  WARN: node not found — skipping capability detection and installs (re-run after installing Node)."
fi

# 6. ArtCraft CLIs (photocraft/filmcraft/pdfcraft) — optional, macOS only, opt-in.
#    Pulled from each storytold/<app> latest release with gh; the zip must match the
#    sha256 digest GitHub records for the asset before anything lands in ~/.local/bin.
artcraft_install() { # artcraft_install <app> <tmpdir>
  APP="$1"; T="$2"
  LINE="$(gh api "repos/storytold/$APP/releases/latest" \
    --jq '.assets[] | select(.name | test("^'"$APP"'-cli-.*-macos-universal\\.zip$")) | .name + " " + (.digest // "")' \
    | head -n 1)" || return 1
  ASSET="${LINE%% *}"; WANT="${LINE#* }"; WANT="${WANT#sha256:}"
  [ -n "$ASSET" ] && [ -n "$WANT" ] && [ "$ASSET" != "$LINE" ] || { echo "  WARN: no $APP macOS asset with a digest in the latest release"; return 1; }
  gh release download -R "storytold/$APP" -p "$ASSET" -D "$T" || return 1
  GOT="$(shasum -a 256 "$T/$ASSET" | cut -d' ' -f1)"
  [ "$GOT" = "$WANT" ] || { echo "  WARN: $ASSET sha256 mismatch (got $GOT, release says $WANT) — not installed"; return 1; }
  unzip -q "$T/$ASSET" -d "$T/x" || return 1
  EXE="$(find "$T/x" -type f -name "$APP-cli" | head -n 1)"
  [ -n "$EXE" ] || { echo "  WARN: $APP-cli not found inside $ASSET"; return 1; }
  install -m 755 "$EXE" "$BIN/$APP-cli" && echo "  installed: $BIN/$APP-cli ($ASSET, sha256 verified)"
}
if [ "$(uname)" = Darwin ]; then
  ART=""
  for APP in photocraft filmcraft pdfcraft; do command -v "$APP-cli" >/dev/null 2>&1 || ART="$ART $APP"; done
  if [ -z "$ART" ]; then
    echo "  ok: ArtCraft CLIs present (photocraft-cli, filmcraft-cli, pdfcraft-cli)"
  elif ! command -v gh >/dev/null 2>&1 || ! gh auth status >/dev/null 2>&1; then
    echo "  ArtCraft CLIs missing:$ART — optional; run 'gh auth login', then re-run bootstrap to be offered them"
  else
    printf "  Optional ArtCraft CLIs missing:%s. Download from github.com/storytold/<app> into ~/.local/bin? [y/N] " "$ART"
    read -r ANSWER || ANSWER=""
    case "$ANSWER" in
      [yY]*)
        for APP in $ART; do
          T="$(mktemp -d)"
          artcraft_install "$APP" "$T" || echo "  WARN: $APP-cli not installed"
          rm -rf "$T"
        done ;;
      *) echo "  Skipped ArtCraft." ;;
    esac
  fi
  # pdfcraft-cli looks for its OCR/layout models here; the app bundle ships them.
  APPMODELS="/Applications/PdfCraft.app/Contents/Resources/models"
  if command -v pdfcraft-cli >/dev/null 2>&1 && [ -d "$APPMODELS" ]; then
    mkdir -p "$HOME/.local/share/pdfcraft"
    link "$APPMODELS" "$HOME/.local/share/pdfcraft/models"
  fi
fi

# 7. Drift check — verify this machine's state matches documented policy (read-only).
if command -v node >/dev/null 2>&1; then
  echo "  Running health check..."
  node "$DIR/scripts/health-check.js" || echo "  WARN: health check reported failures above — fix before relying on this machine."
fi

cat <<'EOF'

==> Remaining per-machine steps (bootstrap cannot do these)
  [ ] GitHub:    gh auth login
  [ ] Google:    gcloud auth login  &&  gws auth setup  &&  gws auth status
  [ ] Bitwarden: bw login   — then per shell: bwu   (scripts/bw-shell.sh, sourced by your rc file)
  [ ] macOS, optional: Keychain copy of the Gemini key so `yt` runs without bwu (vault unlocked;
      the key goes over stdin, never argv):
        printf 'add-generic-password -U -a "%s" -s GEMINI_API_KEY -w "%s"\n' "$USER" \
          "$(node ~/.claude/scripts/resolve-secret.js GEMINI_API_KEY)" | security -i
  [ ] Open a NEW terminal (PATH changes reach new login shells), confirm machine.json paths, then
      start Claude Code in any repo and check the statusline appears.
  Adding a NEW top-level file/dir to sync? Add a '!/name' line to .gitignore (allowlist model).
Done.
EOF
