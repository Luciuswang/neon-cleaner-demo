param(
  [switch]$ValidateUE,
  [switch]$RestorePrivateAssets,
  [string]$UEPath = $env:NEON_UE_ROOT
)

$ErrorActionPreference = "Stop"

$repo = Split-Path -Parent $MyInvocation.MyCommand.Path
$branch = "codex/character-continuity-pipeline"
$remote = "origin"
$ueRoot = $UEPath
if (-not $ueRoot) {
  $ueRoot = @('C:\Program Files\Epic Games\UE_5.8','D:\Program Files\Epic Games\UE_5.8','D:\EpicGames\UE_5.8') |
    Where-Object { Test-Path -LiteralPath (Join-Path $_ 'Engine\Binaries\Win64\UnrealEditor-Cmd.exe') } | Select-Object -First 1
}
if (-not $ueRoot) { $ueRoot = 'C:\Program Files\Epic Games\UE_5.8' }
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

  Invoke-CheckedGit rev-parse --show-toplevel | Out-Null

  $currentBranch = (Invoke-CheckedGit branch --show-current).Trim()
  if (-not $currentBranch) { throw 'Detached HEAD: choose an explicit task branch first.' }
  $branch = $currentBranch
  foreach ($marker in @('MERGE_HEAD','rebase-merge','rebase-apply','CHERRY_PICK_HEAD')) {
    $markerPath = Invoke-CheckedGit rev-parse --git-path $marker
    if (Test-Path -LiteralPath $markerPath) { throw "Unfinished Git operation: $marker" }
  }

  Write-Step "Checking local worktree"
  $dirty = Invoke-CheckedGit status --porcelain
  if ($dirty) {
    Write-Warning "Local changes exist. Fetching remote, but not pulling over local work."
    $dirty | ForEach-Object { Write-Host $_ }
    Invoke-CheckedGit fetch $remote '+refs/heads/*:refs/remotes/origin/*' --prune
  }
  else {
    Invoke-CheckedGit fetch $remote '+refs/heads/*:refs/remotes/origin/*' --prune
    $remoteBranch = Invoke-CheckedGit for-each-ref --format='%(refname)' "refs/remotes/$remote/$branch"
    if ($remoteBranch) { Invoke-CheckedGit merge --ff-only "$remote/$branch" }
  }

  Write-Step "Git LFS"
  $lfsVersion = git lfs version 2>$null
  if ($LASTEXITCODE -eq 0) {
    Write-Host $lfsVersion
    Invoke-CheckedGit lfs pull
  }
  else {
    throw "Git LFS is required before working with UE assets."
  }

  if ($RestorePrivateAssets -or (Test-Path 'docs/sync/private-assets-lock.json')) {
    & python (Join-Path $repo 'tools/sync/private_assets.py') restore
    if ($LASTEXITCODE -ne 0) { throw 'Private asset restore failed; do not redo production to compensate for an incomplete sync.' }
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
    $validationLog = Join-Path $repo 'ue/NeonCleanerUE/Saved/Quality/sync-validate.log'
    New-Item -ItemType Directory -Force -Path (Split-Path -Parent $validationLog) | Out-Null
    Remove-Item -LiteralPath $validationLog -ErrorAction SilentlyContinue
    & $editorCmd $project -unattended -nop4 -nullrhi -nosplash -run=pythonscript "-script=$validateScript" "-abslog=$validationLog"
    if ($LASTEXITCODE -ne 0) { throw "UE validation failed with exit $LASTEXITCODE" }
    if (-not (Test-Path -LiteralPath $validationLog) -or
        (Select-String -LiteralPath $validationLog -Pattern 'LogPython: Error|Traceback|Fatal error:' -Quiet) -or
        -not (Select-String -LiteralPath $validationLog -Pattern 'Validation passed' -Quiet)) {
      throw "UE validation did not produce a clean success marker: $validationLog"
    }
  }

  Write-Step "Codex context to read"
  @(
    "AGENTS.md",
    "docs/project-sync.md",
    "docs/biweekly-reporting.md",
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
