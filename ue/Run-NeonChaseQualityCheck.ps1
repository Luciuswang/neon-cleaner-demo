param(
    [switch]$SkipBuild,
    [switch]$SkipFilms,
    [switch]$SkipVisualProof
)

$ErrorActionPreference = "Stop"
$project = Join-Path $PSScriptRoot "NeonCleanerUE\NeonCleanerUE.uproject"
$build = "C:\Program Files\Epic Games\UE_5.8\Engine\Build\BatchFiles\Build.bat"
$quality = Join-Path $PSScriptRoot "NeonCleanerUE\Saved\Quality"
New-Item -ItemType Directory -Force -Path $quality | Out-Null

if (Get-Process UnrealEditor -ErrorAction SilentlyContinue) {
    throw "Close the running Unreal Editor/game before serialized quality verification."
}
if (-not $SkipBuild) {
    & $build NeonCleanerUEEditor Win64 Development "-Project=$project" -WaitMutex -NoUBA -MaxParallelActions=2
    if ($LASTEXITCODE -ne 0) { throw "NeonCleanerUEEditor build failed." }
}

& (Join-Path $PSScriptRoot "Invoke-NeonUE.ps1") `
    -PythonScript (Join-Path $PSScriptRoot "scripts\create_linxia_motorcycle_chase_level.py") `
    -LogName "neon-scene-generate" -TimeoutSeconds 600
& (Join-Path $PSScriptRoot "Invoke-NeonUE.ps1") `
    -PythonScript (Join-Path $PSScriptRoot "scripts\validate_linxia_motorcycle_chase_level.py") `
    -LogName "neon-scene-validate" -TimeoutSeconds 300

foreach ($scenario in @("Clean", "Damaged", "Lost")) {
    & (Join-Path $PSScriptRoot "Invoke-NeonUE.ps1") -NullRhi `
        -GameArguments @("-NeonChaseSmoke=$scenario", "-NeonSkipFilms", "-NeonChaseSmokeSpeed=12") `
        -LogName "neon-smoke-$scenario" -TimeoutSeconds 240
    $log = Join-Path $quality "neon-smoke-$scenario.log"
    if (-not (Select-String -LiteralPath $log -Pattern "\[NeonChaseSmoke\] PASS scenario=$scenario" -Quiet)) {
        throw "Gameplay smoke did not pass for $scenario. Log: $log"
    }
}

if (-not $SkipFilms) {
    & (Join-Path $PSScriptRoot "Render-NeonFilms.ps1")
    foreach ($mode in @("Missing", "Corrupt", "Stall")) {
        & (Join-Path $PSScriptRoot "Invoke-NeonUE.ps1") -NullRhi `
            -GameArguments @("-NeonChaseSmoke=Clean", "-NeonFilmTest=$mode",
                "-NeonFilmOpenTimeout=1", "-NeonFilmStallTimeout=1",
                "-NeonChaseSmokeSpeed=12") `
            -LogName "neon-media-$mode" -TimeoutSeconds 240
        $log = Join-Path $quality "neon-media-$mode.log"
        if (-not (Select-String -LiteralPath $log -Pattern "NEON_FILM_COMPLETE.*completion=1" -Quiet)) {
            throw "Media fallback did not complete for $mode. Log: $log"
        }
    }
}

if (-not $SkipVisualProof) {
    $proof = Join-Path $quality "neon-chase-final.png"
    & (Join-Path $PSScriptRoot "Capture-LinxiaMotorcycleChase.ps1") -OutputPath $proof -GameplayProof
    if (-not (Test-Path -LiteralPath $proof)) { throw "Final proof was not created." }
}

Write-Host "ENGINEERING CHECKS: PASS (subject to the listed skips)."
Write-Host "CINEMATIC VISUAL / AI VIDEO: UNVERIFIED. Run independent evidence review per docs/cinematic-quality-contract.md."
if ($SkipVisualProof) { Write-Warning "Visual evidence was skipped; no visual PASS is permitted." }
if ($SkipBuild) { Write-Warning "Build was skipped; verify the runtime binary belongs to the reviewed source." }
