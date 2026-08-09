# Ensure the dedicated, logged-out debug Chrome for browser-harness is running on :9222.
# browser-harness connects via BU_CDP=http://localhost:9222 (set in ~/.claude/settings.json "env").
# Isolated profile (no logins) keeps the agent away from real browser sessions.
$port = 9222
function Test-Cdp {
  try { $null = Invoke-WebRequest -UseBasicParsing "http://localhost:$port/json/version" -TimeoutSec 2; return $true }
  catch { return $false }
}
if (Test-Cdp) { Write-Output "browser-harness Chrome already up on :$port"; exit 0 }
$chromeCandidates = @(
  "C:\Program Files\Google\Chrome\Application\chrome.exe",
  "C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
  "C:\Program Files\Chromium\Application\chrome.exe",
  "C:\Program Files (x86)\Chromium\Application\chrome.exe"
)
$chromePath = $chromeCandidates | Where-Object { Test-Path $_ } | Select-Object -First 1
if (-not $chromePath) {
  $chromeCommand = Get-Command chrome, chrome.exe, msedge, msedge.exe -ErrorAction SilentlyContinue | Select-Object -First 1
  if ($chromeCommand) { $chromePath = $chromeCommand.Source }
}
if (-not $chromePath) { Write-Output "FAILED to find Chrome-compatible browser binary"; exit 1 }
Start-Process $chromePath -ArgumentList `
  "--remote-debugging-port=$port", "--user-data-dir=$env:LOCALAPPDATA\bh-chrome", `
  '--no-first-run', '--no-default-browser-check', 'about:blank'
for ($i = 0; $i -lt 15; $i++) { Start-Sleep -Seconds 1; if (Test-Cdp) { Write-Output "browser-harness Chrome launched on :$port"; exit 0 } }
Write-Output "FAILED to bring up Chrome on :$port"; exit 1
