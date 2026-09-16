param(
    [string]$PythonScript = "",
    [string[]]$GameArguments = @(),
    [string]$LogName = "neon-run",
    [int]$TimeoutSeconds = 300,
    [int]$ResX = 1920,
    [int]$ResY = 1080,
    [switch]$NullRhi
)

$ErrorActionPreference = "Stop"
$project = Join-Path $PSScriptRoot "NeonCleanerUE\NeonCleanerUE.uproject"
$saved = Join-Path $PSScriptRoot "NeonCleanerUE\Saved\Quality"
New-Item -ItemType Directory -Force -Path $saved | Out-Null
$log = Join-Path $saved ($LogName + ".log")
$editorName = if ($PythonScript) { "UnrealEditor-Cmd.exe" } else { "UnrealEditor.exe" }
$editor = Join-Path "C:\Program Files\Epic Games\UE_5.8\Engine\Binaries\Win64" $editorName
$arguments = @(
    ('"' + $project + '"'), '-unattended', '-nop4', '-nosplash',
    '-ddc=NoZenLocalFallback', '-DDC-ForceMemoryCache',
    ('-abslog="' + $log + '"')
)
if ($PythonScript) {
    $scriptPath = (Resolve-Path -LiteralPath $PythonScript).Path.Replace('\', '/')
    $arguments += @('-run=pythonscript', ('-script="' + $scriptPath + '"'))
} else {
    $arguments += @('/Game/LinxiaChase/LVL_Linxia_MotorcycleChase', '-game',
        '-windowed', "-ResX=$ResX", "-ResY=$ResY") + $GameArguments
}
if ($NullRhi) { $arguments += '-nullrhi' }
if (Test-Path -LiteralPath $log) { Remove-Item -LiteralPath $log }
$process = Start-Process -FilePath $editor -ArgumentList $arguments -WindowStyle Hidden -PassThru
if (-not $process.WaitForExit($TimeoutSeconds * 1000)) {
    Stop-Process -Id $process.Id -Force
    throw "UE timeout after $TimeoutSeconds seconds. Log: $log"
}
if (-not (Test-Path -LiteralPath $log)) { throw "UE produced no log: $log" }
if (Select-String -LiteralPath $log -Pattern 'LogPython: Error|Traceback|Fatal error:' -Quiet) {
    Get-Content -LiteralPath $log -Tail 35
    throw "UE reported a script or fatal error. Log: $log"
}
Write-Host "UE exit=$($process.ExitCode) log=$log"
if ($process.ExitCode -ne 0) { throw "UE exited with code $($process.ExitCode). Inspect $log" }
