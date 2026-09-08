$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$repo = Split-Path -Parent $root
$project = Join-Path $root "NeonCleanerUE\NeonCleanerUE.uproject"
$editor = "C:\Program Files\Epic Games\UE_5.8\Engine\Binaries\Win64\UnrealEditor.exe"
$outDir = Join-Path $repo "source\reference\linxia\ue-captures"
$outFile = Join-Path $outDir "linxia_kelly_low_preview_2026-09-08.png"

if (-not (Test-Path -LiteralPath $editor)) {
  throw "UnrealEditor.exe was not found: $editor"
}
if (-not (Test-Path -LiteralPath $project)) {
  throw "UE project was not found: $project"
}

New-Item -ItemType Directory -Force -Path $outDir | Out-Null
Remove-Item -LiteralPath $outFile -ErrorAction SilentlyContinue

$process = Start-Process -FilePath $editor -ArgumentList @(
  "`"$project`"",
  "/Game/LinxiaPreview/LVL_Linxia_CharacterPreview",
  "-game",
  "-windowed",
  "-ResX=1280",
  "-ResY=720",
  "-ddc=NoZenLocalFallback",
  "-DDC-ForceMemoryCache",
  "-nop4",
  "-nosplash",
  "-LinxiaReferencePose",
  "-LinxiaCharacterCapture=`"$outFile`""
) -PassThru

if (-not $process.WaitForExit(600000)) {
  Stop-Process -Id $process.Id -Force
  throw "Kelly preview capture did not exit within 600 seconds."
}

if (-not (Test-Path -LiteralPath $outFile)) {
  throw "Kelly preview capture was not created: $outFile"
}

Write-Output $outFile
