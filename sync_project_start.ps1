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
$kelly = Join-Path $repo "ue\NeonCleanerUE\Content\KellyLowSource\asda.uasset"

function Write-Step($message) {
  Write-Host ""
  Write-Host "== $message ==" -ForegroundColor Cyan
}

function Invoke-CheckedGit {
  & git @args
  if ($LASTEXITCODE -ne 0) {
    throw "git $($args -join ' ') failed with exit code $LASTEXITCODE"
  }
}

Push-Location $repo
try {
  Write-Step "Neon Cleaner sync start"
  Write-Host "Repo: $repo"

  if (-not (Test-Path -LiteralPath ".git")) {
    throw "This script must be run from the Neon Cleaner git repository."
  }

  $currentBranch = (Invoke-CheckedGit branch --show-current).Trim()
  if ($currentBranch -ne $branch) {
    Write-Host "Switching branch: $currentBranch -> $branch"
    Invoke-CheckedGit checkout $branch
  }

  Write-Step "Checking local worktree"
  $dirty = Invoke-CheckedGit status --porcelain
  if ($dirty) {
    Write-Warning "Local changes exist. Fetching remote, but not pulling over local work."
    $dirty | ForEach-Object { Write-Host $_ }
    Invoke-CheckedGit fetch $remote
  }
  else {
    Invoke-CheckedGit fetch $remote
    Invoke-CheckedGit pull --ff-only $remote $branch
  }

  Write-Step "Git LFS"
  $lfsVersion = git lfs version 2>$null
  if ($LASTEXITCODE -eq 0) {
    Write-Host $lfsVersion
    Invoke-CheckedGit lfs pull
  }
  else {
    Write-Warning "Git LFS is not available. Install Git LFS before working with UE assets."
  }

  Write-Step "Local environment"
  Write-Host ("UE 5.8: " + ($(if (Test-Path -LiteralPath $ueRoot) { "OK" } else { "MISSING: $ueRoot" })))
  Write-Host ("UE project: " + ($(if (Test-Path -LiteralPath $project) { "OK" } else { "MISSING: $project" })))
  Write-Host ("Kelly low-poly mesh: " + ($(if (Test-Path -LiteralPath $kelly -PathType Leaf) { "PRESENT (dependencies not yet validated)" } else { "MISSING: run ue\Migrate-KellyLowCharacter.ps1 -SourceProject <private-source.uproject>" })))

  if ($ValidateUE) {
    Write-Step "UE validation"
    if (-not (Test-Path -LiteralPath $editorCmd)) {
      throw "UnrealEditor-Cmd.exe was not found: $editorCmd"
    }
    if (-not (Test-Path -LiteralPath $kelly -PathType Leaf)) {
      throw "KellyLowSource/asda.uasset is missing. Run ue\Migrate-KellyLowCharacter.ps1 -SourceProject <private-source.uproject> before validation."
    }
    $validateScript = (Join-Path $repo "ue\scripts\validate_linxia_preview_level.py").Replace('\', '/')
    $command = '"' + $editorCmd + '" "' + $project + '" -unattended -nop4 -nullrhi -nosplash -run=pythonscript -script="' + $validateScript + '"'
    & cmd.exe /d /s /c $command
  }

  Write-Step "Codex context to read"
  @(
    "AGENTS.md",
    "docs/handoff.md",
    "docs/handoff-kelly-low-2026-09-14.md",
    "docs/handoff-kelly-2026-09-07.md",
    "docs/sprint-2026-08-24.md",
    "docs/agent-production-workflow.md",
    "docs/quality-control.md",
    "docs/qa/gate3-quality-report-2026-08-27.md",
    "docs/qa/gate3-quality-report-2026-08-31.md",
    "docs/qa/gate3-kelly-migration-report-2026-09-07.md",
    "docs/multi-agent-production-system.md",
    "docs/agent-task-template.md",
    "docs/tasks/gate3-rider-pose-strict-qa.md",
    "source/reference/linxia/README.md"
  ) | ForEach-Object { Write-Host $_ }

  Write-Step "Current git state"
  Invoke-CheckedGit status --short --branch
  Invoke-CheckedGit log -1 --oneline --decorate
}
finally {
  Pop-Location
}
