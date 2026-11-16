<#
.SYNOPSIS
  One-step workstation setup for the Team 47 Studio transfer packet.

.DESCRIPTION
  Clones (or updates) the integration branch, creates a Python virtual environment inside the packet folder,
  installs the packet, runs its tests, and writes three read-only diagnostic reports to ~/.t47/reports.
  It changes nothing outside the destination folder and ~/.t47, sends nothing, and touches no cloud resource.

  NOT RUN BY THE AUTHOR: written for Windows PowerShell 5.1+; never executed on the workstation. Read it first.

.EXAMPLE
  powershell -ExecutionPolicy RemoteSigned -File .\Install-T47.ps1 -Dest C:\t47
#>
[CmdletBinding()]
param(
    [string]$Dest = (Join-Path $env:USERPROFILE "t47"),
    [string]$RepoUrl = "https://github.com/greggclark47/MGT-Skin-Care-ChatGPT-Web-Portal-Build-V2.5.git",
    [string]$Branch = "integration/team47studio-transfer-2026-11-16",
    [string]$Python = "python"
)
$ErrorActionPreference = "Stop"

function Step($text) { Write-Host "`n== $text" -ForegroundColor Cyan }

Step "Checking tools"
foreach ($tool in @("git", $Python)) {
    if (-not (Get-Command $tool -ErrorAction SilentlyContinue)) { throw "$tool is not on PATH" }
}
$version = & $Python -c "import sys; print('%d.%d' % sys.version_info[:2])"
if ([version]$version -lt [version]"3.11") { throw "Python 3.11 or later is required (found $version)" }

Step "Getting the code ($Branch)"
if (Test-Path (Join-Path $Dest ".git")) {
    git -C $Dest fetch origin $Branch
    git -C $Dest checkout $Branch
    git -C $Dest pull --ff-only origin $Branch
} else {
    git clone --branch $Branch --single-branch $RepoUrl $Dest
}
$packet = Join-Path $Dest "MGT_Team47Studio_Deployment_Packet"
if (-not (Test-Path (Join-Path $packet "pyproject.toml"))) { throw "Packet folder not found in $Dest" }

Step "Creating the virtual environment and installing"
$venv = Join-Path $packet ".venv"
if (-not (Test-Path $venv)) { & $Python -m venv $venv }
$py = Join-Path $venv "Scripts\python.exe"
& $py -m pip install --quiet --upgrade pip
& $py -m pip install --quiet -e "$packet[dev,backup,assets]"

Step "Configuration"
$config = Join-Path $packet "config\t47.toml"
if (-not (Test-Path $config)) {
    (Get-Content (Join-Path $packet "config\t47.example.toml")) -replace '^repo = ""', ('repo = "' + ($Dest -replace '\\', '/') + '"') |
        Set-Content -Encoding UTF8 $config
    Write-Host "wrote $config"
}
$env:T47_CONFIG = $config

Step "Tests"
Push-Location $packet
try {
    & $py -m pytest -q
    if ($LASTEXITCODE -ne 0) { throw "Tests failed. Stop here and send the output back." }

    Step "Read-only diagnostics (reports in ~/.t47/reports)"
    $reports = Join-Path $env:USERPROFILE ".t47\reports"
    & $py -m t47 release merge-check --out (Join-Path $reports "merge-check.md")
    & $py -m t47 diagnostics local-ai --out (Join-Path $reports "local-ai.md")
    & $py -m t47 diagnostics site --out (Join-Path $reports "site.md")
    & $py -m t47 diagnostics repo --visibility public --out (Join-Path $reports "repo.md")
    & $py -m t47 release status --out (Join-Path $reports "release-status.md")
} finally { Pop-Location }

Write-Host "`nDone. A non-zero diagnostic means a check failed, not that setup failed: read the reports in $reports." -ForegroundColor Green
Write-Host "Next: docs\12-TRANSFER-PACKET.md, section 3."
