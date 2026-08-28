param(
    [string]$OutputPath = "",
    [ValidateSet("Default", "Side", "Rear")]
    [string]$View = "Default",
    [ValidateSet("Default", "Compact", "Bars", "AsymBars")]
    [string]$Pose = "Default"
)

$ErrorActionPreference = "Stop"

$ProjectRoot = Split-Path -Parent $PSScriptRoot
$UProject = Join-Path $PSScriptRoot "NeonCleanerUE\NeonCleanerUE.uproject"
$Editor = "C:\Program Files\Epic Games\UE_5.8\Engine\Binaries\Win64\UnrealEditor.exe"
$Map = "/Game/LinxiaChase/LVL_Linxia_MotorcycleChase"
if ($OutputPath.Trim().Length -eq 0) {
    $stamp = Get-Date -Format "yyyy-MM-dd_HHmmss"
    $OutputPath = Join-Path $ProjectRoot "source\reference\linxia\ue-captures\linxia_motorcycle_capture_$stamp.png"
}

if (-not (Test-Path $Editor)) {
    throw "UnrealEditor.exe not found: $Editor"
}
if (-not (Test-Path $UProject)) {
    throw "UE project not found: $UProject"
}

New-Item -ItemType Directory -Force -Path (Split-Path -Parent $OutputPath) | Out-Null
Remove-Item -LiteralPath $OutputPath -ErrorAction SilentlyContinue

$process = Start-Process -FilePath $Editor -ArgumentList @(
    "`"$UProject`"",
    $Map,
    "-game",
    "-windowed",
    "-ResX=1280",
    "-ResY=720",
    "-nop4",
    "-nosplash",
    "-LinxiaMotorcycleCapture=`"$OutputPath`"",
    "-LinxiaMotorcycleCaptureView=$View",
    "-LinxiaRiderPose=$Pose"
) -PassThru

if (-not $process.WaitForExit(90000)) {
    Stop-Process -Id $process.Id -Force
    throw "Motorcycle capture did not exit within 90 seconds"
}

if (-not (Test-Path $OutputPath)) {
    $LogPath = Join-Path $PSScriptRoot "NeonCleanerUE\Saved\Logs\NeonCleanerUE.log"
    if (Test-Path $LogPath) {
        Select-String -Path $LogPath -Pattern "LinxiaMotorcycleCapture|LinxiaMotorcycle" | Select-Object -Last 12
    }
    throw "Motorcycle capture image was not created: $OutputPath"
}

Write-Host $OutputPath
