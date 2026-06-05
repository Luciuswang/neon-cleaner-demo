[CmdletBinding()]
param(
    [string]$SourceWorkflow = "E:\codex_project\neon-cleaner-demo\tools\comfy\video_ltx2_3_i2v_public_save.json",
    [string]$OutputWorkflow = "E:\codex_project\neon-cleaner-demo\tools\comfy\video_ltx2_3_i2v_ready.json",
    [string]$DefaultImage = "linxia_main.png"
)

$ErrorActionPreference = "Stop"

if (!(Test-Path -LiteralPath $SourceWorkflow)) {
    throw "Source workflow not found: $SourceWorkflow"
}

$workflow = Get-Content -LiteralPath $SourceWorkflow -Raw | ConvertFrom-Json

$groupNode = @($workflow.nodes) | Where-Object { $_.type -eq "2454ad83-157c-40dd-9f19-5daaf4041ce0" } | Select-Object -First 1
if (!$groupNode) {
    throw "Group node not found."
}

$loadNodeId = [int]$workflow.last_node_id + 1
$imageLinkId = [int]$workflow.last_link_id + 1

$loadNode = [ordered]@{
    id = $loadNodeId
    type = "LoadImage"
    pos = @(-260, 4140)
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

$imageLink = @($imageLinkId, $loadNodeId, 0, $groupNode.id, 0, "IMAGE")

$groupNode.inputs[0].link = $imageLinkId

$workflow.last_node_id = $loadNodeId
$workflow.last_link_id = $imageLinkId
$workflow.nodes = @($workflow.nodes + $loadNode)
$workflow.links = @(@($workflow.links) + ,$imageLink)

$outputDir = Split-Path -Parent $OutputWorkflow
if ($outputDir -and !(Test-Path -LiteralPath $outputDir)) {
    New-Item -ItemType Directory -Path $outputDir | Out-Null
}

$workflow | ConvertTo-Json -Depth 100 | Set-Content -LiteralPath $OutputWorkflow -Encoding utf8
Write-Host "Saved workflow to: $OutputWorkflow"
