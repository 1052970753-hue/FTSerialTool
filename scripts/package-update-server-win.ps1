$ErrorActionPreference = "Stop"

$root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$electronDist = (Resolve-Path (Join-Path $root "node_modules\electron\dist")).Path
$out = Join-Path $root "dist\FTUpdateServer-win32-x64"
$appDir = Join-Path $out "resources\app"

if (Test-Path $out) {
  Remove-Item -LiteralPath $out -Recurse -Force
}
New-Item -ItemType Directory -Path $out | Out-Null
Copy-Item -Path (Join-Path $electronDist "*") -Destination $out -Recurse -Force
Rename-Item -LiteralPath (Join-Path $out "electron.exe") -NewName "FTUpdateServer.exe"

@(
  "libGLESv2.dll",
  "libEGL.dll",
  "d3dcompiler_47.dll",
  "vk_swiftshader.dll",
  "vk_swiftshader_icd.json",
  "vulkan-1.dll"
) | ForEach-Object {
  $item = Join-Path $out $_
  if (Test-Path $item) { Remove-Item -LiteralPath $item -Force }
}

$locales = Join-Path $out "locales"
Get-ChildItem -LiteralPath $locales -File |
  Where-Object { $_.Name -notin @("en-US.pak", "zh-CN.pak") } |
  Remove-Item -Force

$defaultApp = Join-Path $out "resources\default_app.asar"
if (Test-Path $defaultApp) { Remove-Item -LiteralPath $defaultApp -Force }

New-Item -ItemType Directory -Path $appDir | Out-Null
Copy-Item -LiteralPath (Join-Path $root "update-server-app") -Destination $appDir -Recurse -Force
New-Item -ItemType Directory -Path (Join-Path $appDir "scripts") | Out-Null
Copy-Item -LiteralPath (Join-Path $root "scripts\update-server-core.js") -Destination (Join-Path $appDir "scripts") -Force

$package = @{
  name = "ft-update-server"
  version = (Get-Content (Join-Path $root "package.json") -Raw | ConvertFrom-Json).version
  main = "update-server-app/main.js"
  private = $true
} | ConvertTo-Json
[System.IO.File]::WriteAllText((Join-Path $appDir "package.json"), $package, [System.Text.UTF8Encoding]::new($false))

& compact.exe /c /s:$out /exe:lzx /i /q | Select-Object -Last 5 | Out-Host
Write-Host "Created $out\FTUpdateServer.exe"
