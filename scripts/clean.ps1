$ErrorActionPreference = "Stop"

$root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$dist = Join-Path $root "dist"

if ((Test-Path $dist) -and $dist.StartsWith($root, [System.StringComparison]::OrdinalIgnoreCase)) {
  Remove-Item -LiteralPath $dist -Recurse -Force
}

Write-Host "Cleaned generated build output."
