# Windows scheduling

`Register-T47Tasks.ps1` registers four scheduled tasks for the signed-in user: a nightly encrypted backup of the
local agent plane, a weekly retention pass, and two read-only morning diagnostics. Each task runs `python -m t47 ...`
directly, so there is nothing else to maintain.

The script has not been executed by its author. Run it with `-WhatIf` first:

```powershell
cd <packet folder>\config\windows
.\Register-T47Tasks.ps1 -WhatIf
.\Register-T47Tasks.ps1 -Python "C:\t47\.venv\Scripts\python.exe"
```

If PowerShell refuses to run the file, run it for this one session with
`powershell -ExecutionPolicy RemoteSigned -File .\Register-T47Tasks.ps1` rather than changing the machine policy.

To send encrypted backups off the machine with no API keys, point `-BackupDir` at a folder inside Google Drive
for desktop. Only `.t47enc.json` archives and their receipts are written there. The key never is.

Remove the tasks with `.\Register-T47Tasks.ps1 -Remove`.

Agent drafting is not scheduled here on purpose. A draft is created when a person asks for one, from the CLI or
through OpenClaw, and it waits in the review queue until a person decides it.
