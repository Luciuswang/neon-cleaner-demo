$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$repo = Split-Path -Parent $root
$project = Join-Path $root "NeonCleanerUE\NeonCleanerUE.uproject"
$editor = "C:\Program Files\Epic Games\UE_5.8\Engine\Binaries\Win64\UnrealEditor.exe"
$outDir = Join-Path $repo "source\reference\linxia\ue-captures"
$outFile = Join-Path $outDir "linxia_rider_proxy_handoff_2026-08-24.png"

if (-not (Test-Path -LiteralPath $editor)) {
  throw "UnrealEditor.exe was not found: $editor"
}
if (-not (Test-Path -LiteralPath $project)) {
  throw "UE project was not found: $project"
}

New-Item -ItemType Directory -Force -Path $outDir | Out-Null

$args = @(
  $project,
  "/Game/LinxiaRiderProxy/LVL_Linxia_RiderProxy",
  "-windowed",
  "-ResX=1280",
  "-ResY=720",
  "-nop4",
  "-nosplash"
)

$process = Start-Process -FilePath $editor -ArgumentList $args -PassThru
try {
  $deadline = (Get-Date).AddSeconds(60)
  do {
    Start-Sleep -Milliseconds 500
    $process.Refresh()
  } while ($process.MainWindowHandle -eq 0 -and (Get-Date) -lt $deadline)

  if ($process.MainWindowHandle -eq 0) {
    throw "UnrealEditor window did not appear before timeout."
  }

  Start-Sleep -Seconds 12

  Get-Process PickerHost -ErrorAction SilentlyContinue |
    Stop-Process -Force -ErrorAction SilentlyContinue
  Start-Sleep -Seconds 2

  Add-Type -AssemblyName System.Drawing
  Add-Type -AssemblyName System.Windows.Forms

  if (-not ("Win32WindowTools" -as [type])) {
    Add-Type @'
using System;
using System.Runtime.InteropServices;
public class Win32WindowTools {
  [StructLayout(LayoutKind.Sequential)]
  public struct RECT {
    public int Left;
    public int Top;
    public int Right;
    public int Bottom;
  }

  [DllImport("user32.dll")]
  public static extern bool GetWindowRect(IntPtr hWnd, out RECT rect);

  [DllImport("user32.dll")]
  public static extern bool SetForegroundWindow(IntPtr hWnd);

  [DllImport("user32.dll")]
  public static extern bool ShowWindowAsync(IntPtr hWnd, int nCmdShow);
}
'@
  }

  $window = Get-Process UnrealEditor -ErrorAction SilentlyContinue |
    Where-Object { $_.MainWindowHandle -ne 0 -and $_.MainWindowTitle -like "*NeonCleanerUE*" } |
    Sort-Object StartTime -Descending |
    Select-Object -First 1
  if ($null -eq $window) {
    $window = $process
  }

  [Win32WindowTools]::ShowWindowAsync($window.MainWindowHandle, 9) | Out-Null
  [Win32WindowTools]::SetForegroundWindow($window.MainWindowHandle) | Out-Null
  Start-Sleep -Seconds 2

  $rect = New-Object Win32WindowTools+RECT
  [Win32WindowTools]::GetWindowRect($window.MainWindowHandle, [ref]$rect) | Out-Null
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
