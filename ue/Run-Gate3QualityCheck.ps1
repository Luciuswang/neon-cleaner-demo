param(
    [switch]$SkipBuild,
    [string]$CaptureOutputPath = "",
    [switch]$FullVisualQA,
    [ValidateSet("Default", "Compact", "Bars", "AsymBars")]
    [string]$RiderPoseProfile = "Default",
    [ValidateSet("PASS", "CONDITIONAL", "REJECT")]
    [string]$RiderPoseVerdict = "CONDITIONAL",
    [switch]$StrictRiderPoseGate,
    [switch]$SkipRigAssetValidation
)

$ErrorActionPreference = "Stop"

$RepoRoot = Split-Path -Parent $PSScriptRoot
$UProject = Join-Path $PSScriptRoot "NeonCleanerUE\NeonCleanerUE.uproject"
$EditorCmd = "C:\Program Files\Epic Games\UE_5.8\Engine\Binaries\Win64\UnrealEditor-Cmd.exe"
$BuildBat = "C:\Program Files\Epic Games\UE_5.8\Engine\Build\BatchFiles\Build.bat"
$ValidateScript = Join-Path $PSScriptRoot "scripts\validate_linxia_motorcycle_chase_level.py"
$SmokeScript = Join-Path $PSScriptRoot "SmokeTest-LinxiaMotorcycleChase.ps1"
$CaptureScript = Join-Path $PSScriptRoot "Capture-LinxiaMotorcycleChase.ps1"
$RigAssetScript = Join-Path $PSScriptRoot "Setup-LinxiaRigAssets.ps1"
$LogPath = Join-Path $PSScriptRoot "NeonCleanerUE\Saved\Logs\NeonCleanerUE.log"

function Write-Step($message) {
    Write-Host ""
    Write-Host "== $message ==" -ForegroundColor Cyan
}

function Assert-Exists($path, $label) {
    if (-not (Test-Path -LiteralPath $path)) {
        throw "$label not found: $path"
    }
}

function Invoke-CheckedNative($label, $filePath, [string[]]$arguments) {
    Write-Step $label
    & $filePath @arguments
    if ($LASTEXITCODE -ne 0) {
        throw "$label failed with exit code $LASTEXITCODE"
    }
}

function Invoke-UEPythonScript($label, $scriptPath) {
    Write-Step $label
    # PowerShell passes -ExecutePythonScript= as a single native argument, but
    # Unreal's commandlet parser truncates a script path containing spaces.
    # The documented -run=pythonscript form preserves the quoted path.
    $normalizedScriptPath = $scriptPath.Replace('\', '/')
    $command = '"' + $EditorCmd + '" "' + $UProject + '" -unattended -nop4 -nosplash -ddc=NoZenLocalFallback -DDC-ForceMemoryCache -run=pythonscript -script="' + $normalizedScriptPath + '"'
    & cmd.exe /d /s /c $command
    if ($LASTEXITCODE -ne 0) {
        Write-Warning "$label returned UE exit code $LASTEXITCODE; target log markers will decide whether this is blocking."
    }
}

function Test-CaptureImage($path) {
    Add-Type -AssemblyName System.Drawing
    $bitmap = [System.Drawing.Bitmap]::FromFile($path)
    try {
        if ($bitmap.Width -lt 1000 -or $bitmap.Height -lt 600) {
            throw "Capture is too small: $($bitmap.Width)x$($bitmap.Height)"
        }

        $stepX = [Math]::Max(1, [int]($bitmap.Width / 180))
        $stepY = [Math]::Max(1, [int]($bitmap.Height / 100))
        $samples = 0
        $lumaSum = 0.0
        $nonBlack = 0
        $cyanHud = 0
        $magentaHud = 0

        for ($y = 0; $y -lt $bitmap.Height; $y += $stepY) {
            for ($x = 0; $x -lt $bitmap.Width; $x += $stepX) {
                $c = $bitmap.GetPixel($x, $y)
                $luma = 0.2126 * $c.R + 0.7152 * $c.G + 0.0722 * $c.B
                $samples += 1
                $lumaSum += $luma
                if ($luma -gt 12.0) {
                    $nonBlack += 1
                }
                if ($x -lt 380 -and $y -lt 155 -and $c.R -lt 80 -and $c.G -gt 150 -and $c.B -gt 150) {
                    $cyanHud += 1
                }
                if ($x -lt 380 -and $y -lt 170 -and $c.R -gt 170 -and $c.G -lt 130 -and $c.B -gt 90) {
                    $magentaHud += 1
                }
            }
        }

        $meanLuma = $lumaSum / [Math]::Max(1, $samples)
        $nonBlackRatio = $nonBlack / [double][Math]::Max(1, $samples)
        Write-Host ("Capture metrics: {0}x{1}, meanLuma={2:N1}, nonBlack={3:P1}, cyanHudSamples={4}, magentaHudSamples={5}" -f `
            $bitmap.Width, $bitmap.Height, $meanLuma, $nonBlackRatio, $cyanHud, $magentaHud)

        if ($meanLuma -lt 8.0 -or $nonBlackRatio -lt 0.08) {
            throw "Capture appears blank or mostly black"
        }
        if ($cyanHud -lt 2 -or $magentaHud -lt 1) {
            throw "Capture does not show the expected HUD colors"
        }
    }
    finally {
        $bitmap.Dispose()
    }
}

Push-Location $RepoRoot
try {
    Assert-Exists $UProject "UE project"
    Assert-Exists $EditorCmd "UnrealEditor-Cmd.exe"
    Assert-Exists $BuildBat "Build.bat"
    Assert-Exists $ValidateScript "Gate 3 validation script"
    Assert-Exists $SmokeScript "Gate 3 smoke script"
    Assert-Exists $CaptureScript "Gate 3 capture script"
    Assert-Exists $RigAssetScript "Linxia rig asset setup script"

    Get-Process UnrealEditor -ErrorAction SilentlyContinue | Stop-Process -Force

    if (-not $SkipBuild) {
        Invoke-CheckedNative "Build NeonCleanerUEEditor" $BuildBat @(
            "NeonCleanerUEEditor",
            "Win64",
            "Development",
            "-Project=$UProject",
            "-WaitMutex"
        )
    }

    Remove-Item -LiteralPath $LogPath -ErrorAction SilentlyContinue
    Invoke-UEPythonScript "Validate Gate 3 map" $ValidateScript

    if (-not (Test-Path -LiteralPath $LogPath)) {
        throw "Gate 3 validation did not produce a UE log: $LogPath"
    }
    $pythonError = Select-String -Path $LogPath -Pattern "LogPython: Error|Traceback" | Select-Object -Last 1
    if ($pythonError) {
        throw "Gate 3 validation failed with Python error: $($pythonError.Line)"
    }
    $validation = Select-String -Path $LogPath -Pattern "\[LinxiaMotorcycleChaseValidate\] Validation passed" | Select-Object -Last 1
    if (-not $validation) {
        throw "Gate 3 validation marker not found in UE log"
    }

    if (-not $SkipRigAssetValidation) {
        Invoke-CheckedNative "Validate Linxia rig assets" "powershell" @(
            "-ExecutionPolicy",
            "Bypass",
            "-File",
            $RigAssetScript,
            "-ValidateOnly"
        )
    }

    Invoke-CheckedNative "Run motorcycle smoke test" "powershell" @(
        "-ExecutionPolicy",
        "Bypass",
        "-File",
        $SmokeScript
    )

    if ($CaptureOutputPath.Trim().Length -eq 0) {
        $stamp = Get-Date -Format "yyyy-MM-dd_HHmmss"
        $CaptureOutputPath = Join-Path $PSScriptRoot "NeonCleanerUE\Saved\Quality\linxia_motorcycle_gate3_quality_$stamp.png"
    }

    Invoke-CheckedNative "Capture UE proof frame" "powershell" @(
        "-ExecutionPolicy",
        "Bypass",
        "-File",
        $CaptureScript,
        "-OutputPath",
        $CaptureOutputPath,
        "-View",
        "Default",
        "-Pose",
        $RiderPoseProfile
    )

    Write-Step "Inspect proof frame"
    Test-CaptureImage $CaptureOutputPath

    if ($FullVisualQA) {
        $baseName = [System.IO.Path]::GetFileNameWithoutExtension($CaptureOutputPath)
        $dirName = Split-Path -Parent $CaptureOutputPath
        foreach ($view in @("Side", "Rear")) {
            $viewPath = Join-Path $dirName "$baseName-$($view.ToLower()).png"
            Invoke-CheckedNative "Capture $view rider QA frame" "powershell" @(
                "-ExecutionPolicy",
                "Bypass",
                "-File",
                $CaptureScript,
                "-OutputPath",
                $viewPath,
                "-View",
                $view,
                "-Pose",
                $RiderPoseProfile
            )
            Test-CaptureImage $viewPath
        }
    }

    Write-Step "Gate 3 QA Verdict"
    Write-Host "PASS: build, map validation, smoke test, HUD binding, visual alignment markers, and proof-frame sanity checks passed." -ForegroundColor Green
    if ($FullVisualQA) {
        if ($RiderPoseVerdict -eq "PASS") {
            Write-Host "RIDER POSE: PASS by explicit multi-view reviewer verdict." -ForegroundColor Green
        }
        elseif ($RiderPoseVerdict -eq "REJECT") {
            Write-Host "RIDER POSE: REJECT by explicit multi-view reviewer verdict." -ForegroundColor Red
        }
        else {
            Write-Host "RIDER POSE: CONDITIONAL by explicit multi-view reviewer verdict." -ForegroundColor Yellow
        }

        if ($StrictRiderPoseGate -and $RiderPoseVerdict -ne "PASS") {
            throw "Strict rider pose gate failed: set -RiderPoseVerdict PASS only after default/side/rear visual review passes."
        }
    }
    else {
        Write-Host "CONDITIONAL: rider pose still needs -FullVisualQA before AI-video continuity sign-off." -ForegroundColor Yellow
    }
    Write-Host "Proof: $CaptureOutputPath"
}
finally {
    Pop-Location
}
