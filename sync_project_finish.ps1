param(
  [string]$Note = "",
  [string]$CommitMessage = "",
  [string]$TaskId = "",
  [switch]$Push = $true,
  [switch]$LocalOnly,
  [switch]$StagedOnly,
  [switch]$SkipPrivateAssets
)
$ErrorActionPreference = "Stop"
$repo = Split-Path -Parent $MyInvocation.MyCommand.Path
function Invoke-CheckedGit {
  & git @args
  if ($LASTEXITCODE -ne 0) { throw "git $($args -join ' ') failed (exit $LASTEXITCODE). Sync is NOT complete." }
}
Push-Location $repo
try {
  $branch = (Invoke-CheckedGit branch --show-current).Trim()
  if (-not $branch) { throw "Detached HEAD: name the task branch before publishing." }
  foreach ($marker in @('MERGE_HEAD','rebase-merge','rebase-apply','CHERRY_PICK_HEAD')) {
    $markerPath = Invoke-CheckedGit rev-parse --git-path $marker
    if (Test-Path -LiteralPath $markerPath) { throw "Finish the existing Git operation before sync: $marker" }
  }
  if (-not $LocalOnly -and -not $Push) {
    throw "Upload is the default. Use -LocalOnly only for an explicitly requested offline checkpoint."
  }
  if ($Note.Trim()) {
    Add-Content -LiteralPath (Join-Path $repo 'docs/handoff.md') -Value "`n## Sync note - $(Get-Date -Format o)`n`n$($Note.Trim())"
  }
  Invoke-CheckedGit diff --check
  if (-not $LocalOnly -and -not $SkipPrivateAssets) {
    & python (Join-Path $repo 'tools/sync/private_assets.py') publish
    if ($LASTEXITCODE -ne 0) { throw 'Private assets/evidence upload failed; project checkpoint is not portable.' }
    if ($StagedOnly) { Invoke-CheckedGit add -- docs/sync/private-assets-lock.json }
  }
  # Do not invent a completed/QA-PASS outcome. The event records this checkpoint
  # and enters reports only after the containing commit is actually published.
  $eventWriter = Join-Path $repo 'tools/sync/record_worklog.py'
  $pending = Invoke-CheckedGit status --porcelain
  if ($pending -and (Test-Path -LiteralPath $eventWriter)) {
    if (-not $TaskId) { $TaskId = $branch }
    $summary = if ($Note.Trim()) { $Note.Trim() } elseif ($CommitMessage.Trim()) { $CommitMessage.Trim() } else { 'Project checkpoint; consult changed task packets and QA.' }
    $eventPath = & python $eventWriter --task $TaskId --summary $summary
    if ($LASTEXITCODE -ne 0) { throw 'Portable worklog creation failed.' }
    if ($StagedOnly) { Invoke-CheckedGit add -- $eventPath }
  }
  if (-not $StagedOnly) { Invoke-CheckedGit add -A }
  $staged = Invoke-CheckedGit diff --cached --name-only
  if ($staged) {
    Invoke-CheckedGit diff --cached --check
    if (-not $CommitMessage.Trim()) { $CommitMessage = 'checkpoint: ' + (Get-Date -Format 'yyyy-MM-dd HH:mm') }
    Invoke-CheckedGit commit -m $CommitMessage.Trim()
  }
  $remaining = Invoke-CheckedGit status --porcelain
  if ($remaining) {
    throw "Unpublished working changes remain. Preserve and classify them; do not call this a complete checkpoint.`n$($remaining -join "`n")"
  }
  if ($LocalOnly) {
    Write-Warning 'LOCAL ONLY: this checkpoint is not uploaded and is not cross-PC ready.'
    return
  }
  Invoke-CheckedGit fetch origin '+refs/heads/*:refs/remotes/origin/*' --prune
  Invoke-CheckedGit push -u origin "HEAD:refs/heads/$branch"
  Invoke-CheckedGit fetch origin "+refs/heads/${branch}:refs/remotes/origin/$branch"
  $localHead = (Invoke-CheckedGit rev-parse HEAD).Trim()
  $remoteHead = (Invoke-CheckedGit rev-parse "refs/remotes/origin/$branch").Trim()
  Invoke-CheckedGit merge-base --is-ancestor $localHead $remoteHead
  Write-Host "UPLOAD VERIFIED: $branch contains $localHead on origin (Git LFS pre-push included)."
  if ($SkipPrivateAssets) { Write-Warning 'Private transfer skipped explicitly; do not assert full asset portability without a verified lock.' }
}
finally { Pop-Location }
