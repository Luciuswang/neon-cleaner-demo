[CmdletBinding()]
param(
    [int]$Port = 5177,
    [switch]$NoBrowser
)

$ErrorActionPreference = "Stop"

$RepoRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$WebRoot = Join-Path $RepoRoot "web"
$LocalRoot = Join-Path $RepoRoot ".local"
$PidFile = Join-Path $LocalRoot "server.pid"

if (!(Test-Path $WebRoot)) {
    throw "Web directory not found: $WebRoot"
}

if (!(Test-Path $LocalRoot)) {
    New-Item -ItemType Directory -Path $LocalRoot | Out-Null
}

function Get-PythonCommand {
    $python = Get-Command python -ErrorAction SilentlyContinue
    if ($python) {
        return $python.Source
    }

    $py = Get-Command py -ErrorAction SilentlyContinue
    if ($py) {
        return $py.Source
    }

    throw "Python was not found on PATH."
}

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

$existingPid = Get-ListeningProcessId -ListeningPort $Port
if ($existingPid) {
    Write-Host "Server already listening on http://127.0.0.1:$Port/ (PID: $existingPid)"
    if (!$NoBrowser) {
        Start-Process "http://127.0.0.1:$Port/" | Out-Null
    }
    exit 0
}

$pythonExe = Get-PythonCommand
$bootstrap = "Set-Location -LiteralPath '$($WebRoot.Replace("'", "''"))'; & '$($pythonExe.Replace("'", "''"))' -m http.server $Port"
$launcher = Start-Process `
    -FilePath powershell.exe `
    -ArgumentList "-NoLogo", "-NoProfile", "-WindowStyle", "Hidden", "-Command", $bootstrap `
    -PassThru

$ready = $false
$serverPid = $null
for ($i = 0; $i -lt 10; $i++) {
    Start-Sleep -Milliseconds 500
    try {
        $response = Invoke-WebRequest -UseBasicParsing "http://127.0.0.1:$Port/" -TimeoutSec 2
        if ($response.StatusCode -eq 200) {
            $ready = $true
            $serverPid = Get-ListeningProcessId -ListeningPort $Port
            break
        }
    } catch {
    }
}

if (!$ready) {
    throw "Server launch was attempted, but http://127.0.0.1:$Port/ did not become ready."
}

if ($serverPid) {
    $serverPid | Set-Content -Path $PidFile -Encoding ascii
} elseif ($launcher) {
    $launcher.Id | Set-Content -Path $PidFile -Encoding ascii
    $serverPid = $launcher.Id
}

Write-Host "Local demo is running at http://127.0.0.1:$Port/ (PID: $serverPid)"

if (!$NoBrowser) {
    Start-Process "http://127.0.0.1:$Port/" | Out-Null
}
