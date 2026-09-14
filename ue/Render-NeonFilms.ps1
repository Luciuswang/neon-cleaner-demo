param(
    [ValidateSet('Intro', 'Clean', 'Damaged', 'Lost')]
    [string[]]$Films = @('Intro', 'Clean', 'Damaged', 'Lost'),
    [string]$FFmpeg = "",
    [switch]$EncodeOnly
)

$ErrorActionPreference = "Stop"
$repo = Split-Path -Parent $PSScriptRoot
if (-not $FFmpeg) {
    $bundled = Get-ChildItem -Path (Join-Path $repo '.local\python-deps\imageio_ffmpeg\binaries\ffmpeg*.exe') -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($bundled) { $FFmpeg = $bundled.FullName }
    else {
        $command = Get-Command ffmpeg -ErrorAction SilentlyContinue
        if ($command) { $FFmpeg = $command.Source }
    }
}
if (-not $FFmpeg -or -not (Test-Path -LiteralPath $FFmpeg)) {
    throw 'Provide -FFmpeg <ffmpeg.exe> or install imageio-ffmpeg into .local/python-deps.'
}
$movies = Join-Path $PSScriptRoot 'NeonCleanerUE\Content\Movies'
New-Item -ItemType Directory -Force -Path $movies | Out-Null
foreach ($film in $Films) {
    if (-not $EncodeOnly) {
        & (Join-Path $PSScriptRoot 'Invoke-NeonUE.ps1') -LogName "film-record-$film" `
            -GameArguments @("-NeonRecordFilm=$film", '-usefixedtimestep', '-fps=24') -TimeoutSeconds 600
        $log = Join-Path $PSScriptRoot "NeonCleanerUE\Saved\Quality\film-record-$film.log"
        if (-not (Select-String -LiteralPath $log -Pattern "\[NeonFilmRecord\] Completed film=$film frames=120" -Quiet)) {
            throw "Film recording did not complete: $film"
        }
    }
    $frames = Join-Path $PSScriptRoot "NeonCleanerUE\Saved\FilmFrames\$film"
    foreach ($index in 0..119) {
        if (-not (Test-Path -LiteralPath (Join-Path $frames ('frame_{0:D5}.png' -f $index)))) {
            throw "Missing $film frame $index"
        }
    }
    $output = Join-Path $movies "NeonCleaner_$film.mp4"
    & $FFmpeg -hide_banner -loglevel error -y -framerate 24 -i (Join-Path $frames 'frame_%05d.png') `
        -f lavfi -i 'anoisesrc=color=brown:amplitude=0.035:sample_rate=48000' `
        -f lavfi -i 'sine=frequency=72:sample_rate=48000' `
        -filter_complex '[2:a]volume=0.13[engine];[1:a][engine]amix=inputs=2:duration=shortest,afade=t=in:d=0.25,afade=t=out:st=4.6:d=0.4[a]' `
        -map '0:v' -map '[a]' -t 5 -c:v libx264 -preset medium -crf 19 -pix_fmt yuv420p `
        -c:a aac -b:a 128k -movflags +faststart $output
    if ($LASTEXITCODE -ne 0) { throw "FFmpeg failed for $film" }
    Write-Host "Rendered $output"
}
