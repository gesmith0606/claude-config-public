# Bitwarden shell helpers — SOURCED from ~/.zshrc (bootstrap.sh adds the line), never run.
# PowerShell twin: scripts/bw-shell.ps1.
# `bw` locks per shell, so scripts/resolve-secret.js can only reach the vault once
# BW_SESSION is exported in THIS shell (a child process cannot export to its parent,
# which is why these are functions and not scripts).
# The session key is password-equivalent: it lives in the environment only —
# never echo it, never write it to a file.

_bw_state() { bw status 2>/dev/null | sed -n 's/.*"status":"\([a-z]*\)".*/\1/p'; }

bwu() {
  if [ "$(_bw_state)" = "unlocked" ]; then
    echo "bitwarden: already unlocked"
    return 0
  fi
  BW_SESSION="$(bw unlock --raw)" || return 1
  export BW_SESSION
  bw sync >/dev/null 2>&1
  echo "bitwarden: unlocked for this shell"
}

# Lock the vault and drop the session key from this shell.
bwl() {
  bw lock >/dev/null 2>&1
  unset BW_SESSION
  echo "bitwarden: locked"
}

# Add a machine secret to the vault under a resolve-secret.js-compatible name.
# Value comes from stdin, never argv — argv would land in shell history.
#   printf '%s' "$TOKEN" | bwadd GITHUB_PERSONAL_ACCESS_TOKEN
bwadd() { node "${CLAUDE_HOME:-$HOME/.claude}/scripts/bw-add-secret.js" "$@"; }

# GitHub PAT lives in Bitwarden only. Load it into THIS shell when a tool needs it (vault unlocked: bwu).
ghpat() {
  local t
  t="$(node "${CLAUDE_HOME:-$HOME/.claude}/scripts/resolve-secret.js" GITHUB_PERSONAL_ACCESS_TOKEN)" || { echo "ghpat: not resolved - run bwu first" >&2; return 1; }
  export GITHUB_PERSONAL_ACCESS_TOKEN="$t"
  echo "ghpat: GITHUB_PERSONAL_ACCESS_TOKEN loaded for this shell"
}

# Copy a vault password to the clipboard WITHOUT printing it — the practical path
# for native macOS apps, which Bitwarden cannot autofill (it ships only a Safari
# extension, no system AutoFill provider). macOS only (pbcopy).
#   bwcopy proton
# Clears the clipboard after 45s, but ONLY if it still holds what we put there —
# blindly wiping would eat whatever you copied in the meantime.
bwcopy() {
  [ -n "$1" ] || { echo "usage: bwcopy <item name or search term>" >&2; return 1; }
  # Check state FIRST: with a TTY attached, `bw get` prompts for the master
  # password and blocks forever instead of failing. Never let it reach that.
  case "$(_bw_state)" in
    unlocked) ;;
    unauthenticated) echo "bwcopy: not logged in — run: bw login" >&2; return 1 ;;
    *)               echo "bwcopy: vault is locked — run: bwu" >&2; return 1 ;;
  esac
  local val
  val="$(bw get password "$1" 2>/dev/null)" || {
    echo "bwcopy: no item password for \"$1\"" >&2
    echo "        try: bw list items --search \"$1\"" >&2
    return 1
  }
  printf '%s' "$val" | pbcopy
  echo "bwcopy: \"$1\" copied to clipboard (auto-clears in 45s)"
  # Double fork: detached without job-control noise in both zsh and bash.
  ( (
    sleep 45
    [ "$(pbpaste)" = "$val" ] && printf '' | pbcopy
  ) >/dev/null 2>&1 & )
}
