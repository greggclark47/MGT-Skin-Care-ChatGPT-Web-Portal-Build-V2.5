<#
.SYNOPSIS
  Registers the Team 47 Studio local-agent-plane scheduled tasks for the signed-in Windows user.

.DESCRIPTION
  Four tasks, all running `python -m t47 ...` as you, only while you are signed in. No password is stored.
    T47 agent-plane backup     daily    encrypts ~/.t47 into one file and verifies it
    T47 backup retention       weekly   removes backups outside 7 daily + 4 weekly (the newest is never removed)
    T47 site diagnostic        daily    GET-only checks of team47studio.com, report written to ~/.t47/reports
    T47 local AI diagnostic    daily    Ollama, GPU and OpenClaw checks, report written to ~/.t47/reports

  Nothing here sends, posts or publishes anything, and nothing changes a cloud resource.
  The backup task needs the user environment variable T47_BACKUP_KEY (see config\env.agents.example).

  NOT RUN BY THE AUTHOR: this script was written for Windows PowerShell 5.1+ and has not been executed on the
  workstation. Read it, then run it once with -WhatIf before running it for real.

.PARAMETER Python
  Python executable to use. Give the venv's python.exe if you installed the packet in a virtual environment.

.PARAMETER BackupDir
  Optional. Folder for encrypted backups. Point it at a Google Drive for desktop folder to get the off-machine
  copy automatically (only the encrypted .t47enc.json files and their receipts are written there).

.EXAMPLE
  .\Register-T47Tasks.ps1 -WhatIf
  .\Register-T47Tasks.ps1 -Python "C:\t47\.venv\Scripts\python.exe" -BackupDir "G:\My Drive\Team47Studio-Backups\agent-plane"
  .\Register-T47Tasks.ps1 -Remove
#>
[CmdletBinding(SupportsShouldProcess = $true)]
param(
    [string]$PacketDir = (Split-Path -Parent (Split-Path -Parent $PSScriptRoot)),
    [string]$Python = "python",
    [string]$BackupDir = "",
    [string]$BackupTime = "02:30",
    [string]$RetentionTime = "03:00",
    [string]$DiagnosticsTime = "07:00",
    [switch]$Remove
)

$ErrorActionPreference = "Stop"
$reports = Join-Path $env:USERPROFILE ".t47\reports"

$backupArgs = "-m t47 backup agent-plane"
$pruneArgs = "-m t47 backup prune --apply"
if ($BackupDir -ne "") {
    $backupArgs = "$backupArgs --out `"$BackupDir`""
    $pruneArgs = "-m t47 backup prune --dir `"$BackupDir`" --apply"
}

$tasks = @(
    @{ Name = "T47 agent-plane backup";  Args = $backupArgs; Trigger = (New-ScheduledTaskTrigger -Daily -At $BackupTime);
       About = "Encrypts the local agent plane state and verifies the archive. Sends nothing." },
    @{ Name = "T47 backup retention";    Args = $pruneArgs;  Trigger = (New-ScheduledTaskTrigger -Weekly -DaysOfWeek Sunday -At $RetentionTime);
       About = "Removes encrypted backups outside the 7 daily + 4 weekly policy." },
    @{ Name = "T47 site diagnostic";     Args = "-m t47 diagnostics site --out `"$reports\site-latest.md`"";
       Trigger = (New-ScheduledTaskTrigger -Daily -At $DiagnosticsTime);
       About = "Read-only checks of the public site." },
    @{ Name = "T47 local AI diagnostic"; Args = "-m t47 diagnostics local-ai --out `"$reports\local-ai-latest.md`"";
       Trigger = (New-ScheduledTaskTrigger -Daily -At $DiagnosticsTime);
       About = "Read-only checks of Ollama, the GPU and the OpenClaw config." }
)

if ($Remove) {
    foreach ($task in $tasks) {
        if (Get-ScheduledTask -TaskName $task.Name -ErrorAction SilentlyContinue) {
            if ($PSCmdlet.ShouldProcess($task.Name, "Unregister scheduled task")) {
                Unregister-ScheduledTask -TaskName $task.Name -Confirm:$false
                Write-Host "removed: $($task.Name)"
            }
        }
    }
    return
}

if (-not (Test-Path (Join-Path $PacketDir "t47\cli.py"))) {
    throw "PacketDir does not look like the packet folder (t47\cli.py not found): $PacketDir"
}
if (-not $env:T47_BACKUP_KEY) {
    Write-Warning "T47_BACKUP_KEY is not set for this user. The backup task will fail until it is (see config\env.agents.example)."
}

$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -ExecutionTimeLimit (New-TimeSpan -Minutes 30)
foreach ($task in $tasks) {
    $action = New-ScheduledTaskAction -Execute $Python -Argument $task.Args -WorkingDirectory $PacketDir
    if ($PSCmdlet.ShouldProcess($task.Name, "Register scheduled task: $Python $($task.Args)")) {
        Register-ScheduledTask -TaskName $task.Name -Action $action -Trigger $task.Trigger -Settings $settings `
            -Description $task.About -Force | Out-Null
        Write-Host "registered: $($task.Name)"
    }
}
Write-Host "Done. Review the tasks in Task Scheduler. Reports are written to $reports"
