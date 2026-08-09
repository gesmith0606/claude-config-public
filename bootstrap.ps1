#!/usr/bin/env pwsh
# Idempotent per-machine setup for ~/.claude. Safe to re-run.
# Usage: pwsh -File bootstrap.ps1   (or)   powershell -File bootstrap.ps1
$ErrorActionPreference = 'Stop'

$Dir     = Split-Path -Parent $MyInvocation.MyCommand.Path
$Example = Join-Path $Dir 'machine.example.json'
$Machine = Join-Path $Dir 'machine.json'

Write-Host "==> Bootstrapping ~/.claude in $Dir"

# 1. machine.json — copy from example only if absent (never clobber).
if (Test-Path $Machine) {
  Write-Host "  machine.json: exists, leaving as-is"
} else {
  Copy-Item $Example $Machine
  Write-Host "  machine.json: created from machine.example.json"
}

# 2. knowledgeVaultPath — prompt + validate if still a placeholder / missing dir.
$cfg   = Get-Content $Machine -Raw | ConvertFrom-Json
$vault = $cfg.knowledgeVaultPath
if ([string]::IsNullOrWhiteSpace($vault) -or $vault -eq '/absolute/path/to/knowledge-vault') {
  $answer = Read-Host "  Enter absolute path to your knowledge-vault (blank to skip)"
  if (-not [string]::IsNullOrWhiteSpace($answer)) {
    $cfg.knowledgeVaultPath = $answer
    ($cfg | ConvertTo-Json -Depth 10) | Set-Content -Path $Machine -Encoding utf8
    $vault = $answer
    Write-Host "  knowledgeVaultPath set to $vault"
  } else {
    Write-Host "  WARN: knowledgeVaultPath left unset — edit machine.json before using the vault."
  }
} else {
  Write-Host "  knowledgeVaultPath: $vault"
}
if ($vault -and $vault -ne '/absolute/path/to/knowledge-vault' -and -not (Test-Path $vault)) {
  Write-Host "  WARN: knowledgeVaultPath does not exist on disk: $vault"
}

# 3. Tooling on PATH — warn (don't fail) if missing.
$hints = @{
  gws    = 'install: npm i -g @googleworkspace/cli ; then gcloud auth login && gws auth setup'
  gcloud = 'install the Google Cloud SDK; on Windows open a fresh terminal so PATH updates'
  node   = 'install Node.js (skills, scripts, and the statusline need it)'
  gh     = 'install GitHub CLI (gh); used by /brief, /pr, and github-ops; then run: gh auth login'
}
foreach ($tool in 'node','gws','gcloud','gh') {
  $cmd = Get-Command $tool -ErrorAction SilentlyContinue
  if ($cmd) {
    Write-Host "  ok: $tool -> $($cmd.Source)"
  } else {
    Write-Host "  WARN: '$tool' not found on PATH."
    Write-Host "        $($hints[$tool])"
  }
}

# python note (informational): bare 'python' on Windows is often the MS-Store stub.
if (-not (Get-Command python3 -ErrorAction SilentlyContinue)) {
  Write-Host "  NOTE: use 'py -3' (Windows) or 'python3'; avoid the bare 'python' Store stub."
}

# 4. Capability manifest — probe CLIs and write machine.json -> capabilities (HAL layer).
if (Get-Command node -ErrorAction SilentlyContinue) {
  Write-Host "  Detecting capabilities..."
  try { node (Join-Path $Dir 'scripts\detect-capabilities.js') } catch { Write-Host "  WARN: capability detection failed (non-fatal)." }
} else {
  Write-Host "  WARN: node not found — skipping capability detection (re-run after installing Node)."
}

# 5. Drift check — verify this machine's state matches documented policy (read-only).
if (Get-Command node -ErrorAction SilentlyContinue) {
  Write-Host "  Running health check..."
  try { node (Join-Path $Dir 'scripts\health-check.js') } catch { Write-Host "  WARN: health check reported failures above — fix before relying on this machine." }
}

Write-Host @'

==> Next steps
  1. Confirm machine.json paths (knowledgeVaultPath etc.) are correct for this machine.
  2. If gws is new here: gcloud auth login  &&  gws auth setup  &&  gws auth status
  3. Start Claude Code in any repo and verify the statusline appears. (Vault hot-cache is no longer
     auto-loaded — pull it on demand via the knowledge-vault skill.)
  4. Adding a NEW top-level file/dir to sync? Add a '!/name' line to .gitignore (allowlist model).
Done.
'@
