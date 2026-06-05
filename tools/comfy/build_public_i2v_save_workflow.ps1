[CmdletBinding()]
param(
    [string]$SourceWorkflow = "D:\AI\ComfyUI_windows_portable\ComfyUI\user\default\workflows\LTX2.3\video_ltx2_3_i2v_public.json",
    [string]$OutputWorkflow = "E:\codex_project\neon-cleaner-demo\tools\comfy\video_ltx2_3_i2v_public_save.json"
)

$ErrorActionPreference = "Stop"

if (!(Test-Path -LiteralPath $SourceWorkflow)) {
    throw "Source workflow not found: $SourceWorkflow"
}

$workflow = Get-Content -LiteralPath $SourceWorkflow -Raw | ConvertFrom-Json

$topNode = @($workflow.nodes) | Select-Object -First 1
if (!$topNode) {
    throw "Workflow has no top-level nodes."
}

$saveNodeId = [int]$workflow.last_node_id + 1
$saveLinkId = if ([int]$workflow.last_link_id -gt 0) { [int]$workflow.last_link_id + 1 } else { 1 }

$topNode.outputs[0].links = @($saveLinkId)

$saveNode = [ordered]@{
    id = $saveNodeId
    type = "SaveVideo"
    pos = @(540, 4160)
    size = @(523.0556530433919, 506.3562313794205)
    flags = @{}
    order = 3
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

$workflow.last_node_id = $saveNodeId
$workflow.last_link_id = $saveLinkId
$workflow.nodes = @($workflow.nodes + $saveNode)
$workflow.links = @(@($workflow.links) + ,@($saveLinkId, $topNode.id, 0, $saveNodeId, 0, "VIDEO"))

$outputDir = Split-Path -Parent $OutputWorkflow
if ($outputDir -and !(Test-Path -LiteralPath $outputDir)) {
    New-Item -ItemType Directory -Path $outputDir | Out-Null
}

$workflow | ConvertTo-Json -Depth 100 | Set-Content -LiteralPath $OutputWorkflow -Encoding utf8
Write-Host "Saved workflow to: $OutputWorkflow"
