$ErrorActionPreference = "Stop"

$root = Resolve-Path (Join-Path $PSScriptRoot "..")
$electronDist = Resolve-Path (Join-Path $root "node_modules\electron\dist")
$out = Join-Path $root "dist\FTSerialTool-win32-x64"

if (Test-Path $out) {
  Remove-Item -LiteralPath $out -Recurse -Force
}

New-Item -ItemType Directory -Force -Path $out | Out-Null
Copy-Item -Path (Join-Path $electronDist "*") -Destination $out -Recurse -Force
Rename-Item -LiteralPath (Join-Path $out "electron.exe") -NewName "FTSerialTool.exe"

# Hardware acceleration is disabled in main.js, so these GPU fallback libraries are unused.
@(
  "libGLESv2.dll",
  "libEGL.dll",
  "d3dcompiler_47.dll",
  "vk_swiftshader.dll",
  "vk_swiftshader_icd.json",
  "vulkan-1.dll"
) | ForEach-Object {
  $item = Join-Path $out $_
  if (Test-Path $item) {
    Remove-Item -LiteralPath $item -Force
  }
}

$locales = Join-Path $out "locales"
Get-ChildItem -LiteralPath $locales -File |
  Where-Object { $_.Name -notin @("en-US.pak", "zh-CN.pak") } |
  Remove-Item -Force

$defaultApp = Join-Path $out "resources\default_app.asar"
if (Test-Path $defaultApp) {
  Remove-Item -LiteralPath $defaultApp -Force
}

$appDir = Join-Path $out "resources\app"
New-Item -ItemType Directory -Force -Path $appDir | Out-Null

$files = @(
  "index.html",
  "styles.css",
  "app.js",
  "protocol-parser.js",
  "main.js",
  "preload.js",
  "package.json",
  "package-lock.json"
)

foreach ($file in $files) {
  Copy-Item -LiteralPath (Join-Path $root $file) -Destination $appDir -Force
}

Push-Location $appDir
try {
  npm install --omit=dev --no-audit --no-fund | Out-Host
} finally {
  Pop-Location
}

Remove-Item -LiteralPath (Join-Path $appDir "package-lock.json") -Force

$prebuilds = Join-Path $appDir "node_modules\@serialport\bindings-cpp\prebuilds"
if (Test-Path $prebuilds) {
  Get-ChildItem -LiteralPath $prebuilds -Directory |
    Where-Object { $_.Name -ne "win32-x64" } |
    Remove-Item -Recurse -Force
}

$nodeModules = Join-Path $appDir "node_modules"
Get-ChildItem -LiteralPath $nodeModules -Recurse -File |
  Where-Object { $_.Extension -in @(".h", ".hpp", ".c", ".cpp", ".ts", ".md", ".map") } |
  Remove-Item -Force

Get-ChildItem -LiteralPath $nodeModules -Recurse -Directory |
  Where-Object { $_.Name -in @(".github", "docs", "doc", "test", "tests", "example", "examples") } |
  Sort-Object FullName -Descending |
  Remove-Item -Recurse -Force

& (Join-Path $PSScriptRoot "compact-win.ps1")

Write-Host "Created $out\FTSerialTool.exe"
