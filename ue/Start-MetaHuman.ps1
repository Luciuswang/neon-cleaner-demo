param([switch]$CheckOnly, [string]$UEPath = $env:NEON_UE_ROOT)
$ErrorActionPreference = 'Stop'
if (-not $UEPath) { $UEPath = 'C:\Program Files\Epic Games\UE_5.8' }
$project = Join-Path $PSScriptRoot 'NeonCleanerUE\NeonCleanerUE.uproject'
$editor = Join-Path $UEPath 'Engine\Binaries\Win64\UnrealEditor.exe'
$commandlet = Join-Path $UEPath 'Engine\Binaries\Win64\UnrealEditor-Cmd.exe'
$plugin = Join-Path $UEPath 'Engine\Plugins\MetaHuman\MetaHumanCharacter'
$optional = Join-Path $plugin 'Content\Optional'
$model = Join-Path $optional 'TextureSynthesis'
$body = Join-Path $optional 'BodyTextures'
foreach ($path in @($project, $editor, $commandlet, (Join-Path $plugin 'MetaHumanCharacter.uplugin'))) {
    if (-not (Test-Path -LiteralPath $path)) { throw "Required file missing: $path" }
}
$modelFiles = @(Get-ChildItem -LiteralPath $model -Filter '*.ar' -File -Recurse -ErrorAction SilentlyContinue)
$bodyFiles = @(Get-ChildItem -LiteralPath $body -Filter '*.uasset' -File -ErrorAction SilentlyContinue)
if (-not $modelFiles.Count -or -not $bodyFiles.Count) {
    Write-Host 'MetaHuman Creator Core Data is missing.' -ForegroundColor Yellow
    Write-Host 'Save and close Unreal projects, then open Epic Games Launcher > Unreal Engine > Library > UE 5.8 > Options > MetaHuman Creator Core Data > Apply.'
    Write-Host 'After installation, run Start-MetaHuman.bat again. Guide: docs/metahuman-quickstart.md'
    exit 2
}
Write-Host 'MetaHuman Creator Core Data: detected by Epic engine file checks.'
if ($CheckOnly) { exit 0 }
$projectPath = [IO.Path]::GetFullPath($project).Replace('\','/')
$running = @(Get-CimInstance Win32_Process -Filter "Name='UnrealEditor.exe' OR Name='UnrealEditor-Cmd.exe'" |
    Where-Object { $_.CommandLine -and $_.CommandLine.Replace('\','/').IndexOf($projectPath, [StringComparison]::OrdinalIgnoreCase) -ge 0 })
if ($running.Count) {
    throw 'This project is already open. Save your work and close its editor first; it needs a restart to load MetaHuman plugins.'
}
$logDir = Join-Path $PSScriptRoot 'NeonCleanerUE\Saved\Logs'
New-Item -ItemType Directory -Force -Path $logDir | Out-Null
$log = Join-Path $logDir 'metahuman-starter.log'
$script = (Join-Path $PSScriptRoot 'scripts\metahuman\create_starter.py').Replace('\','/')
$argsUE = @(('"' + $project + '"'), '-unattended', '-nop4', '-nosplash', '-nullrhi',
    '-ddc=NoZenLocalFallback', '-DDC-ForceMemoryCache', '-run=pythonscript',
    ('-script="' + $script + '"'), ('-abslog="' + $log + '"'))
$p = Start-Process -FilePath $commandlet -ArgumentList $argsUE -WindowStyle Hidden -PassThru
if (-not $p.WaitForExit(300000)) { Stop-Process -Id $p.Id -Force; throw "Starter creation timed out. Log: $log" }
if ($p.ExitCode -ne 0 -or -not (Test-Path -LiteralPath $log) -or
    (Select-String -LiteralPath $log -Pattern 'LogPython: Error|Fatal error:|Assertion failed:' -Quiet) -or
    -not (Select-String -LiteralPath $log -SimpleMatch '[MetaHumanStarter] SUCCESS:' -Quiet)) {
    throw "Starter creation failed. The editor was not started. Inspect: $log"
}
Write-Host 'Starting Unreal Editor. Open Content/MetaHumanWorkspace/Characters/Heroine_MetaHuman.'
Start-Process -FilePath $editor -ArgumentList @(('"' + $project + '"'), '-nop4', '-nosplash') -WindowStyle Normal
