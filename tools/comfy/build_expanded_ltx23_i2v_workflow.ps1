[CmdletBinding()]
param(
    [string]$BlueprintPath = "D:\AI\ComfyUI_windows_portable\ComfyUI\blueprints\Image to Video (LTX-2.3).json",
    [string]$OutputPath = "E:\codex_project\neon-cleaner-demo\tools\comfy\video_ltx2_3_i2v_expanded.json",
    [string]$DefaultImage = "linxia_main.png"
)

$ErrorActionPreference = "Stop"

if (!(Test-Path -LiteralPath $BlueprintPath)) {
    throw "Blueprint not found: $BlueprintPath"
}

$blueprint = Get-Content -LiteralPath $BlueprintPath -Raw | ConvertFrom-Json
$subgraph = $blueprint.definitions.subgraphs | Where-Object { $_.name -eq "Image to Video (LTX-2.3)" } | Select-Object -First 1

if (!$subgraph) {
    throw "Subgraph 'Image to Video (LTX-2.3)' not found in blueprint."
}

$nodes = @($subgraph.nodes)
$links = @($subgraph.links)
$groups = @($subgraph.groups)

function Set-WidgetsValue {
    param(
        [int]$NodeId,
        [object[]]$Values
    )

    $node = $nodes | Where-Object { $_.id -eq $NodeId } | Select-Object -First 1
    if (!$node) {
        throw "Node $NodeId not found."
    }
    $node.widgets_values = $Values
}

function Set-InputLink {
    param(
        [int]$NodeId,
        [string]$InputName,
        [Nullable[int]]$LinkId
    )

    $node = $nodes | Where-Object { $_.id -eq $NodeId } | Select-Object -First 1
    if (!$node) {
        throw "Node $NodeId not found."
    }

    $found = $false
    foreach ($input in @($node.inputs)) {
        if ($input.name -eq $InputName) {
            $input.link = $LinkId
            $found = $true
            break
        }
    }

    if (!$found) {
        throw "Input '$InputName' not found on node $NodeId."
    }
}

# Patch defaults to the locally installed Sulphur stack and lighter first test settings.
Set-WidgetsValue -NodeId 316 -Values @("sulphur_dev_fp8mixed.safetensors")
Set-WidgetsValue -NodeId 279 -Values @("sulphur_dev_fp8mixed.safetensors")
Set-WidgetsValue -NodeId 317 -Values @("gemma_3_12B_it_fp4_mixed.safetensors", "sulphur_dev_fp8mixed.safetensors", "default")
Set-WidgetsValue -NodeId 311 -Values @("ltx-2.3-spatial-upscaler-x2-1.1.safetensors")
Set-WidgetsValue -NodeId 285 -Values @("ltx-2.3-22b-distilled-lora-384.safetensors", 0.5)
Set-WidgetsValue -NodeId 312 -Values @(640, "fixed")
Set-WidgetsValue -NodeId 299 -Values @(384, "fixed")
Set-WidgetsValue -NodeId 301 -Values @(5, "fixed")
Set-WidgetsValue -NodeId 300 -Values @(8, "fixed")
Set-WidgetsValue -NodeId 303 -Values @("Near-future San Francisco at night after heavy rain. A female cleanup hunter sits inside a black electric car, rain streaks across the windshield, cyan dashboard glow on her face, magenta reflections moving across her coat, while a black convoy carrying a witness passes outside. Premium cyber-noir, photorealistic, grounded sci-fi, no text, no watermark.")
Set-WidgetsValue -NodeId 313 -Values @("pc game, console game, video game, cartoon, childish, ugly, anime, text, subtitles, watermark, blurry face, different hairstyle, different coat design")
Set-WidgetsValue -NodeId 310 -Values @(8)

# Remove subgraph interface links; keep internal graph only.
$internalLinks = @(
    $links | Where-Object {
        $_.origin_id -ne -10 -and $_.origin_id -ne -20 -and $_.target_id -ne -10 -and $_.target_id -ne -20
    }
)

$nextNodeId = [int]$subgraph.state.lastNodeId + 1
$loadImageNodeId = $nextNodeId
$saveVideoNodeId = $nextNodeId + 1
$nextLinkId = [int]$subgraph.state.lastLinkId + 1
$imageLinkId = $nextLinkId
$saveLinkId = $nextLinkId + 1

$loadImageNode = [ordered]@{
    id = $loadImageNodeId
    type = "LoadImage"
    pos = @(-120, 4810)
    size = @(274.080078125, 314.000244140625)
    flags = @{}
    order = 0
    mode = 0
    inputs = @()
    outputs = @(
        [ordered]@{
            name = "IMAGE"
            type = "IMAGE"
            links = @($imageLinkId)
        },
        [ordered]@{
            name = "MASK"
            type = "MASK"
            links = @()
        }
    )
    properties = [ordered]@{
        cnr_id = "comfy-core"
        ver = "0.3.56"
        "Node name for S&R" = "LoadImage"
    }
    widgets_values = @($DefaultImage, "image")
}

$saveVideoNode = [ordered]@{
    id = $saveVideoNodeId
    type = "SaveVideo"
    pos = @(6400, 4450)
    size = @(523.0556530433919, 506.3562313794205)
    flags = @{}
    order = 999
    mode = 0
    inputs = @(
        [ordered]@{
            name = "video"
            type = "VIDEO"
            link = $saveLinkId
        }
    )
    outputs = @()
    properties = [ordered]@{
        cnr_id = "comfy-core"
        ver = "0.14.1"
    }
    widgets_values = @("video/NeonCleaner_I2V", "auto", "auto")
}

$imageLink = [ordered]@{
    id = $imageLinkId
    origin_id = $loadImageNodeId
    origin_slot = 0
    target_id = 290
    target_slot = 0
    type = "IMAGE"
}

$saveLink = [ordered]@{
    id = $saveLinkId
    origin_id = 310
    origin_slot = 0
    target_id = $saveVideoNodeId
    target_slot = 0
    type = "VIDEO"
}

# Clear stale parent-graph interface links from the blueprint extraction.
Set-InputLink -NodeId 279 -InputName "ckpt_name" -LinkId $null
Set-InputLink -NodeId 285 -InputName "lora_name" -LinkId $null
Set-InputLink -NodeId 290 -InputName "input" -LinkId $imageLinkId
Set-InputLink -NodeId 299 -InputName "value" -LinkId $null
Set-InputLink -NodeId 300 -InputName "value" -LinkId $null
Set-InputLink -NodeId 301 -InputName "value" -LinkId $null
Set-InputLink -NodeId 311 -InputName "model_name" -LinkId $null
Set-InputLink -NodeId 312 -InputName "value" -LinkId $null
Set-InputLink -NodeId 316 -InputName "ckpt_name" -LinkId $null
Set-InputLink -NodeId 317 -InputName "text_encoder" -LinkId $null
Set-InputLink -NodeId 317 -InputName "ckpt_name" -LinkId $null
Set-InputLink -NodeId 319 -InputName "value" -LinkId $null

$workflow = [ordered]@{
    revision = 0
    last_node_id = $saveVideoNodeId
    last_link_id = $saveLinkId
    nodes = @($nodes + $loadImageNode + $saveVideoNode)
    links = @($internalLinks + $imageLink + $saveLink)
    groups = $groups
    config = $subgraph.config
    extra = $subgraph.extra
    version = 0.4
}

$outputDir = Split-Path -Parent $OutputPath
if ($outputDir -and !(Test-Path -LiteralPath $outputDir)) {
    New-Item -ItemType Directory -Path $outputDir | Out-Null
}

$workflow | ConvertTo-Json -Depth 100 | Set-Content -LiteralPath $OutputPath -Encoding utf8
Write-Host "Expanded workflow written to: $OutputPath"
