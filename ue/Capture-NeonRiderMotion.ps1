param(
    [string]$OutputDirectory = "",
    [ValidateSet("Default", "Side", "Rear", "Hands", "HandsRight", "Establishing", "Bridge")]
    [string]$View = "Side",
    [switch]$ContinuousVideo,
    [string]$FfmpegPath = ""
)
$ErrorActionPreference = "Stop"
$editor = "C:\Program Files\Epic Games\UE_5.8\Engine\Binaries\Win64\UnrealEditor.exe"
$project = Join-Path $PSScriptRoot "NeonCleanerUE\NeonCleanerUE.uproject"
if (Get-Process UnrealEditor,UnrealEditor-Cmd -ErrorAction SilentlyContinue) {
    throw "Close the existing UE process before this serial capture."
}
if (-not $OutputDirectory) {
    $OutputDirectory = Join-Path $PSScriptRoot ("NeonCleanerUE\Saved\Quality\rider-motion-" + (Get-Date -Format "yyyyMMdd-HHmmss"))
}
$OutputDirectory = [IO.Path]::GetFullPath($OutputDirectory)
New-Item -ItemType Directory -Path $OutputDirectory -Force | Out-Null
if (Get-ChildItem -LiteralPath $OutputDirectory -Filter '*.png') {
    throw "Use a fresh output directory: existing PNGs could contaminate this capture."
}
$base = Join-Path $OutputDirectory ("rider-" + $View.ToLower() + ".png")
$log = Join-Path $OutputDirectory "runtime.log"
$arguments = @(
    "`"$project`"", "/Game/LinxiaChase/LVL_Linxia_MotorcycleChase", "-game", "-windowed",
    "-ResX=1920", "-ResY=1080", "-nosplash", "-nop4", "-ddc=NoZenLocalFallback", "-DDC-ForceMemoryCache",
    "-LinxiaMotorcycleCapture=`"$base`"", "-LinxiaMotorcycleCaptureView=$View", "-LinxiaRiderMotionCapture",
    "-abslog=`"$log`""
)
if ($ContinuousVideo) { $arguments += "-LinxiaRiderVideo" }
$process = Start-Process -FilePath $editor -ArgumentList $arguments -WindowStyle Hidden -PassThru
$timer = [Diagnostics.Stopwatch]::StartNew()
while (-not $process.WaitForExit(1000)) {
    if ($timer.Elapsed.TotalSeconds -gt 240) {
        Stop-Process -Id $process.Id -Force
        throw "Rider motion capture timed out after 240 seconds."
    }
}
if ($process.ExitCode -ne 0) { throw "UE capture exited $($process.ExitCode)." }
$lines = @(Select-String -LiteralPath $log -Pattern '\[NeonRiderMotion\] t=' | ForEach-Object { $_.Line })
$samples = @($lines | ForEach-Object {
    if ($_ -match 't=([\d.]+) input=([-\d.]+) steer=([-\d.]+) lateral=([-\d.]+) yaw=([-\d.]+) lean=([-\d.]+) palmProxyErrorL=([\d.]+) palmProxyErrorR=([\d.]+)') {
        [pscustomobject]@{ time=[double]$Matches[1]; input=[double]$Matches[2]; steer=[double]$Matches[3]; lateral=[double]$Matches[4]; yaw=[double]$Matches[5]; lean=[double]$Matches[6]; palmProxyL=[double]$Matches[7]; palmProxyR=[double]$Matches[8] }
    }
})
$framePattern = if ($ContinuousVideo) { 'video-*.png' } else { '*-motion-*.png' }
$frames = @(Get-ChildItem -LiteralPath $OutputDirectory -Filter $framePattern)
$expectedFrames = if ($ContinuousVideo) { 360 } else { 9 }
$videoTimes = @()
$continuousTimingValid = $true
$encodedVideo = $null
if ($ContinuousVideo) {
    $videoTimes = @(Select-String -LiteralPath $log -Pattern '\[NeonRiderVideo\] frame=' | ForEach-Object {
        if ($_.Line -match 'frame=(\d+) t=([\d.]+)') { [pscustomobject]@{ frame=[int]$Matches[1]; time=[double]$Matches[2] } }
    })
    $continuousTimingValid = $videoTimes.Count -eq 360
    for ($i = 0; $i -lt $videoTimes.Count; $i++) {
        if ($videoTimes[$i].frame -ne $i -or -not (Test-Path -LiteralPath (Join-Path $OutputDirectory ('video-{0:D5}.png' -f $i)))) {
            $continuousTimingValid = $false
        }
        if ($i -gt 0 -and [Math]::Abs(($videoTimes[$i].time - $videoTimes[$i-1].time) - (1.0/30)) -gt 0.003) {
            $continuousTimingValid = $false
        }
    }
    if (-not $FfmpegPath) {
        $foundFfmpeg = Get-Command ffmpeg -ErrorAction SilentlyContinue
        if ($foundFfmpeg) { $FfmpegPath = $foundFfmpeg.Source }
    }
    if (-not $FfmpegPath) {
        $candidates = @(
            (Join-Path $env:USERPROFILE '.cache\codex-runtimes\codex-primary-runtime\dependencies\bin\fallback\ffmpeg.exe'),
            (Join-Path $env:USERPROFILE '.cache\codex-runtimes\codex-primary-runtime\dependencies\bin\override\ffmpeg.exe'),
            (Join-Path (Split-Path -Parent $PSScriptRoot) '.local\tools\ffmpeg.exe')
        )
        $FfmpegPath = $candidates | Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1
    }
    if ($FfmpegPath -and $continuousTimingValid -and $frames.Count -eq 360) {
        $encodedVideo = Join-Path $OutputDirectory ('rider-' + $View.ToLower() + '-30fps.mp4')
        & $FfmpegPath -hide_banner -loglevel warning -y -framerate 30 -start_number 0 -i (Join-Path $OutputDirectory 'video-%05d.png') -frames:v 360 -c:v libx264 -crf 17 -pix_fmt yuv420p -movflags +faststart $encodedVideo
        if ($LASTEXITCODE -ne 0 -or -not (Test-Path -LiteralPath $encodedVideo)) { throw "ffmpeg encoding failed; source PNGs retained." }
    }
    elseif (-not $FfmpegPath) {
        Write-Warning "ffmpeg was not found. The complete PNG sequence is retained; supply -FfmpegPath to encode on a new capture."
    }
}
$duration = if ($samples.Count -gt 1) { $samples[-1].time - $samples[0].time } else { 0 }
$left = @($samples | Where-Object { $_.steer -lt -0.25 -and $_.yaw -lt -1 }).Count
$right = @($samples | Where-Object { $_.steer -gt 0.25 -and $_.yaw -gt 1 }).Count
$maxPalmProxyError = ($samples | ForEach-Object { $_.palmProxyL; $_.palmProxyR } | Measure-Object -Maximum).Maximum
$engineeringPass = $duration -ge 10 -and $frames.Count -eq $expectedFrames -and $continuousTimingValid -and $left -gt 0 -and $right -gt 0 -and $maxPalmProxyError -le 3
$report = [ordered]@{
    engineeringVerdict = $(if ($engineeringPass) { "PASS" } else { "FAIL" })
    visualVerdict = "UNREVIEWED"
    videoContinuityVerdict = "BLOCKED_PENDING_VISUAL_AND_TEMPORAL_REVIEW"
    note = "Palm error is a bone-derived proxy, not mesh-surface collision. Imported motorcycle is a single mesh; fork/wheels remain unarticulated. Isolated movement capture does not certify encounter collisions. Fixed-step video is temporal evidence, never a runtime FPS benchmark."
    continuousVideoRequested = [bool]$ContinuousVideo
    continuousFrameTimingValid = $continuousTimingValid
    videoPath = $encodedVideo
    capturedVideoSeconds = $(if ($ContinuousVideo) { $frames.Count / 30.0 } else { 0 })
    sampleSpanSeconds = $duration
    frameCount = $frames.Count
    leftSamples = $left
    rightSamples = $right
    maxPalmProxyErrorCm = $maxPalmProxyError
    samples = $samples
}
$report | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath (Join-Path $OutputDirectory 'motion-report.json') -Encoding UTF8
if (-not $engineeringPass) { throw "Motion engineering check failed. Inspect $OutputDirectory" }
Write-Output "Engineering evidence created: $OutputDirectory. Visual QA remains required; fixed-step capture is not a performance benchmark."
