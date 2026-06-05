$ErrorActionPreference = "Stop"

$root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$packageDir = Join-Path $root "dist\FTSerialTool-win32-x64"
$output = Join-Path $root "dist\FTSerialTool-portable-x64.exe"
$workDir = Join-Path $root "dist\.portable-build"
$nsisArchive = Join-Path $workDir "nsis.zip"
$nsisDir = Join-Path $workDir "nsis"
$config = Join-Path $workDir "portable.nsi"
$packageVersion = (Get-Content (Join-Path $root "package.json") -Raw | ConvertFrom-Json).version

if (-not (Test-Path (Join-Path $packageDir "FTSerialTool.exe"))) {
  & (Join-Path $PSScriptRoot "package-win.ps1")
}

if (Test-Path $workDir) {
  Remove-Item -LiteralPath $workDir -Recurse -Force
}
if (Test-Path $output) {
  Remove-Item -LiteralPath $output -Force
}
New-Item -ItemType Directory -Path $workDir | Out-Null

& curl.exe -L --fail --silent --show-error `
  "https://downloads.sourceforge.net/project/nsis/NSIS%203/3.11/nsis-3.11.zip" `
  -o $nsisArchive
if ($LASTEXITCODE -ne 0) {
  throw "Failed to download the NSIS portable build tool."
}
Expand-Archive -LiteralPath $nsisArchive -DestinationPath $nsisDir
$makeNsis = Get-ChildItem -LiteralPath $nsisDir -Recurse -Filter "makensis.exe" | Select-Object -First 1
if (-not $makeNsis) {
  throw "Failed to prepare the NSIS portable build tool."
}

$nsisSource = $packageDir.Replace("\", "\\")
$nsisOutput = $output.Replace("\", "\\")
$cacheDir = "`$LOCALAPPDATA\FTSerialTool\portable-$packageVersion"
$nsisScript = @"
Unicode true
SilentInstall silent
RequestExecutionLevel user
SetCompressor /FINAL zlib
Name "FTSerialTool Portable"
OutFile "$nsisOutput"

Section
  IfFileExists "$cacheDir\FTSerialTool.exe" launch
  SetOutPath "$cacheDir"
  File /r "$nsisSource\*"
launch:
  Exec '"$cacheDir\FTSerialTool.exe"'
SectionEnd
"@
[System.IO.File]::WriteAllText($config, $nsisScript, [System.Text.UTF8Encoding]::new($false))
& $makeNsis.FullName $config | Out-Host
if ($LASTEXITCODE -ne 0 -or -not (Test-Path $output)) {
  throw "NSIS failed to create the portable executable."
}

Remove-Item -LiteralPath $workDir -Recurse -Force
$sizeMb = [math]::Round((Get-Item $output).Length / 1MB, 2)
Write-Host "Created single-file portable app: $output ($sizeMb MB)"
