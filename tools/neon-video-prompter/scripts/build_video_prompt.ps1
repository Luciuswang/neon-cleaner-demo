[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string]$RepoRoot,

    [Parameter(Mandatory = $true)]
    [string]$ShotId,

    [string]$Look,
    [string]$Motion,
    [string]$Performance,
    [string]$Environment,
    [string]$OutputPath
)

$ErrorActionPreference = "Stop"

$shotLibraryPath = Join-Path $PSScriptRoot "..\references\shot-library.json"
$shotLibraryPath = [System.IO.Path]::GetFullPath($shotLibraryPath)

if (!(Test-Path $shotLibraryPath)) {
    throw "Shot library not found: $shotLibraryPath"
}

$library = Get-Content $shotLibraryPath -Raw | ConvertFrom-Json
$shot = $library.shots | Where-Object { $_.id -eq $ShotId } | Select-Object -First 1

if (!$shot) {
    throw "Shot '$ShotId' not found in $shotLibraryPath"
}

$referencePath = Join-Path $RepoRoot $shot.characterReference
$referencePath = [System.IO.Path]::GetFullPath($referencePath)

$tweakLines = @()
if ($Look) { $tweakLines += "- Look: $Look" }
if ($Motion) { $tweakLines += "- Motion: $Motion" }
if ($Performance) { $tweakLines += "- Performance: $Performance" }
if ($Environment) { $tweakLines += "- Environment: $Environment" }
if (!$tweakLines) { $tweakLines += "- No extra tweak notes supplied." }

$continuityLines = $shot.continuityRules | ForEach-Object { "- $_" }

$mergedPrompt = $shot.masterPrompt
if ($Look) { $mergedPrompt += " Visual adjustment: $Look." }
if ($Performance) { $mergedPrompt += " Performance adjustment: $Performance." }
if ($Environment) { $mergedPrompt += " Environment adjustment: $Environment." }

$mergedMotion = $shot.motionPrompt
if ($Motion) { $mergedMotion += " Motion adjustment: $Motion." }

$package = @(
    "# $($shot.id) $($shot.title)"
    ""
    "Scene goal:"
    "$($shot.sceneGoal)"
    ""
    "Reference image:"
    "$referencePath"
    ""
    "Continuity rules:"
    $continuityLines
    ""
    "Master prompt:"
    $mergedPrompt
    ""
    "Motion prompt:"
    $mergedMotion
    ""
    "Negative prompt:"
    "$($shot.negativePrompt)"
    ""
    "Merged tweak notes:"
    $tweakLines
)

$result = $package -join [Environment]::NewLine

if ($OutputPath) {
    $resolvedOutput = [System.IO.Path]::GetFullPath((Join-Path (Get-Location) $OutputPath))
    $outputDir = Split-Path -Parent $resolvedOutput
    if ($outputDir -and !(Test-Path $outputDir)) {
        New-Item -ItemType Directory -Path $outputDir | Out-Null
    }
    Set-Content -Path $resolvedOutput -Value $result -Encoding utf8
}

Write-Output $result
