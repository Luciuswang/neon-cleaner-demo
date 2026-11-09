[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)][string]$MaxBatchExe,
    [Parameter(Mandatory = $true)][string]$BodyFbx,
    [Parameter(Mandatory = $true)][string]$JacketFbx,
    [Parameter(Mandatory = $true)][string]$OutputDir
)
$ErrorActionPreference = 'Stop'
function Resolve-InputFile([string]$Path, [string]$Extension) {
    if (-not [IO.Path]::IsPathRooted($Path)) { throw "Absolute input path required: $Path" }
    $item = Get-Item -LiteralPath $Path
    if ($item.PSIsContainer -or $item.Length -le 0 -or $item.Extension -ine $Extension) {
        throw "Expected a nonempty $Extension file: $Path"
    }
    return $item.FullName
}
$max = Resolve-InputFile $MaxBatchExe '.exe'
$body = Resolve-InputFile $BodyFbx '.fbx'
$jacket = Resolve-InputFile $JacketFbx '.fbx'
if ($body -ieq $jacket) { throw 'Body and jacket inputs must differ.' }
if (-not [IO.Path]::IsPathRooted($OutputDir)) { throw 'OutputDir must be absolute.' }
$destination = [IO.Path]::GetFullPath($OutputDir)
if (Test-Path -LiteralPath $destination) { throw 'OutputDir already exists; choose a new scratch directory.' }
$parent = Split-Path -Parent $destination
if (-not (Test-Path -LiteralPath $parent -PathType Container)) { throw 'OutputDir parent must already exist.' }
$script = Join-Path $PSScriptRoot 'fit_metahuman_jacket.ms'
if (-not (Test-Path -LiteralPath $script -PathType Leaf)) { throw 'Fitting script is missing.' }
# Unique sibling logs keep outputDir absent until the Max script claims it.
$logPrefix = $destination + '.' + [guid]::NewGuid().ToString('N')
# mxsString values are parsed as MAXScript strings; forward slashes prevent
# Windows sequences such as \n and \t from becoming escaped characters.
$batchArgs = @($script, '-dm', 'on',
    '-mxsString', ('bodyFbx:' + $body.Replace('\', '/')),
    '-mxsString', ('jacketFbx:' + $jacket.Replace('\', '/')),
    '-mxsString', ('outputDir:' + $destination.Replace('\', '/')),
    '-listenerlog', ($logPrefix + '.listener.log'),
    '-log', ($logPrefix + '.system.log'))
& $max @batchArgs
if ($LASTEXITCODE -ne 0) { throw "3ds Max batch failed ($LASTEXITCODE). Logs: $logPrefix" }
$reportPath = Join-Path $destination 'jacket-fit-experimental-report.txt'
if (-not (Test-Path -LiteralPath $reportPath -PathType Leaf)) { throw "Missing report. Logs: $logPrefix" }
if (-not (Select-String -LiteralPath $reportPath -Pattern '^FIT_EXPORT_DONE$' -Quiet)) {
    throw "Experiment incomplete; inspect $reportPath. Preserved outputs remain experimental."
}
Write-Output "Experimental export only; independent visual/deformation review still required: $destination"
