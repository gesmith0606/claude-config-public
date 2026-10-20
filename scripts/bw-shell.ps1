# Bitwarden PowerShell helpers - DOT-SOURCED from the PowerShell profile (bootstrap.ps1 adds
# the line), never run. Twin of scripts/bw-shell.sh (bwcopy is macOS-only and not ported).
# `bw` locks per shell, so scripts\resolve-secret.js can only reach the vault once
# $env:BW_SESSION is set in THIS shell. The session key is password-equivalent: it lives in
# the environment only - never echo it, never write it to a file.

function bwu {
  $state = try { (bw status | ConvertFrom-Json).status } catch { '' }
  if ($state -eq 'unlocked') { Write-Host 'bitwarden: already unlocked'; return }
  $session = bw unlock --raw
  if ($LASTEXITCODE -ne 0 -or -not $session) { return }
  $env:BW_SESSION = $session
  bw sync | Out-Null
  Write-Host 'bitwarden: unlocked for this shell'
}

# Lock the vault and drop the session key from this shell.
function bwl {
  bw lock | Out-Null
  Remove-Item Env:BW_SESSION -ErrorAction SilentlyContinue
  Write-Host 'bitwarden: locked'
}

# Add a machine secret under a resolve-secret.js-compatible name; value on stdin, never argv.
#   $token | bwadd GITHUB_PERSONAL_ACCESS_TOKEN
function bwadd { $input | node (Join-Path $PSScriptRoot 'bw-add-secret.js') @args }

# GitHub PAT lives in Bitwarden only. Load it into THIS shell when a tool needs it (vault unlocked: bwu).
function ghpat {
  $t = node (Join-Path $PSScriptRoot 'resolve-secret.js') GITHUB_PERSONAL_ACCESS_TOKEN
  if ($LASTEXITCODE -ne 0 -or -not $t) { Write-Host 'ghpat: not resolved - run bwu first'; return }
  $env:GITHUB_PERSONAL_ACCESS_TOKEN = $t
  Write-Host 'ghpat: GITHUB_PERSONAL_ACCESS_TOKEN loaded for this shell'
}
