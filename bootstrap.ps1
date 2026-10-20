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

# 3. Tooling on PATH - bootstrap only needs node itself; everything else is declared in
#    scripts\dependencies.json and handled below (no second hardcoded tool list here).
$node = Get-Command node -ErrorAction SilentlyContinue
if ($node) {
  Write-Host "  ok: node -> $($node.Source)"
} else {
  Write-Host "  WARN: 'node' not found on PATH - hooks, statusline, scripts, and the checks below"
  Write-Host "        all need it. winget install OpenJS.NodeJS, open a new terminal, re-run this script."
}

# python note (informational): bare 'python' on Windows is often the MS-Store stub.
if (-not (Get-Command python3 -ErrorAction SilentlyContinue)) {
  Write-Host "  NOTE: use 'py -3' (Windows) or 'python3'; avoid the bare 'python' Store stub."
}

# 4. User PATH: ~/.local/bin plus the repo-shipped yt/reddit CLIs (their .cmd wrappers).
#    Done before installs so `uv tool install` shims (which land in ~/.local/bin) probe as present.
$wantPath = @((Join-Path $HOME '.local\bin'), (Join-Path $Dir 'skills\youtube\bin'), (Join-Path $Dir 'skills\reddit\bin'))
New-Item -ItemType Directory -Force -Path $wantPath[0] | Out-Null
# Edit the RAW registry value: round-tripping the expanded one through SetEnvironmentVariable
# would flatten every %VAR% entry the user PATH already has.
$envKey  = Get-Item 'HKCU:\Environment'
$rawPath = $envKey.GetValue('Path', '', 'DoNotExpandEnvironmentNames')
$entries = @($rawPath -split ';' | Where-Object { $_ })
$have    = @($entries | ForEach-Object { [Environment]::ExpandEnvironmentVariables($_).TrimEnd('\') })
$added   = @($wantPath | Where-Object { $have -notcontains $_.TrimEnd('\') })
if ($added.Count) {
  Set-ItemProperty -Path 'HKCU:\Environment' -Name Path -Value (($entries + $added) -join ';') -Type ExpandString
  # Setting any user variable broadcasts WM_SETTINGCHANGE, so new terminals see the new PATH.
  [Environment]::SetEnvironmentVariable('CLAUDE_BOOTSTRAP_PING', '1', 'User')
  [Environment]::SetEnvironmentVariable('CLAUDE_BOOTSTRAP_PING', $null, 'User')
  Write-Host "  added to user PATH: $($added -join '; ') (new terminals pick it up)"
} else {
  Write-Host "  ok: user PATH has ~/.local/bin and the youtube/reddit skill bins"
}
foreach ($p in $wantPath) { if (@($env:Path -split ';') -notcontains $p) { $env:Path = "$p;$env:Path" } }

# winget/npm installs edit the Machine/User PATH; pull new entries into this process so later
# installs (uv tool ... after uv) and the re-probe can see them.
function Update-ProcessPath {
  $cur = @($env:Path -split ';')
  foreach ($scope in 'Machine', 'User') {
    foreach ($p in ([Environment]::GetEnvironmentVariable('Path', $scope) -split ';')) {
      if ($p -and $cur -notcontains $p) { $env:Path += ";$p"; $cur += $p }
    }
  }
}

# 5. Capability manifest - probe CLIs and write machine.json -> capabilities (HAL layer), then
#    offer to install what is missing. The list and the install commands come from
#    scripts\dependencies.json via health-check.js --missing-installs.
if ($node) {
  $env:CLAUDE_HOME = $Dir   # same pin as bootstrap.sh: helpers read/write THIS checkout's machine.json
  Write-Host "  Detecting capabilities..."
  node (Join-Path $Dir 'scripts\detect-capabilities.js')
  if ($LASTEXITCODE -ne 0) { Write-Host "  WARN: capability detection failed (non-fatal)." }
  # ArtCraft CLIs are reported in their own step below, so they are left out of both lists.
  $missing = @(node (Join-Path $Dir 'scripts\health-check.js') --missing-installs | ForEach-Object {
      $kind, $name, $hint = $_ -split "`t", 3
      [pscustomobject]@{ Kind = $kind; Name = $name; Hint = $hint }
    } | Where-Object { $_.Name -notlike '*craft-cli' })
  $auto   = @($missing | Where-Object { $_.Kind -eq 'auto' })
  $manual = @($missing | Where-Object { $_.Kind -eq 'manual' })
  if ($auto.Count) {
    Write-Host "  Missing CLIs bootstrap can install:"
    foreach ($d in $auto) { Write-Host "    $($d.Name): $($d.Hint)" }
    $answer = Read-Host "  Install all of the above now? [y/N]"
    if ($answer -match '^[yY]') {
      foreach ($d in $auto) {
        $tool = ($d.Hint -split ' ')[0]
        if (Get-Command $tool -ErrorAction SilentlyContinue) {
          Write-Host "  -> $($d.Hint)"
          # cmd /c runs the hint as written, '&&' included (Windows PowerShell 5.1 has no '&&').
          cmd /c $d.Hint
          if ($LASTEXITCODE -ne 0) { Write-Host "  WARN: $($d.Name) install failed - run by hand: $($d.Hint)" }
          Update-ProcessPath
        } else {
          Write-Host "  SKIP $($d.Name): '$tool' is not on PATH yet - install it, then re-run bootstrap"
        }
      }
      node (Join-Path $Dir 'scripts\detect-capabilities.js') | Out-Null
    } else {
      Write-Host "  Skipped installs (re-run bootstrap to be asked again)."
    }
  } else {
    Write-Host "  ok: no installable CLIs missing"
  }
  if ($manual.Count) {
    Write-Host "  Missing CLIs to install by hand:"
    foreach ($d in $manual) { Write-Host "    $($d.Name): $($d.Hint)" }
  }
} else {
  Write-Host "  WARN: node not found - skipping capability detection and installs (re-run after installing Node)."
}

# 6. ArtCraft CLIs (optional) - the ArtCraft Launcher / MSI installs them under Program Files,
#    off PATH; the photocraft/filmcraft/pdfcraft skills resolve that location themselves.
foreach ($app in 'PhotoCraft', 'FilmCraft', 'PdfCraft') {
  $exe = Join-Path $env:ProgramFiles "$app\$($app.ToLower())-cli.exe"
  if (Test-Path $exe) { Write-Host "  ok: $exe" }
  else { Write-Host "  ArtCraft (optional): $exe not found - install $app with the ArtCraft Launcher / MSI to use its skill" }
}

# 7. Drift check - verify this machine's state matches documented policy (read-only).
if ($node) {
  Write-Host "  Running health check..."
  node (Join-Path $Dir 'scripts\health-check.js')
  if ($LASTEXITCODE -ne 0) { Write-Host "  WARN: health check reported failures above - fix before relying on this machine." }
}

Write-Host @'

==> Remaining per-machine steps (bootstrap cannot do these)
  [ ] GitHub:    gh auth login
  [ ] Google:    gcloud auth login  ;  gws auth setup  ;  gws auth status
  [ ] Bitwarden: bw login   - then per shell: $env:BW_SESSION = (bw unlock --raw)
  [ ] Open a NEW terminal (user PATH changes reach new terminals), confirm machine.json paths, then
      start Claude Code in any repo and check the statusline appears.
  Adding a NEW top-level file/dir to sync? Add a '!/name' line to .gitignore (allowlist model).
Done.
'@
