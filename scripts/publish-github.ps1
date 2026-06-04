param(
  [switch]$Release
)

$ErrorActionPreference = "Stop"

$root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$package = Get-Content (Join-Path $root "package.json") -Raw | ConvertFrom-Json
$repository = [string]$package.repository
$match = [regex]::Match($repository, "github\.com/([^/]+)/([^/]+?)(?:\.git)?$")
if (-not $match.Success) {
  throw "package.json repository must be a GitHub repository URL."
}

$owner = $match.Groups[1].Value
$repo = $match.Groups[2].Value
$api = "https://api.github.com/repos/$owner/$repo"

$credentialInput = "protocol=https`nhost=github.com`n`n"
$credential = $credentialInput | git credential fill
$tokenLine = $credential | Where-Object { $_ -like "password=*" } | Select-Object -First 1
if (-not $tokenLine) {
  throw "No GitHub credential found. Sign in to GitHub in Git Credential Manager first."
}

$token = $tokenLine.Substring(9)
$headers = @{
  Authorization = "Bearer $token"
  Accept = "application/vnd.github+json"
  "User-Agent" = "FTSerialTool-Publisher"
  "X-GitHub-Api-Version" = "2022-11-28"
}

Push-Location $root
try {
  $head = Invoke-RestMethod -Uri "$api/git/ref/heads/main" -Headers $headers
  $baseCommit = Invoke-RestMethod -Uri "$api/git/commits/$($head.object.sha)" -Headers $headers
  $treeItems = @()

  foreach ($file in (git ls-files)) {
    $bytes = [System.IO.File]::ReadAllBytes((Join-Path $root $file))
    $blobBody = @{
      content = [Convert]::ToBase64String($bytes)
      encoding = "base64"
    } | ConvertTo-Json -Compress
    $blob = Invoke-RestMethod -Method Post -Uri "$api/git/blobs" -Headers $headers -Body $blobBody -ContentType "application/json"
    $treeItems += @{
      path = $file
      mode = "100644"
      type = "blob"
      sha = $blob.sha
    }
  }

  $treeBody = @{
    base_tree = $baseCommit.tree.sha
    tree = $treeItems
  } | ConvertTo-Json -Depth 6 -Compress
  $tree = Invoke-RestMethod -Method Post -Uri "$api/git/trees" -Headers $headers -Body $treeBody -ContentType "application/json"

  $commitBody = @{
    message = "Publish FTSerialTool $($package.version)"
    tree = $tree.sha
    parents = @($head.object.sha)
  } | ConvertTo-Json -Depth 4 -Compress
  $commit = Invoke-RestMethod -Method Post -Uri "$api/git/commits" -Headers $headers -Body $commitBody -ContentType "application/json"

  $refBody = @{ sha = $commit.sha; force = $false } | ConvertTo-Json -Compress
  Invoke-RestMethod -Method Patch -Uri "$api/git/refs/heads/main" -Headers $headers -Body $refBody -ContentType "application/json" | Out-Null
  Write-Host "Published main: $($commit.sha)"

  if ($Release) {
    $tagName = "v$($package.version)"
    try {
      Invoke-RestMethod -Uri "$api/git/ref/tags/$tagName" -Headers $headers | Out-Null
      Write-Host "Tag already exists: $tagName"
    } catch {
      if ($_.Exception.Response.StatusCode.value__ -ne 404) { throw }
      $tagBody = @{ ref = "refs/tags/$tagName"; sha = $commit.sha } | ConvertTo-Json -Compress
      Invoke-RestMethod -Method Post -Uri "$api/git/refs" -Headers $headers -Body $tagBody -ContentType "application/json" | Out-Null
      Write-Host "Created release tag: $tagName"
    }
  }
} finally {
  Remove-Variable token, credential, tokenLine -ErrorAction SilentlyContinue
  Pop-Location
}
