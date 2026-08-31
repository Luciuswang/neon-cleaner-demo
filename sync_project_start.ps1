param(
  [switch]$ValidateUE
)

$ErrorActionPreference = "Stop"

$repo = Split-Path -Parent $MyInvocation.MyCommand.Path
$branch = "codex/character-continuity-pipeline"
$remote = "origin"
$ueRoot = "C:\Program Files\Epic Games\UE_5.8"
$editorCmd = Join-Path $ueRoot "Engine\Binaries\Win64\UnrealEditor-Cmd.exe"
$project = Join-Path $repo "ue\NeonCleanerUE\NeonCleanerUE.uproject"
$paragon = Join-Path $repo "ue\NeonCleanerUE\Content\ParagonPhase"

function Write-Step($message) {
  Write-Host ""
  Write-Host "== $message ==" -ForegroundColor Cyan
}

Push-Location $repo
try {
  Write-Step "Neon Cleaner sync start"
  Write-Host "Repo: $repo"

  if (-not (Test-Path -LiteralPath ".git")) {
    throw "This script must be run from the Neon Cleaner git repository."
  }

  $currentBranch = (git branch --show-current).Trim()
  if ($currentBranch -ne $branch) {
    Write-Host "Switching branch: $currentBranch -> $branch"
    git checkout $branch
  }

  Write-Step "Checking local worktree"
  $dirty = git status --porcelain
  if ($dirty) {
    Write-Warning "Local changes exist. Fetching remote, but not pulling over local work."
    $dirty | ForEach-Object { Write-Host $_ }
    git fetch $remote
  }
  else {
    git fetch $remote
    git pull --ff-only $remote $branch
  }

  Write-Step "Git LFS"
  $lfsVersion = git lfs version 2>$null
  if ($LASTEXITCODE -eq 0) {
    Write-Host $lfsVersion
    git lfs pull
  }
  else {
    Write-Warning "Git LFS is not available. Install Git LFS before working with UE assets."
  }

  Write-Step "Local environment"
  Write-Host ("UE 5.8: " + ($(if (Test-Path -LiteralPath $ueRoot) { "OK" } else { "MISSING: $ueRoot" })))
  Write-Host ("UE project: " + ($(if (Test-Path -LiteralPath $project) { "OK" } else { "MISSING: $project" })))
  Write-Host ("ParagonPhase local asset: " + ($(if (Test-Path -LiteralPath $paragon) { "OK" } else { "MISSING: restore from Epic/Fab library" })))

  if ($ValidateUE) {
    Write-Step "UE validation"
    if (-not (Test-Path -LiteralPath $editorCmd)) {
      throw "UnrealEditor-Cmd.exe was not found: $editorCmd"
    }
    if (-not (Test-Path -LiteralPath $paragon)) {
      throw "ParagonPhase is missing. Add Paragon: Phase from Epic/Fab Library before validation."
    }
    & $editorCmd $project -unattended -nop4 -nullrhi -nosplash "-ExecutePythonScript=$repo\ue\scripts\validate_linxia_preview_level.py"
  }

  Write-Step "Codex context to read"
  @(
    "AGENTS.md",
    "docs/handoff.md",
    "docs/sprint-2026-08-24.md",
    "docs/agent-production-workflow.md",
    "docs/quality-control.md",
    "docs/qa/gate3-quality-report-2026-08-27.md",
    "docs/qa/gate3-quality-report-2026-08-31.md",
    "docs/multi-agent-production-system.md",
    "docs/agent-task-template.md",
    "docs/tasks/gate3-rider-pose-strict-qa.md",
    "source/reference/linxia/README.md"
  ) | ForEach-Object { Write-Host $_ }

  Write-Step "Current git state"
  git status --short --branch
  git log -1 --oneline --decorate
}
finally {
  Pop-Location
}
