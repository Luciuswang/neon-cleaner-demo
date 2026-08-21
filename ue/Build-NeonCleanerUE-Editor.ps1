$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$project = Join-Path $root "NeonCleanerUE\NeonCleanerUE.uproject"

$buildBat = @(
  "C:\Program Files\Epic Games\UE_5.8\Engine\Build\BatchFiles\Build.bat",
  "D:\Program Files\Epic Games\UE_5.8\Engine\Build\BatchFiles\Build.bat",
  "D:\EpicGames\UE_5.8\Engine\Build\BatchFiles\Build.bat"
) | Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1

if (-not $buildBat) {
  throw "Build.bat was not found. Finish installing UE 5.8.1 first."
}

$buildDir = Split-Path -Parent $buildBat
Push-Location $buildDir
try {
  & $buildBat NeonCleanerUEEditor Win64 Development -Project="$project" -WaitMutex
}
finally {
  Pop-Location
}
