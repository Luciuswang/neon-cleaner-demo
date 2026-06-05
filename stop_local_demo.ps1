[CmdletBinding()]
param(
    [int]$Port = 5177
)

$ErrorActionPreference = "Stop"

$RepoRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$PidFile = Join-Path (Join-Path $RepoRoot ".local") "server.pid"

function Get-ListeningProcessId {
    param([int]$ListeningPort)

    $matches = cmd.exe /c "netstat -ano -p tcp | findstr LISTENING | findstr :$ListeningPort"
    foreach ($line in $matches) {
        $columns = ($line -split '\s+') | Where-Object { $_ }
        if ($columns.Length -ge 5) {
            return [int]$columns[-1]
        }
    }

    return $null
}

$candidatePids = @()

if (Test-Path $PidFile) {
    $pidFromFile = Get-Content $PidFile -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($pidFromFile) {
        $candidatePids += [int]$pidFromFile
    }
}

$listeningPid = Get-ListeningProcessId -ListeningPort $Port
if ($listeningPid) {
    $candidatePids += [int]$listeningPid
}

$candidatePids = $candidatePids | Select-Object -Unique

if (!$candidatePids) {
    Write-Host "No local demo server found on port $Port."
    exit 0
}

foreach ($candidatePid in $candidatePids) {
    $process = Get-Process -Id $candidatePid -ErrorAction SilentlyContinue
    if ($process) {
        Stop-Process -Id $candidatePid -Force
        Write-Host "Stopped PID $candidatePid."
    }
}

if (Test-Path $PidFile) {
    Remove-Item -LiteralPath $PidFile -Force
}
