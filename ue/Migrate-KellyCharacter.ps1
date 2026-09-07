param(
    [string]$SourceProject = ""
)

$ErrorActionPreference = "Stop"

$EditorCmd = "C:\Program Files\Epic Games\UE_5.8\Engine\Binaries\Win64\UnrealEditor-Cmd.exe"
$TargetProject = Join-Path $PSScriptRoot "NeonCleanerUE\NeonCleanerUE.uproject"
$TargetKellyDirectory = Join-Path $PSScriptRoot "NeonCleanerUE\Content\KellySource"
$InspectScript = Join-Path $PSScriptRoot "scripts\inspect_kelly_source.py"
$RelocateScript = Join-Path $PSScriptRoot "scripts\relocate_kelly_source.py"
$ValidateScript = Join-Path $PSScriptRoot "scripts\validate_kelly_migration.py"
$StyleScript = Join-Path $PSScriptRoot "scripts\style_kelly_materials.py"
$RideAnimationScript = Join-Path $PSScriptRoot "scripts\create_kelly_motorcycle_ride_anims.py"

if ($SourceProject.Trim().Length -eq 0) {
    $sourceCandidates = @(
        Get-ChildItem -LiteralPath "D:\kelly-UE" -Recurse -Filter "*.uproject" -File |
            Where-Object {
                Test-Path -LiteralPath (Join-Path $_.DirectoryName "Content\rig.uasset")
            }
    )
    if ($sourceCandidates.Count -ne 1) {
        throw "Expected one Kelly source project under D:\kelly-UE, found $($sourceCandidates.Count)"
    }
    $SourceProject = $sourceCandidates[0].FullName
}

$SourceDirectory = Split-Path -Parent $SourceProject
$StageDirectory = Join-Path ([System.IO.Path]::GetTempPath()) ("NeonCleaner-Kelly-Staging-" + [guid]::NewGuid().ToString("N"))
$StageProject = Join-Path $StageDirectory "KellyStaging.uproject"
$StageReports = Join-Path $StageDirectory "Reports"
$InspectReport = Join-Path $StageReports "kelly-source-inventory.json"
$RelocateReport = Join-Path $StageReports "kelly-relocation.json"

function Assert-Exists($Path, $Label) {
    if (-not (Test-Path -LiteralPath $Path)) {
        throw "$Label not found: $Path"
    }
}

function Get-SourceSnapshot {
    $roots = @(
        $SourceProject,
        (Join-Path $SourceDirectory "Config"),
        (Join-Path $SourceDirectory "Content")
    )
    $files = foreach ($root in $roots) {
        if (Test-Path -LiteralPath $root -PathType Leaf) {
            Get-Item -LiteralPath $root
        }
        elseif (Test-Path -LiteralPath $root -PathType Container) {
            Get-ChildItem -LiteralPath $root -Recurse -File
        }
    }
    @(
        $files |
            Sort-Object FullName |
            ForEach-Object {
                [pscustomobject]@{
                    FullName = $_.FullName
                    Length = $_.Length
                    LastWriteUtc = $_.LastWriteTimeUtc.Ticks
                    Sha256 = (Get-FileHash -LiteralPath $_.FullName -Algorithm SHA256).Hash
                }
            }
    )
}

function Invoke-UEScript($Project, $Script, $SuccessPattern, $Label) {
    $normalizedScript = $Script.Replace('\', '/')
    $command = '"' + $EditorCmd + '" "' + $Project + '" -unattended -nop4 -nosplash -ddc=NoZenLocalFallback -DDC-ForceMemoryCache -run=pythonscript -script="' + $normalizedScript + '"'
    Write-Host ""
    Write-Host "== $Label ==" -ForegroundColor Cyan
    & cmd.exe /d /s /c $command
    $exitCode = $LASTEXITCODE
    $logPath = Join-Path (Split-Path -Parent $Project) "Saved\Logs\$([System.IO.Path]::GetFileNameWithoutExtension($Project)).log"
    Assert-Exists $logPath "$Label UE log"
    $pythonError = Select-String -Path $logPath -Pattern "LogPython: Error|Traceback" | Select-Object -Last 1
    if ($pythonError) {
        throw "$Label failed: $($pythonError.Line)"
    }
    $success = Select-String -Path $logPath -Pattern $SuccessPattern | Select-Object -Last 1
    if (-not $success) {
        throw "$Label success marker not found: $SuccessPattern"
    }
    if ($exitCode -ne 0) {
        Write-Warning "$Label returned UE exit code $exitCode after its success marker."
    }
}

Assert-Exists $EditorCmd "UnrealEditor-Cmd.exe"
Assert-Exists $SourceProject "Kelly source project"
Assert-Exists $TargetProject "Neon Cleaner project"
Assert-Exists $InspectScript "Kelly inspection script"
Assert-Exists $RelocateScript "Kelly relocation script"
Assert-Exists $ValidateScript "Kelly migration validation script"
Assert-Exists $StyleScript "Kelly material style script"
Assert-Exists $RideAnimationScript "Kelly ride animation script"

if (Test-Path -LiteralPath $TargetKellyDirectory) {
    throw "Target KellySource already exists; inspect it before replacing: $TargetKellyDirectory"
}

$beforeSnapshot = Get-SourceSnapshot
New-Item -ItemType Directory -Path $StageDirectory | Out-Null
New-Item -ItemType Directory -Path $StageReports | Out-Null
Copy-Item -LiteralPath $SourceProject -Destination $StageProject
Copy-Item -LiteralPath (Join-Path $SourceDirectory "Config") -Destination $StageDirectory -Recurse
Copy-Item -LiteralPath (Join-Path $SourceDirectory "Content") -Destination $StageDirectory -Recurse

$previousInspectOutput = $env:KELLY_INSPECT_OUTPUT
$previousRelocateOutput = $env:KELLY_RELOCATE_REPORT
try {
    $env:KELLY_INSPECT_OUTPUT = $InspectReport
    Invoke-UEScript $StageProject $InspectScript "\[KellySourceInspect\] Inspection passed" "Inspect staged Kelly source"
    Assert-Exists $InspectReport "Kelly source inventory"

    $env:KELLY_RELOCATE_REPORT = $RelocateReport
    Invoke-UEScript $StageProject $RelocateScript "\[KellyRelocate\] Relocation passed" "Relocate Kelly packages"
    Assert-Exists $RelocateReport "Kelly relocation report"
}
finally {
    $env:KELLY_INSPECT_OUTPUT = $previousInspectOutput
    $env:KELLY_RELOCATE_REPORT = $previousRelocateOutput
}

$afterSnapshot = Get-SourceSnapshot
$snapshotDifference = Compare-Object -ReferenceObject $beforeSnapshot -DifferenceObject $afterSnapshot -Property FullName, Length, LastWriteUtc, Sha256
if ($snapshotDifference) {
    throw "Original Kelly source changed during staging; migration is blocked."
}

$StageKellyDirectory = Join-Path $StageDirectory "Content\KellySource"
Assert-Exists $StageKellyDirectory "Relocated staging KellySource"
Copy-Item -LiteralPath $StageKellyDirectory -Destination $TargetKellyDirectory -Recurse

Invoke-UEScript $TargetProject $ValidateScript "\[KellyMigrationValidate\] Validation passed" "Validate Kelly in NeonCleanerUE"
Invoke-UEScript $TargetProject $StyleScript "\[KellyMaterialStyle\] Applied final palette" "Apply Lin Xia palette to Kelly"
Invoke-UEScript $TargetProject $RideAnimationScript "\[KellyRideAnim\] Creation passed" "Create Kelly motorcycle ride animations"

Write-Host ""
Write-Host "Kelly migration completed." -ForegroundColor Green
Write-Host "Staging: $StageDirectory"
Write-Host "Inventory: $InspectReport"
Write-Host "Relocation report: $RelocateReport"
Write-Host "Target: $TargetKellyDirectory"
