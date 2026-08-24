$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$repo = Split-Path -Parent $root
$project = Join-Path $root "NeonCleanerUE\NeonCleanerUE.uproject"
$editor = "C:\Program Files\Epic Games\UE_5.8\Engine\Binaries\Win64\UnrealEditor.exe"
$outDir = Join-Path $repo "source\reference\linxia\ue-captures"
$outFile = Join-Path $outDir "linxia_phase_preview_2026-08-24.png"

if (-not (Test-Path -LiteralPath $editor)) {
  throw "UnrealEditor.exe was not found: $editor"
}
if (-not (Test-Path -LiteralPath $project)) {
  throw "UE project was not found: $project"
}

New-Item -ItemType Directory -Force -Path $outDir | Out-Null

$args = @(
  $project,
  "/Game/LinxiaPreview/LVL_Linxia_CharacterPreview",
  "-game",
  "-windowed",
  "-ResX=1280",
  "-ResY=720",
  "-nop4",
  "-nosplash",
  "-LinxiaReferencePose"
)

$process = Start-Process -FilePath $editor -ArgumentList $args -PassThru
try {
  $deadline = (Get-Date).AddSeconds(40)
  do {
    Start-Sleep -Milliseconds 500
    $process.Refresh()
  } while ($process.MainWindowHandle -eq 0 -and (Get-Date) -lt $deadline)

  if ($process.MainWindowHandle -eq 0) {
    throw "UnrealEditor window did not appear before timeout."
  }

  Start-Sleep -Seconds 5

  # The first UE launch can trigger a Windows firewall prompt. Close it so the
  # reference capture is the game window, not the prompt.
  Get-Process PickerHost -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
  Start-Sleep -Seconds 2

  Add-Type -AssemblyName System.Drawing
  Add-Type -AssemblyName System.Windows.Forms

  if (-not ("Win32Rect" -as [type])) {
    Add-Type @'
using System;
using System.Runtime.InteropServices;
public class Win32Rect {
  [StructLayout(LayoutKind.Sequential)]
  public struct RECT {
    public int Left;
    public int Top;
    public int Right;
    public int Bottom;
  }

  [DllImport("user32.dll")]
  public static extern bool GetWindowRect(IntPtr hWnd, out RECT rect);
}
'@
  }

  $rect = New-Object Win32Rect+RECT
  [Win32Rect]::GetWindowRect($process.MainWindowHandle, [ref]$rect) | Out-Null
  $width = [Math]::Max(1, $rect.Right - $rect.Left)
  $height = [Math]::Max(1, $rect.Bottom - $rect.Top)
  $bitmap = New-Object System.Drawing.Bitmap $width, $height
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  $graphics.CopyFromScreen($rect.Left, $rect.Top, 0, 0, $bitmap.Size)
  $bitmap.Save($outFile, [System.Drawing.Imaging.ImageFormat]::Png)
  $graphics.Dispose()
  $bitmap.Dispose()

  Write-Output $outFile
}
finally {
  if ($process -and -not $process.HasExited) {
    Stop-Process -Id $process.Id -Force
  }
}
