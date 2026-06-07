[CmdletBinding()]
param()

$ErrorActionPreference = "Stop"

$names = @("WORLDLABS_API_KEY", "WLT_API_KEY")
$targets = @("Process", "User", "Machine")
$found = @()

foreach ($name in $names) {
    foreach ($target in $targets) {
        $value = [Environment]::GetEnvironmentVariable($name, $target)
        if ($value) {
            $looksLikePlaceholder = $value -match "your_api_key|your.*key|你的|api ?key"
            $found += [pscustomobject]@{
                Name = $name
                Scope = $target
                Length = $value.Length
                LooksLikePlaceholder = $looksLikePlaceholder
            }
        }
    }
}

if (!$found) {
    Write-Host "WorldLabs API key: missing"
    exit 1
}

Write-Host "WorldLabs API key: present"
$found | Format-Table -AutoSize

if ($found | Where-Object { $_.LooksLikePlaceholder }) {
    Write-Warning "At least one key value looks like a placeholder. Replace it with the real key from World Labs."
    exit 2
}

