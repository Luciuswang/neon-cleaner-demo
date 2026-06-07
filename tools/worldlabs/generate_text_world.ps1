[CmdletBinding()]
param(
    [string]$DisplayName = "Neon Cleaner A0 War Signal",
    [string]$Model = "marble-1.1",
    [string]$OutputDir = "web\worlds",
    [string]$PromptFile = "docs\video\A0-war-signal-prompt-package.md"
)

$ErrorActionPreference = "Stop"

$RepoRoot = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$RepoRoot = Split-Path -Parent $RepoRoot
$OutputPath = Join-Path $RepoRoot $OutputDir
$PromptPath = Join-Path $RepoRoot $PromptFile

if (!(Test-Path $PromptPath)) {
    throw "Prompt file not found: $PromptPath"
}

if (!(Test-Path $OutputPath)) {
    New-Item -ItemType Directory -Path $OutputPath | Out-Null
}

function Get-WorldLabsApiKey {
    $names = @("WORLDLABS_API_KEY", "WLT_API_KEY")
    $targets = @("Process", "User", "Machine")

    foreach ($name in $names) {
        foreach ($target in $targets) {
            $value = [Environment]::GetEnvironmentVariable($name, $target)
            if ($value) {
                return $value
            }
        }
    }

    return $null
}

$apiKey = Get-WorldLabsApiKey

if (!$apiKey) {
    throw "Missing API key. Set WORLDLABS_API_KEY or WLT_API_KEY before running this script."
}

$promptText = Get-Content -Path $PromptPath -Encoding UTF8 -Raw
$body = @{
    display_name = $DisplayName
    model = $Model
    tags = @("neon-cleaner", "a0", "war-signal")
    world_prompt = @{
        type = "text"
        text_prompt = $promptText
        disable_recaption = $false
    }
} | ConvertTo-Json -Depth 12

$headers = @{
    "Content-Type" = "application/json"
    "WLT-Api-Key" = $apiKey
}

Write-Host "Starting World Labs generation: $DisplayName"
$operation = Invoke-RestMethod `
    -Method Post `
    -Uri "https://api.worldlabs.ai/marble/v1/worlds:generate" `
    -Headers $headers `
    -Body $body

if (!$operation.operation_id) {
    throw "World generation did not return an operation_id."
}

Write-Host "Operation: $($operation.operation_id)"

$completed = $null
for ($i = 0; $i -lt 90; $i++) {
    Start-Sleep -Seconds 5
    $completed = Invoke-RestMethod `
        -Method Get `
        -Uri "https://api.worldlabs.ai/marble/v1/operations/$($operation.operation_id)" `
        -Headers @{ "WLT-Api-Key" = $apiKey }

    $progress = $completed.metadata.progress
    if ($progress) {
        Write-Host "Progress: $progress"
    } else {
        Write-Host "Polling operation..."
    }

    if ($completed.done) {
        break
    }
}

if (!$completed.done) {
    throw "World generation did not complete within the polling window."
}

if ($completed.error) {
    throw "World generation failed: $($completed.error.message)"
}

$world = $completed.response.world
if (!$world) {
    $world = $completed.response
}

$worldJsonPath = Join-Path $OutputPath "a0-war-signal-world.json"
$world | ConvertTo-Json -Depth 24 | Set-Content -Path $worldJsonPath -Encoding UTF8
Write-Host "Saved world metadata: $worldJsonPath"

$spzUrl = $null
if ($world.assets -and $world.assets.splats -and $world.assets.splats.spz_urls) {
    $spzProps = $world.assets.splats.spz_urls.PSObject.Properties
    $spzUrl = ($spzProps | Where-Object { $_.Name -eq "500k" } | Select-Object -First 1).Value
    if (!$spzUrl) {
        $spzUrl = ($spzProps | Where-Object { $_.Name -eq "100k" } | Select-Object -First 1).Value
    }
    if (!$spzUrl) {
        $spzUrl = ($spzProps | Where-Object { $_.Name -eq "full_res" } | Select-Object -First 1).Value
    }
}

if ($spzUrl) {
    $spzPath = Join-Path $OutputPath "a0-war-signal-500k.spz"
    Invoke-WebRequest -Uri $spzUrl -OutFile $spzPath
    Write-Host "Saved SPZ: $spzPath"
} else {
    Write-Host "No SPZ URL found in response. Download the SPZ from Marble manually."
}

$colliderUrl = $world.assets.mesh.collider_mesh_url
if ($colliderUrl) {
    $colliderPath = Join-Path $OutputPath "a0-war-signal-collider.glb"
    Invoke-WebRequest -Uri $colliderUrl -OutFile $colliderPath
    Write-Host "Saved collider mesh: $colliderPath"
}

Write-Host "Done."
