param(
    [ValidateSet('Default','Side','Rear','Hands','HandsRight','Establishing','Bridge')]
    [string]$View = 'Side',
    [Parameter(Mandatory=$true)][string]$OutputDirectory,
    [string]$CaptureId = 'neon-offscreen',
    [ValidateRange(1,1800)][int]$Frames = 360,
    [switch]$RealtimeProfile,
    [string]$FfmpegPath = '',
    [string]$UEPath = $env:NEON_UE_ROOT
)
$ErrorActionPreference = 'Stop'
if (-not $UEPath) { $UEPath = 'C:\Program Files\Epic Games\UE_5.8' }
if (Get-Process UnrealEditor,UnrealEditor-Cmd -ErrorAction SilentlyContinue) { throw 'UE work is serialized; finish the existing UE process first.' }
$OutputDirectory = [IO.Path]::GetFullPath($OutputDirectory)
if (Test-Path -LiteralPath $OutputDirectory) { throw 'A fresh evidence directory is required; existing evidence is never overwritten.' }
New-Item -ItemType Directory -Path $OutputDirectory | Out-Null
$project = Join-Path $PSScriptRoot 'NeonCleanerUE/NeonCleanerUE.uproject'
$log = Join-Path $OutputDirectory 'runtime.log'
$argsUE = @(('"'+$project+'"'), '/Game/LinxiaChase/LVL_Linxia_MotorcycleChase', '-game', '-RenderOffscreen',
    '-unattended', '-nosplash', '-nosound', '-nop4', '-ResX=1920', '-ResY=1080', '-ForceRes',
    '-ddc=NoZenLocalFallback', '-DDC-ForceMemoryCache', ('-abslog="'+$log+'"'),
    '-ExecCmds="r.ScreenPercentage 100,r.DynamicRes.OperationMode 0,t.MaxFPS 60"')
if ($RealtimeProfile) {
    $argsUE += @('-NeonChaseSmoke=Clean','-NeonChaseSmokeSpeed=1','-NeonSkipFilms',('-NeonRealtimeProfile="'+$OutputDirectory+'"'))
} else {
    $argsUE += @(('-NeonOffscreenVideo="'+$OutputDirectory+'"'), "-NeonCaptureId=$CaptureId",
        "-NeonOffscreenFrames=$Frames", "-LinxiaMotorcycleCaptureView=$View")
}
$p = Start-Process -FilePath (Join-Path $UEPath 'Engine/Binaries/Win64/UnrealEditor.exe') -ArgumentList $argsUE -WindowStyle Hidden -PassThru
if (-not $p.WaitForExit(900000)) { Stop-Process -Id $p.Id -Force; throw 'Offscreen UE exceeded 15 minute limit.' }
if ($p.ExitCode -ne 0) { throw "UE exited $($p.ExitCode); inspect $log" }
if (-not (Test-Path -LiteralPath $log)) { throw 'Missing runtime log' }
if (Select-String -LiteralPath $log -Pattern 'Fatal error:|Assertion failed:|LogPython: Error' -Quiet) { throw 'UE reported a runtime error' }
if ($RealtimeProfile) {
    if (-not (Select-String -LiteralPath $log -SimpleMatch '[NeonPerformance] Completed saved=1' -Quiet)) { throw 'No completed performance data' }
    Write-Output "Real-time profile: $OutputDirectory"
    return
}
if (-not (Select-String -LiteralPath $log -SimpleMatch "[NeonOffscreenCapture] Completed frames=$Frames" -Quiet)) { throw 'Incomplete render-target sequence' }
$actual = @(Get-ChildItem -LiteralPath $OutputDirectory -Filter 'frame-*.png')
if ($actual.Count -ne $Frames) { throw 'Render-target file count mismatch' }
if ($FfmpegPath) {
    & $FfmpegPath -hide_banner -loglevel warning -framerate 30 -start_number 0 -i (Join-Path $OutputDirectory 'frame-%05d.png') -frames:v $Frames -c:v libx264 -crf 17 -pix_fmt yuv420p -movflags +faststart (Join-Path $OutputDirectory 'render.mp4')
    if ($LASTEXITCODE -ne 0) { throw 'Video encoding failed; render-target files preserved.' }
}
Write-Output "Engine render-target evidence: $OutputDirectory. Independent visual review required; fixed-step output is not a performance benchmark."
