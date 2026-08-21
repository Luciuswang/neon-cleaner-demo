param(
  [switch]$Game,
  [switch]$Log
)

$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$project = Join-Path $root "NeonCleanerUE\NeonCleanerUE.uproject"

$candidateEditors = @(
  "C:\Program Files\Epic Games\UE_5.8\Engine\Binaries\Win64\UnrealEditor.exe",
  "D:\Program Files\Epic Games\UE_5.8\Engine\Binaries\Win64\UnrealEditor.exe",
  "D:\EpicGames\UE_5.8\Engine\Binaries\Win64\UnrealEditor.exe"
)

$editor = $candidateEditors | Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1
if (-not $editor) {
  $found = Get-ChildItem -Path "C:\Program Files\Epic Games","D:\Program Files\Epic Games","D:\EpicGames" -Recurse -Filter UnrealEditor.exe -ErrorAction SilentlyContinue |
    Select-Object -First 1 -ExpandProperty FullName
  $editor = $found
}

if (-not $editor -or -not (Test-Path -LiteralPath $editor)) {
  throw "UnrealEditor.exe was not found. Finish installing UE 5.8.1 in Epic Games Launcher first."
}

$args = @("`"$project`"")
if ($Game) { $args += "-game" }
if ($Log) { $args += "-log" }

Write-Host "Launching Unreal Editor:"
Write-Host $editor
Write-Host $project
Start-Process -FilePath $editor -ArgumentList $args
