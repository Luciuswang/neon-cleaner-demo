param(
    [switch]$ValidateOnly
)

$ErrorActionPreference = "Stop"

$UProject = Join-Path $PSScriptRoot "NeonCleanerUE\NeonCleanerUE.uproject"
$EditorCmd = "C:\Program Files\Epic Games\UE_5.8\Engine\Binaries\Win64\UnrealEditor-Cmd.exe"

function Invoke-UEScript($label, $scriptName) {
    $scriptPath = Join-Path $PSScriptRoot "scripts\$scriptName"
    if (-not (Test-Path -LiteralPath $scriptPath)) {
        throw "$label script not found: $scriptPath"
    }

    Write-Host ""
    Write-Host "== $label ==" -ForegroundColor Cyan
    & $EditorCmd $UProject -unattended -nop4 -nosplash "-ExecutePythonScript=$scriptPath"
    if ($LASTEXITCODE -ne 0) {
        throw "$label failed with exit code $LASTEXITCODE"
    }
}

if (-not (Test-Path -LiteralPath $EditorCmd)) {
    throw "UnrealEditor-Cmd.exe not found: $EditorCmd"
}
if (-not (Test-Path -LiteralPath $UProject)) {
    throw "UE project not found: $UProject"
}

if (-not $ValidateOnly) {
    Invoke-UEScript "Create Linxia Phase IK Rig" "create_linxia_phase_ik_rig.py"
    Invoke-UEScript "Create Linxia Phase Control Rig" "create_linxia_phase_control_rig.py"
}

Invoke-UEScript "Validate Linxia Phase IK Rig" "validate_linxia_phase_ik_rig.py"
Invoke-UEScript "Validate Linxia Phase Control Rig" "validate_linxia_phase_control_rig.py"

Write-Host ""
Write-Host "Linxia rig assets are ready."
