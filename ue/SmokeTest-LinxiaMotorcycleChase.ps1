$ErrorActionPreference = "Stop"

$UProject = Join-Path $PSScriptRoot "NeonCleanerUE\NeonCleanerUE.uproject"
$Editor = "C:\Program Files\Epic Games\UE_5.8\Engine\Binaries\Win64\UnrealEditor.exe"
$Map = "/Game/LinxiaChase/LVL_Linxia_MotorcycleChase"

if (-not (Test-Path $Editor)) {
    throw "UnrealEditor.exe not found: $Editor"
}

$process = Start-Process -FilePath $Editor -ArgumentList @(
    "`"$UProject`"",
    $Map,
    "-game",
    "-nullrhi",
    "-unattended",
    "-nop4",
    "-nosplash",
    "-LinxiaMotorcycleSmokeTest"
) -PassThru

if (-not $process.WaitForExit(90000)) {
    Stop-Process -Id $process.Id -Force
    throw "Motorcycle smoke test did not exit within 90 seconds"
}

$LogPath = Join-Path $PSScriptRoot "NeonCleanerUE\Saved\Logs\NeonCleanerUE.log"
if (-not (Test-Path $LogPath)) {
    throw "UE log not found: $LogPath"
}

$possessionLines = Select-String -Path $LogPath -Pattern "\[LinxiaMotorcycle\] Player0 now controls" |
    Select-Object -Last 4
$completedLines = Select-String -Path $LogPath -Pattern "\[LinxiaMotorcycleSmokeTest\] Completed" |
    Select-Object -Last 4
if (-not $possessionLines) {
    throw "Smoke-test possession marker not found in log"
}
if (-not $completedLines) {
    throw "Smoke-test completion marker not found in log"
}

$possessionLines | ForEach-Object { $_.Line }
$completedLines | ForEach-Object { $_.Line }
