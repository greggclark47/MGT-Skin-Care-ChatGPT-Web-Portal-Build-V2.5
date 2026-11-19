[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path -Parent $PSScriptRoot
$textExtensions = @('.ts', '.tsx', '.js', '.cjs', '.mjs', '.json', '.md', '.css', '.html')
$sourceRoots = @(
  (Join-Path $repoRoot 'apps\web\src'),
  (Join-Path $repoRoot 'apps\mobile'),
  (Join-Path $repoRoot 'apps\api\src'),
  (Join-Path $repoRoot 'apps\api\test'),
  (Join-Path $repoRoot 'packages\domain\src'),
  (Join-Path $repoRoot 'packages\shared\src')
)
$rootFiles = @(
  (Join-Path $repoRoot 'index.html'),
  (Join-Path $repoRoot '47-team-studio-end-to-end-demo.html'),
  (Join-Path $repoRoot 'branding-preview-47-team-studio.html'),
  (Join-Path $repoRoot 'team47studio-preview.html')
)

$files = @()
foreach ($root in $sourceRoots) {
  if (Test-Path -LiteralPath $root) {
    $files += Get-ChildItem -LiteralPath $root -Recurse -File | Where-Object { $textExtensions -contains $_.Extension.ToLowerInvariant() }
  }
}
$files += $rootFiles | Where-Object { Test-Path -LiteralPath $_ } | ForEach-Object { Get-Item -LiteralPath $_ }
$files = $files | Sort-Object FullName -Unique

$changed = 0
$utf8 = [System.Text.UTF8Encoding]::new($false)
foreach ($file in $files) {
  $before = [System.IO.File]::ReadAllText($file.FullName)
  $after = $before.Replace('47 Team Studio', 'Team 47 Studio')
  $after = $after.Replace('47-team-studio', 'team-47-studio')
  if ($file.FullName -like '*apps\api\src*' -or $file.FullName -like '*apps\api\test*' -or $file.FullName -like '*packages\domain\src*') {
    $after = $after.Replace('MGT Skin Care', 'Team 47 Studio')
  }
  if ($file.Name -in @('index.html', '47-team-studio-end-to-end-demo.html')) {
    $after = $after.Replace('v4.415', 'v4.416')
  }
  if ($after -ne $before) {
    [System.IO.File]::WriteAllText($file.FullName, $after, $utf8)
    $changed++
  }
}

[pscustomobject]@{ scanned = $files.Count; changed = $changed; public_name = 'Team 47 Studio'; primary_url = 'https://team47studio.com' } | ConvertTo-Json -Compress
