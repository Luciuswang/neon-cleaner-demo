[CmdletBinding()]
param(
    [Parameter()]
    [string]$ProjectPath,

    [Parameter()]
    [switch]$ValidateOnly
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

if ([string]::IsNullOrWhiteSpace($ProjectPath)) {
    $ProjectPath = Join-Path $PSScriptRoot 'NeonCleanerUE\NeonCleanerUE.uproject'
}

function Get-FullPath {
    param(
        [Parameter(Mandatory)]
        [string]$Path
    )

    $expandedPath = [Environment]::ExpandEnvironmentVariables($Path.Trim().Trim('"'))
    return [IO.Path]::GetFullPath($expandedPath)
}

function Get-ComparablePath {
    param(
        [Parameter(Mandatory)]
        [string]$Path
    )

    try {
        return (Get-FullPath $Path).TrimEnd([char[]]'\/').Replace('\', '/').ToLowerInvariant()
    }
    catch {
        return $null
    }
}

function Read-TextFile {
    param(
        [Parameter(Mandatory)]
        [string]$Path
    )

    [byte[]]$bytes = [IO.File]::ReadAllBytes($Path)
    [Text.Encoding]$encoding = [Text.UTF8Encoding]::new($false, $true)
    [byte[]]$preamble = @()
    $offset = 0

    if ($bytes.Length -ge 4 -and $bytes[0] -eq 0xFF -and $bytes[1] -eq 0xFE -and $bytes[2] -eq 0x00 -and $bytes[3] -eq 0x00) {
        $encoding = [Text.UTF32Encoding]::new($false, $true, $true)
        [byte[]]$preamble = @(0xFF, 0xFE, 0x00, 0x00)
        $offset = 4
    }
    elseif ($bytes.Length -ge 4 -and $bytes[0] -eq 0x00 -and $bytes[1] -eq 0x00 -and $bytes[2] -eq 0xFE -and $bytes[3] -eq 0xFF) {
        $encoding = [Text.UTF32Encoding]::new($true, $true, $true)
        [byte[]]$preamble = @(0x00, 0x00, 0xFE, 0xFF)
        $offset = 4
    }
    elseif ($bytes.Length -ge 3 -and $bytes[0] -eq 0xEF -and $bytes[1] -eq 0xBB -and $bytes[2] -eq 0xBF) {
        $encoding = [Text.UTF8Encoding]::new($true, $true)
        [byte[]]$preamble = @(0xEF, 0xBB, 0xBF)
        $offset = 3
    }
    elseif ($bytes.Length -ge 2 -and $bytes[0] -eq 0xFF -and $bytes[1] -eq 0xFE) {
        $encoding = [Text.UnicodeEncoding]::new($false, $true, $true)
        [byte[]]$preamble = @(0xFF, 0xFE)
        $offset = 2
    }
    elseif ($bytes.Length -ge 2 -and $bytes[0] -eq 0xFE -and $bytes[1] -eq 0xFF) {
        $encoding = [Text.UnicodeEncoding]::new($true, $true, $true)
        [byte[]]$preamble = @(0xFE, 0xFF)
        $offset = 2
    }

    $textLength = $bytes.Length - $offset
    try {
        $text = if ($textLength -gt 0) {
            $encoding.GetString($bytes, $offset, $textLength)
        }
        else {
            ''
        }
    }
    catch [Text.DecoderFallbackException] {
        if ($offset -ne 0) {
            throw
        }

        $encoding = [Text.Encoding]::Default
        $text = if ($textLength -gt 0) {
            $encoding.GetString($bytes, 0, $textLength)
        }
        else {
            ''
        }
    }

    return [pscustomobject]@{
        Text     = $text
        Encoding = $encoding
        Preamble = $preamble
    }
}

function Write-TextFileAtomically {
    param(
        [Parameter(Mandatory)]
        [string]$Path,

        [Parameter(Mandatory)]
        [string]$Text,

        [Parameter(Mandatory)]
        [Text.Encoding]$Encoding,

        [Parameter(Mandatory)]
        [AllowEmptyCollection()]
        [byte[]]$Preamble
    )

    [byte[]]$textBytes = $Encoding.GetBytes($Text)
    [byte[]]$outputBytes = New-Object byte[] ($Preamble.Length + $textBytes.Length)

    if ($Preamble.Length -gt 0) {
        [Buffer]::BlockCopy($Preamble, 0, $outputBytes, 0, $Preamble.Length)
    }
    if ($textBytes.Length -gt 0) {
        [Buffer]::BlockCopy($textBytes, 0, $outputBytes, $Preamble.Length, $textBytes.Length)
    }

    $temporaryPath = "$Path.codex-$PID-$([Guid]::NewGuid().ToString('N')).tmp"
    try {
        [IO.File]::WriteAllBytes($temporaryPath, $outputBytes)
        [IO.File]::Replace($temporaryPath, $Path, $null, $true)
    }
    finally {
        if (Test-Path -LiteralPath $temporaryPath) {
            Remove-Item -LiteralPath $temporaryPath -Force
        }
    }
}

function Get-RegistrationState {
    param(
        [Parameter(Mandatory)]
        [string]$ConfigPath,

        [Parameter(Mandatory)]
        [string]$SectionName,

        [Parameter(Mandatory)]
        [string]$ExpectedPath
    )

    $file = Read-TextFile $ConfigPath
    [string[]]$lines = [regex]::Split($file.Text, "`r`n|`n|`r")
    $currentSection = $null
    $sectionFound = $false
    $registeredPaths = [Collections.Generic.List[string]]::new()

    foreach ($line in $lines) {
        $sectionMatch = [regex]::Match($line, '^[ \t]*\[([^\]]+)\][ \t]*$')
        if ($sectionMatch.Success) {
            $currentSection = $sectionMatch.Groups[1].Value.Trim()
            if ($currentSection -ieq $SectionName) {
                $sectionFound = $true
            }
            continue
        }

        if ($null -eq $currentSection -or $currentSection -ine $SectionName) {
            continue
        }

        $pathMatch = [regex]::Match($line, '^[ \t]*CreatedProjectPaths[ \t]*=(.*)$')
        if ($pathMatch.Success) {
            $registeredPaths.Add($pathMatch.Groups[1].Value.Trim().Trim('"'))
        }
    }

    $expectedComparable = Get-ComparablePath $ExpectedPath
    $isRegistered = $false
    foreach ($registeredPath in $registeredPaths) {
        if ((Get-ComparablePath $registeredPath) -eq $expectedComparable) {
            $isRegistered = $true
            break
        }
    }

    return [pscustomobject]@{
        ConfigPath      = $ConfigPath
        SectionName     = $SectionName
        File            = $file
        SectionFound    = $sectionFound
        RegisteredPaths = @($registeredPaths)
        IsRegistered    = $isRegistered
    }
}

function Add-CreatedProjectPathToSection {
    param(
        [Parameter(Mandatory)]
        [string]$Text,

        [Parameter(Mandatory)]
        [string]$SectionName,

        [Parameter(Mandatory)]
        [string]$CreatedProjectPath
    )

    $newLine = if ($Text.Contains("`r`n")) { "`r`n" } else { "`n" }
    $createdProjectLine = 'CreatedProjectPaths=' + $CreatedProjectPath.Replace('\', '/')
    [string[]]$splitLines = [regex]::Split($Text, "`r`n|`n|`r")
    $lines = [Collections.Generic.List[string]]::new()
    foreach ($line in $splitLines) {
        $lines.Add($line)
    }

    $targetSectionIndex = -1
    for ($index = 0; $index -lt $lines.Count; $index++) {
        $sectionMatch = [regex]::Match($lines[$index], '^[ \t]*\[([^\]]+)\][ \t]*$')
        if ($sectionMatch.Success -and $sectionMatch.Groups[1].Value.Trim() -ieq $SectionName) {
            $targetSectionIndex = $index
            break
        }
    }

    if ($targetSectionIndex -ge 0) {
        $insertIndex = $lines.Count
        for ($index = $targetSectionIndex + 1; $index -lt $lines.Count; $index++) {
            if ($lines[$index] -match '^[ \t]*\[[^\]]+\][ \t]*$') {
                $insertIndex = $index
                break
            }
        }

        while ($insertIndex -gt ($targetSectionIndex + 1) -and $lines[$insertIndex - 1].Trim().Length -eq 0) {
            $insertIndex--
        }

        $lines.Insert($insertIndex, $createdProjectLine)
        return [string]::Join($newLine, $lines)
    }

    $result = $Text
    if ($result.Length -gt 0 -and -not ($result.EndsWith("`n") -or $result.EndsWith("`r"))) {
        $result += $newLine
    }
    if ($result.Length -gt 0) {
        $result += $newLine
    }

    return $result + '[' + $SectionName + ']' + $newLine + $createdProjectLine + $newLine
}

function Get-ExistingConfigSources {
    param(
        [Parameter(Mandatory)]
        [string]$Root,

        [Parameter(Mandatory)]
        [string]$FileName,

        [Parameter(Mandatory)]
        [string]$SourceName,

        [Parameter(Mandatory)]
        [string]$SectionName
    )

    foreach ($variant in @('WindowsEditor', 'Windows')) {
        $candidate = Join-Path $Root "$variant\$FileName"
        if (Test-Path -LiteralPath $candidate -PathType Leaf) {
            [pscustomobject]@{
                SourceName  = $SourceName
                Variant     = $variant
                ConfigPath  = $candidate
                SectionName = $SectionName
            }
        }
    }
}

$resolvedProjectPath = Get-FullPath $ProjectPath
if (-not (Test-Path -LiteralPath $resolvedProjectPath -PathType Leaf)) {
    throw "Unreal project was not found: $resolvedProjectPath"
}
if ([IO.Path]::GetExtension($resolvedProjectPath) -ine '.uproject') {
    throw "ProjectPath must point to a .uproject file: $resolvedProjectPath"
}

$projectFile = Read-TextFile $resolvedProjectPath
try {
    $projectJson = $projectFile.Text | ConvertFrom-Json
}
catch {
    throw "Could not parse .uproject JSON '$resolvedProjectPath': $($_.Exception.Message)"
}

$engineAssociationProperty = $projectJson.PSObject.Properties['EngineAssociation']
if ($null -eq $engineAssociationProperty -or [string]::IsNullOrWhiteSpace([string]$engineAssociationProperty.Value)) {
    throw "The .uproject does not define EngineAssociation: $resolvedProjectPath"
}
$engineAssociation = ([string]$engineAssociationProperty.Value).Trim()

$projectDirectory = [IO.Path]::GetDirectoryName($resolvedProjectPath)
$projectContainer = [IO.Directory]::GetParent($projectDirectory)
if ($null -eq $projectContainer) {
    throw "Could not determine the project container for: $resolvedProjectPath"
}
$createdProjectPath = $projectContainer.FullName

if ([string]::IsNullOrWhiteSpace($env:LOCALAPPDATA)) {
    throw 'LOCALAPPDATA is not defined; Epic and Unreal configuration paths cannot be located.'
}

$launcherConfigRoot = Join-Path $env:LOCALAPPDATA 'EpicGamesLauncher\Saved\Config'
$editorConfigRoot = Join-Path $env:LOCALAPPDATA "UnrealEngine\$engineAssociation\Saved\Config"

$launcherSources = @(
    Get-ExistingConfigSources `
        -Root $launcherConfigRoot `
        -FileName 'GameUserSettings.ini' `
        -SourceName 'Epic Games Launcher' `
        -SectionName 'Launcher'
)
$editorSources = @(
    Get-ExistingConfigSources `
        -Root $editorConfigRoot `
        -FileName 'EditorSettings.ini' `
        -SourceName "Unreal Engine $engineAssociation" `
        -SectionName '/Script/UnrealEd.EditorSettings'
)

Write-Host "Unreal project: $resolvedProjectPath"
Write-Host "EngineAssociation: $engineAssociation"
Write-Host "Epic project container: $createdProjectPath"

$missingConfigSource = $false
if ($launcherSources.Count -eq 0) {
    Write-Host "[MISSING] Epic Games Launcher configuration was not found. Checked:"
    Write-Host "  $launcherConfigRoot\WindowsEditor\GameUserSettings.ini"
    Write-Host "  $launcherConfigRoot\Windows\GameUserSettings.ini"
    Write-Host '  Run Epic Games Launcher once, then close it before registration.'
    $missingConfigSource = $true
}
if ($editorSources.Count -eq 0) {
    Write-Host "[MISSING] Unreal Engine $engineAssociation EditorSettings configuration was not found. Checked:"
    Write-Host "  $editorConfigRoot\WindowsEditor\EditorSettings.ini"
    Write-Host "  $editorConfigRoot\Windows\EditorSettings.ini"
    Write-Host "  Open this project once with Unreal Engine $engineAssociation, then close the editor before registration."
    $missingConfigSource = $true
}

$configSources = @($launcherSources) + @($editorSources)
$states = foreach ($source in $configSources) {
    $state = Get-RegistrationState `
        -ConfigPath $source.ConfigPath `
        -SectionName $source.SectionName `
        -ExpectedPath $createdProjectPath

    [pscustomobject]@{
        SourceName      = $source.SourceName
        Variant         = $source.Variant
        ConfigPath      = $source.ConfigPath
        SectionName     = $source.SectionName
        File            = $state.File
        SectionFound    = $state.SectionFound
        RegisteredPaths = $state.RegisteredPaths
        IsRegistered    = $state.IsRegistered
    }
}

if ($ValidateOnly) {
    $allRegistered = -not $missingConfigSource
    foreach ($state in $states) {
        $description = "$($state.SourceName) [$($state.Variant)] $($state.ConfigPath) section [$($state.SectionName)]"
        if ($state.IsRegistered) {
            Write-Host "[REGISTERED] $description"
        }
        elseif (-not $state.SectionFound) {
            Write-Host "[NOT REGISTERED: SECTION MISSING] $description"
            $allRegistered = $false
        }
        else {
            Write-Host "[NOT REGISTERED] $description"
            $allRegistered = $false
        }
    }

    if ($allRegistered -and $states.Count -gt 0) {
        Write-Host 'Validation passed: every existing Launcher and matching Unreal Engine configuration source is registered.'
        exit 0
    }

    Write-Warning 'Validation failed: all real Launcher and matching Unreal Engine configuration sources must be registered in their required sections.'
    exit 1
}

if ($missingConfigSource) {
    throw 'Registration stopped because one or more required configuration sources do not exist.'
}

$runningProcesses = @(
    Get-Process -Name 'EpicGamesLauncher', 'EpicWebHelper', 'UnrealEditor', 'UnrealEditor-Cmd' -ErrorAction SilentlyContinue
)
if ($runningProcesses.Count -gt 0) {
    Write-Host '[PROCESS BLOCKER] Registration did not modify any configuration file.'
    foreach ($process in $runningProcesses | Sort-Object ProcessName, Id) {
        Write-Host "  $($process.ProcessName) (PID $($process.Id))"
    }
    throw 'Close Epic Games Launcher, all EpicWebHelper processes, Unreal Editor, and UnrealEditor-Cmd, then run this script again. The script will not terminate them.'
}

$updatedAnyConfig = $false
foreach ($state in $states) {
    if ($state.IsRegistered) {
        Write-Host "[UNCHANGED] $($state.ConfigPath) section [$($state.SectionName)]"
        continue
    }

    $timestamp = Get-Date -Format 'yyyyMMdd-HHmmssfff'
    $backupPath = "$($state.ConfigPath).bak-$timestamp"
    if (Test-Path -LiteralPath $backupPath) {
        $backupPath += '-' + [Guid]::NewGuid().ToString('N')
    }
    Copy-Item -LiteralPath $state.ConfigPath -Destination $backupPath

    $updatedText = Add-CreatedProjectPathToSection `
        -Text $state.File.Text `
        -SectionName $state.SectionName `
        -CreatedProjectPath $createdProjectPath

    Write-TextFileAtomically `
        -Path $state.ConfigPath `
        -Text $updatedText `
        -Encoding $state.File.Encoding `
        -Preamble $state.File.Preamble

    Write-Host "[UPDATED] $($state.ConfigPath) section [$($state.SectionName)]"
    Write-Host "[BACKUP] $backupPath"
    $updatedAnyConfig = $true
}

if ($updatedAnyConfig) {
    Write-Warning 'Registration updated. Restart Epic Games Launcher and Unreal Editor before checking the project in Fab Library.'
}
else {
    Write-Host 'All required configuration sources are already registered. Restart Epic Games Launcher if the project is not visible yet.'
}
