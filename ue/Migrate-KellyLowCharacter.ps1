param(
    [string]$SourceProject = "D:\kelly-UE\kelly\我的项目2\我的项目2.uproject"
)

$ErrorActionPreference = "Stop"

$EditorCmd = "C:\Program Files\Epic Games\UE_5.8\Engine\Binaries\Win64\UnrealEditor-Cmd.exe"
$TargetProject = Join-Path $PSScriptRoot "NeonCleanerUE\NeonCleanerUE.uproject"
$TargetKellyDirectory = Join-Path $PSScriptRoot "NeonCleanerUE\Content\KellyLowSource"
$InspectScript = Join-Path $PSScriptRoot "scripts\inspect_kelly_low_source.py"
$RelocateScript = Join-Path $PSScriptRoot "scripts\relocate_kelly_low_source.py"
$ValidateScript = Join-Path $PSScriptRoot "scripts\validate_kelly_low_migration.py"

$SourceDirectory = Split-Path -Parent $SourceProject
$StageDirectory = Join-Path ([System.IO.Path]::GetTempPath()) ("NeonCleaner-KellyLow-Staging-" + [guid]::NewGuid().ToString("N"))
$StageProject = Join-Path $StageDirectory "KellyLowStaging.uproject"
$StageReports = Join-Path $StageDirectory "Reports"
$InspectReport = Join-Path $StageReports "kelly-low-source-inventory.json"
$RelocateReport = Join-Path $StageReports "kelly-low-relocation.json"

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
    & $EditorCmd $Project -unattended -nop4 -nosplash -ddc=NoZenLocalFallback -DDC-ForceMemoryCache -run=pythonscript "-script=$normalizedScript"
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
Assert-Exists $SourceProject "Low Kelly source project"
Assert-Exists $TargetProject "Neon Cleaner project"
Assert-Exists $InspectScript "Low Kelly inspection script"
Assert-Exists $RelocateScript "Low Kelly relocation script"
Assert-Exists $ValidateScript "Low Kelly validation script"

if (Test-Path -LiteralPath $TargetKellyDirectory) {
    throw "KellyLowSource already exists; inspect it before replacing: $TargetKellyDirectory"
}

$beforeSnapshot = Get-SourceSnapshot
New-Item -ItemType Directory -Path $StageDirectory,$StageReports | Out-Null
Copy-Item -LiteralPath $SourceProject -Destination $StageProject
Copy-Item -LiteralPath (Join-Path $SourceDirectory "Config") -Destination $StageDirectory -Recurse
Copy-Item -LiteralPath (Join-Path $SourceDirectory "Content") -Destination $StageDirectory -Recurse

$previousInspect = $env:KELLY_LOW_INSPECT_OUTPUT
$previousRelocate = $env:KELLY_LOW_RELOCATE_REPORT
$previousSourceRoot = $env:KELLY_LOW_SOURCE_ROOT
try {
    $env:KELLY_LOW_SOURCE_ROOT = $SourceDirectory
    $env:KELLY_LOW_INSPECT_OUTPUT = $InspectReport
    Invoke-UEScript $StageProject $InspectScript "\[KellyLowInspect\] Inspection passed" "Inspect staged low Kelly"
    Assert-Exists $InspectReport "Low Kelly source inventory"

    $env:KELLY_LOW_RELOCATE_REPORT = $RelocateReport
    Invoke-UEScript $StageProject $RelocateScript "\[KellyLowRelocate\] Relocation passed" "Relocate low Kelly dependencies"
    Assert-Exists $RelocateReport "Low Kelly relocation report"
}
finally {
    $env:KELLY_LOW_INSPECT_OUTPUT = $previousInspect
    $env:KELLY_LOW_RELOCATE_REPORT = $previousRelocate
    $env:KELLY_LOW_SOURCE_ROOT = $previousSourceRoot
}

$afterSnapshot = Get-SourceSnapshot
$difference = Compare-Object -ReferenceObject $beforeSnapshot -DifferenceObject $afterSnapshot -Property FullName,Length,LastWriteUtc,Sha256
if ($difference) {
    throw "Original low Kelly source changed during staging; migration is blocked."
}

$StageKellyDirectory = Join-Path $StageDirectory "Content\KellyLowSource"
Assert-Exists $StageKellyDirectory "Relocated staging KellyLowSource"
Copy-Item -LiteralPath $StageKellyDirectory -Destination $TargetKellyDirectory -Recurse

Invoke-UEScript $TargetProject $ValidateScript "\[KellyLowMigrationValidate\] Validation passed" "Validate low Kelly in NeonCleanerUE"

Write-Host "Low Kelly migration completed." -ForegroundColor Green
Write-Host "Staging: $StageDirectory"
Write-Host "Inventory: $InspectReport"
Write-Host "Relocation: $RelocateReport"
Write-Host "Target: $TargetKellyDirectory"
