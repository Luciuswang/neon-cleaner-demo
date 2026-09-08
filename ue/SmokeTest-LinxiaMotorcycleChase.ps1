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
    "-ddc=NoZenLocalFallback",
    "-DDC-ForceMemoryCache",
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
$alignmentLines = Select-String -Path $LogPath -Pattern "\[LinxiaMotorcycle\] Visual alignment" |
    Select-Object -Last 4
$animationLines = Select-String -Path $LogPath -Pattern "\[LinxiaMotorcycle\] Rider source=/Game/KellyLowSource/asda.asda pose=ProceduralTwoBoneIK contacts=PASS" |
    Select-Object -Last 4
$ikPassLines = @(Select-String -Path $LogPath -Pattern "\[LinxiaMotorcycleIK\] chain=(LeftHand|RightHand|LeftFoot|RightFoot).*error=[0-9]+\.[0-9]+ passed=1$")
$ikFailureLines = Select-String -Path $LogPath -Pattern "Invalid IK|\[LinxiaMotorcycleIK\].*passed=0|contacts=FAIL|error=(NaN|INF)" |
    Select-Object -Last 4
$contactLines = Select-String -Path $LogPath -Pattern "\[LinxiaMotorcycle\] Rider contact pose" |
    Select-Object -Last 4
$contactVisualLines = Select-String -Path $LogPath -Pattern "\[LinxiaMotorcycle\] Rider contact visual" |
    Select-Object -Last 4
$completedLines = Select-String -Path $LogPath -Pattern "\[LinxiaMotorcycleSmokeTest\] Completed" |
    Select-Object -Last 4
if (-not $possessionLines) {
    throw "Smoke-test possession marker not found in log"
}
if (-not $alignmentLines) {
    throw "Smoke-test visual alignment marker not found in log"
}
if (-not $animationLines) {
    throw "Smoke-test Kelly rider contact PASS marker not found in log"
}
if ($ikFailureLines) {
    throw "Smoke-test rider IK failure marker found: $($ikFailureLines[-1].Line)"
}
if ($ikPassLines.Count -ne 4) {
    throw "Smoke-test expected exactly four passing IK logs, found $($ikPassLines.Count)"
}
$ikChains = @($ikPassLines | ForEach-Object {
    if ($_.Line -match "chain=(LeftHand|RightHand|LeftFoot|RightFoot)") { $Matches[1] }
} | Sort-Object -Unique)
if ($ikChains.Count -ne 4) {
    throw "Smoke-test expected four passing IK chains, found $($ikChains.Count): $($ikChains -join ', ')"
}
foreach ($ikLine in $ikPassLines) {
    if ($ikLine.Line -notmatch "error=([0-9]+\.[0-9]+) passed=1$") {
        throw "Smoke-test could not parse IK endpoint error: $($ikLine.Line)"
    }
    $endpointError = [double]::Parse(
        $Matches[1],
        [System.Globalization.CultureInfo]::InvariantCulture)
    if ($endpointError -gt 3.0) {
        throw "Smoke-test IK endpoint error exceeds 3 cm: $($ikLine.Line)"
    }
}
if (-not $contactLines) {
    throw "Smoke-test rider contact pose marker not found in log"
}
if (-not $contactVisualLines) {
    throw "Smoke-test rider contact visual marker not found in log"
}
if (-not $completedLines) {
    throw "Smoke-test completion marker not found in log"
}

$possessionLines | ForEach-Object { $_.Line }
$alignmentLines | ForEach-Object { $_.Line }
$animationLines | ForEach-Object { $_.Line }
$ikPassLines | ForEach-Object { $_.Line }
$contactLines | ForEach-Object { $_.Line }
$contactVisualLines | ForEach-Object { $_.Line }
$completedLines | ForEach-Object { $_.Line }
