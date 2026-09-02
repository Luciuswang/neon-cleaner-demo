param(
    [switch]$ValidateOnly
)

$ErrorActionPreference = "Stop"

$UProject = Join-Path $PSScriptRoot "NeonCleanerUE\NeonCleanerUE.uproject"
$EditorCmd = "C:\Program Files\Epic Games\UE_5.8\Engine\Binaries\Win64\UnrealEditor-Cmd.exe"
$LogPath = Join-Path $PSScriptRoot "NeonCleanerUE\Saved\Logs\NeonCleanerUE.log"

function Invoke-UEScript($label, $scriptName, $successPattern) {
    $scriptPath = Join-Path $PSScriptRoot "scripts\$scriptName"
    if (-not (Test-Path -LiteralPath $scriptPath)) {
        throw "$label script not found: $scriptPath"
    }

    Write-Host ""
    Write-Host "== $label ==" -ForegroundColor Cyan
    Remove-Item -LiteralPath $LogPath -ErrorAction SilentlyContinue
    # PowerShell passes -ExecutePythonScript= as a single native argument, but
    # Unreal's commandlet parser truncates a script path containing spaces.
    # The documented -run=pythonscript form preserves the quoted path.
    $normalizedScriptPath = $scriptPath.Replace('\', '/')
    $command = '"' + $EditorCmd + '" "' + $UProject + '" -unattended -nop4 -nosplash -ddc=NoZenLocalFallback -DDC-ForceMemoryCache -run=pythonscript -script="' + $normalizedScriptPath + '"'
    & cmd.exe /d /s /c $command
    $exitCode = $LASTEXITCODE
    if (-not (Test-Path -LiteralPath $LogPath)) {
        throw "$label did not produce a UE log: $LogPath"
    }
    $pythonError = Select-String -Path $LogPath -Pattern "LogPython: Error|Traceback" | Select-Object -Last 1
    if ($pythonError) {
        throw "$label failed with Python error: $($pythonError.Line)"
    }
    $success = Select-String -Path $LogPath -Pattern $successPattern | Select-Object -Last 1
    if (-not $success) {
        throw "$label success marker not found: $successPattern"
    }
    if ($exitCode -ne 0) {
        Write-Warning "$label returned UE exit code $exitCode after target success marker; treating external asset load errors as non-blocking."
    }
}

if (-not (Test-Path -LiteralPath $EditorCmd)) {
    throw "UnrealEditor-Cmd.exe not found: $EditorCmd"
}
if (-not (Test-Path -LiteralPath $UProject)) {
    throw "UE project not found: $UProject"
}

if (-not $ValidateOnly) {
    Invoke-UEScript "Create Linxia Phase IK Rig" "create_linxia_phase_ik_rig.py" "\[LinxiaPhaseIKRig\] Saved"
    Invoke-UEScript "Create Linxia Phase Control Rig" "create_linxia_phase_control_rig.py" "\[LinxiaPhaseControlRig\] Saved"
    Invoke-UEScript "Create Linxia Motorcycle Ride Animation" "create_linxia_motorcycle_ride_anim.py" "\[LinxiaRideAnim\] Saved"
}

Invoke-UEScript "Validate Linxia Phase IK Rig" "validate_linxia_phase_ik_rig.py" "\[LinxiaPhaseIKRigValidate\] Validation passed"
Invoke-UEScript "Validate Linxia Phase Control Rig" "validate_linxia_phase_control_rig.py" "\[LinxiaPhaseControlRigValidate\] Validation passed"
Invoke-UEScript "Validate Linxia Motorcycle Ride Animation" "validate_linxia_motorcycle_ride_anim.py" "\[LinxiaRideAnimValidate\] Validation passed"

Write-Host ""
Write-Host "Linxia rig assets are ready."
