$ErrorActionPreference = "Stop"

$ProjectRoot = Split-Path -Parent $PSScriptRoot
$UProject = Join-Path $PSScriptRoot "NeonCleanerUE\NeonCleanerUE.uproject"
$Editor = "C:\Program Files\Epic Games\UE_5.8\Engine\Binaries\Win64\UnrealEditor.exe"
$Map = "/Game/LinxiaChase/LVL_Linxia_MotorcycleChase"

if (-not (Test-Path $Editor)) {
    throw "UnrealEditor.exe not found: $Editor"
}
if (-not (Test-Path $UProject)) {
    throw "UE project not found: $UProject"
}

Write-Host "Launching Linxia motorcycle chase..."
Write-Host "Controls: W/S accelerate/brake, A/D steer, mouse camera, Space brake, R reset"
Start-Process -FilePath $Editor -ArgumentList @(
    "`"$UProject`"",
    $Map,
    "-game",
    "-windowed",
    "-ResX=1280",
    "-ResY=720",
    "-ddc=NoZenLocalFallback",
    "-DDC-ForceMemoryCache",
    "-nop4",
    "-nosplash"
)
