# 07 Runbook: local hardware

Version 1.2.0, 2026-11-16. Workstation: Windows, RTX 5080 16 GB, Ollama, OpenClaw.

## First hour

1. **Install.** Python 3.11 or later. In the packet folder: `python -m venv .venv`, then `.\.venv\Scripts\pip install -e ".[dev]"`, then `.\.venv\Scripts\python -m pytest`. Expect 135 passed. `merge/Install-T47.ps1` does steps 1 to 5 in one run.
2. **Configure.** Copy `config\t47.example.toml` to `config\t47.toml`. Set `[paths] repo` to the monorepo checkout. Run `t47 config show`.
3. **Check the local plane.** `t47 diagnostics local-ai`. Fix any FAIL before going on: Ollama running, loopback only, both role models installed.
4. **Check the site.** `t47 diagnostics site`. `/readyz` at 503 is reported as INFO; that is the intended state today.
5. **Check the repository.** `t47 diagnostics repo --visibility public`.
6. **First draft.** `t47 agents run customer_care --brief "A member cannot sign in and asks how to reset the password." --dry-run`, then again without `--dry-run`. Review it with the commands in `03`.
7. **Backup key.** `python -c "import secrets; print(secrets.token_hex(32))"`. Store it in the password manager and as the user environment variable `T47_BACKUP_KEY`. Run `t47 backup agent-plane`. Without the key a backup cannot be restored.

## First week

8. **Bake-off.** `ollama pull` the candidates you want, then `t47 models bakeoff --out bakeoff.md`. Keep the report; it is evidence for gates G12 and G23.
9. **OpenClaw.** `t47 openclaw render --python "<full path to .venv\Scripts\python.exe>"`. Merge the output into `~/.openclaw/openclaw.json` by hand. Copy `config\openclaw-workspace\AGENTS.md` into the workspace named in the fragment. Run `t47 openclaw audit`, `openclaw doctor`, and the OpenClaw security audit. Ask the `t47-ops` agent to list the drafting agents.
10. **Schedule.** `config\windows\Register-T47Tasks.ps1 -WhatIf`, then for real. Point `-BackupDir` at a Google Drive for desktop folder for the off-machine copy.
11. **Gates.** `t47 release init`, then `t47 release status`.

## Routine

| When | Action |
|---|---|
| Daily, scheduled | encrypted backup; site and local AI diagnostics written to `~/.t47/reports` |
| Daily, by hand | read the two reports; clear the review queue |
| Weekly | retention pass (scheduled); `t47 release status`; update gates with evidence |
| Monthly | restore one backup into an empty folder and open the queue from it |
| Before any model change | bake-off, owner decision, staging regression |

## When something fails

| Symptom | Likely cause | Action |
|---|---|---|
| `Ollama is not answering` | service stopped | start Ollama; rerun `diagnostics local-ai` |
| draft verdict `blocked` | a guardrail matched | read the finding; revise the brief or `t47 agents edit`; never paste around it |
| `no model produced a draft` | models missing or out of memory | `ollama ps`; unload the larger model; check `[models]` |
| model partly on CPU | context or model too large for 16 GB | lower `num_ctx` or choose a smaller tag |
| `authentication failed` on a backup | wrong key or altered file | use the key from the password manager; try the Drive copy |
| OpenClaw cannot see the tools | wrong Python path in the fragment, or sandbox blocks MCP | use the venv's full `python.exe` path; `openclaw doctor` |

## Hardware headroom

Both incumbents loaded together use about 9.7 GB of the 16.3 GB card at an 8,192-token context, by the repository's 2026-11-06 measurements. That leaves room for one mid-size candidate during a bake-off only if `OLLAMA_MAX_LOADED_MODELS=2` unloads the idle model first. Confirm with `ollama ps` rather than assuming.
