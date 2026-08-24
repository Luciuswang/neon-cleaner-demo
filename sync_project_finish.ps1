param(
  [string]$Note = "",
  [string]$CommitMessage = "",
  [switch]$Push
)

$ErrorActionPreference = "Stop"

$repo = Split-Path -Parent $MyInvocation.MyCommand.Path
$handoff = Join-Path $repo "docs\handoff.md"

function Write-Step($message) {
  Write-Host ""
  Write-Host "== $message ==" -ForegroundColor Cyan
}

Push-Location $repo
try {
  Write-Step "Neon Cleaner sync finish"

  if (-not (Test-Path -LiteralPath ".git")) {
    throw "This script must be run from the Neon Cleaner git repository."
  }

  if ($Note.Trim().Length -gt 0) {
    Write-Step "Appending handoff note"
    $stamp = Get-Date -Format "yyyy-MM-dd HH:mm zzz"
    Add-Content -Path $handoff -Value ""
    Add-Content -Path $handoff -Value "## Cross-PC Sync Note - $stamp"
    Add-Content -Path $handoff -Value ""
    Add-Content -Path $handoff -Value $Note.Trim()
  }

  Write-Step "Checking whitespace / patch hygiene"
  git diff --check
  if ($LASTEXITCODE -ne 0) {
    throw "git diff --check failed. Fix whitespace/errors before committing."
  }

  $dirty = git status --porcelain
  if (-not $dirty) {
    Write-Host "Working tree is clean."
  }
  elseif ($CommitMessage.Trim().Length -eq 0) {
    Write-Warning "Working tree has changes, but no -CommitMessage was provided."
    git status --short
    Write-Host ""
    Write-Host "Run again with:"
    Write-Host ".\sync_project_finish.ps1 -CommitMessage `"your message`" -Push"
    exit 2
  }
  else {
    Write-Step "Committing"
    git add -A
    git diff --cached --check
    if ($LASTEXITCODE -ne 0) {
      throw "git diff --cached --check failed. Fix whitespace/errors before committing."
    }
    git commit -m $CommitMessage.Trim()
  }

  if ($Push) {
    Write-Step "Pushing"
    git push
  }

  Write-Step "Final state"
  git status --short --branch
  git log -1 --oneline --decorate
}
finally {
  Pop-Location
}
