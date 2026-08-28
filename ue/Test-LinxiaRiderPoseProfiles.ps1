param(
    [string[]]$Profiles = @("Default", "Compact", "Bars", "AsymBars"),
    [ValidateSet("Side", "Rear")]
    [string[]]$Views = @("Side", "Rear")
)

$ErrorActionPreference = "Stop"

$CaptureScript = Join-Path $PSScriptRoot "Capture-LinxiaMotorcycleChase.ps1"
$OutputDir = Join-Path $PSScriptRoot "NeonCleanerUE\Saved\Quality"
$LogPath = Join-Path $PSScriptRoot "NeonCleanerUE\Saved\Logs\NeonCleanerUE.log"
$Stamp = Get-Date -Format "yyyy-MM-dd_HHmmss"

if (-not (Test-Path -LiteralPath $CaptureScript)) {
    throw "Capture script not found: $CaptureScript"
}

New-Item -ItemType Directory -Force -Path $OutputDir | Out-Null

foreach ($profile in $Profiles) {
    foreach ($view in $Views) {
        $name = "linxia_rider_pose_{0}_{1}_{2}.png" -f $profile.ToLower(), $view.ToLower(), $Stamp
        $path = Join-Path $OutputDir $name
        Write-Host ""
        Write-Host "== Capture pose=$profile view=$view ==" -ForegroundColor Cyan
        powershell -ExecutionPolicy Bypass -File $CaptureScript -OutputPath $path -View $view -Pose $profile
        Write-Host $path

        if (Test-Path -LiteralPath $LogPath) {
            Select-String -Path $LogPath -Pattern "Rider pose profile|Rider contact pose" | Select-Object -Last 2
        }
    }
}

Write-Host ""
Write-Host "Pose profile captures written to: $OutputDir"
