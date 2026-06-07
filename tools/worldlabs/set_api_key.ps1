[CmdletBinding()]
param()

$ErrorActionPreference = "Stop"

Write-Host "Paste your World Labs API key. It will be saved to the Windows User environment as WORLDLABS_API_KEY."
Write-Host "The key will not be written to this repository."

$secure = Read-Host "World Labs API key" -AsSecureString
$ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)

try {
    $apiKey = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr)
} finally {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr)
}

if (!$apiKey -or $apiKey -match "your_api_key|your.*key|你的|api ?key") {
    throw "The value is empty or still looks like a placeholder."
}

[Environment]::SetEnvironmentVariable("WORLDLABS_API_KEY", $apiKey, "User")
$env:WORLDLABS_API_KEY = $apiKey

Write-Host "WorldLabs API key saved for the current Windows user."
Write-Host "Run .\tools\worldlabs\check_api_key.ps1 to verify."

