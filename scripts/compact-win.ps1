$ErrorActionPreference = "Stop"

$root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$target = Join-Path $root "dist\FTSerialTool-win32-x64"

if (-not (Test-Path $target)) {
  throw "Windows package not found. Run npm run pack:win first."
}

if (-not $target.StartsWith($root, [System.StringComparison]::OrdinalIgnoreCase)) {
  throw "Refusing to compact a path outside the workspace."
}

$compactOutput = & compact.exe /c /s:$target /exe:lzx /i /q
if ($LASTEXITCODE -ne 0) {
  throw "Windows compact.exe failed with exit code $LASTEXITCODE."
}

$compactOutput | Select-Object -Last 5 | Out-Host
Write-Host "Applied Windows LZX compression to $target"
