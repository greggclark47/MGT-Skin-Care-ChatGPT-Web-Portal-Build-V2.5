# MGT_Team47Studio Deployment Packet

Version 1.2.0, 2026-11-16. Provider of record: MGT Solutions, Inc d/b/a Team47Studio.

A Python package (`t47`) and a set of runbooks that sit on top of the existing Team 47 Studio build. The stack is unchanged. The packet adds a local agent plane on the workstation, one view over the release gates, a model qualification harness, and the operating documents for launch.

## What it does

| Area | Command | Effect |
|---|---|---|
| Diagnostics | `t47 diagnostics site`, `repo`, `local-ai` | Read-only checks. GET requests and file reads. |
| Models | `t47 models list`, `bakeoff` | Screens candidates for the 16 GB card; prints PROPOSE or KEEP. Changes no route. |
| Agents | `t47 agents run`, `submit`, `review`, `export` | Six draft-only agents on local Ollama, deterministic guardrails, a human review queue. Customer-care safety, privacy, billing-dispute and ask-for-a-person messages get a fixed reply with no model call. |
| OpenClaw | `t47 openclaw render`, `audit`; `t47 mcp serve` | Least-privilege fragment, policy audit, and a three-capability MCP bridge. |
| Backup | `t47 backup agent-plane`, `verify`, `restore`, `prune`, `drill` | AES-256-GCM backup of local state; the application restore drill as steps and an evidence record. |
| Release | `t47 release status`, `set`, `assets`, `merge-check` | SHIP or HOLD per platform from recorded, evidenced gate decisions. Store image validation. |
| Go-to-market, economics | `t47 gtm calendar`, `utm`; `t47 economics summary`, `workbook` | Private packet only. |

## What it cannot do

It has no code that sends, posts, publishes, contacts anyone, or changes a cloud resource. An agent draft becomes usable only after a named person approves it and exports the reviewed artifact; delivery is a separate, separately authorized step outside this package. Only a named person can accept a release gate.

## Install (workstation, Python 3.11 or later)

```powershell
cd <this folder>
python -m venv .venv
.\.venv\Scripts\pip install -e ".[dev]"
copy config\t47.example.toml config\t47.toml
.\.venv\Scripts\python -m pytest
.\.venv\Scripts\t47 diagnostics local-ai
```

The core has no dependencies. Extras: `workbook` (openpyxl), `backup` (cryptography), `assets` (Pillow).

## Read in this order

0. `docs/12-TRANSFER-PACKET.md`: the end-to-end merge across GitHub, Drive, the workstation and all four platforms. Start here.
1. `docs/07-RUNBOOK-LOCAL-HARDWARE.md`: first hour on the workstation.
2. `docs/02-DEPLOYMENT-STRATEGY.md`: topology, connections, platform ship paths.
3. `docs/03-AI-AGENT-OPERATIONS.md`: agents, guardrails, OpenClaw, model plan.
4. `docs/08-RELEASE-CHECKLISTS.md`: gates per platform.
5. `docs/10-MERGE-PLAN.md`: how this packet, the D09 v3.9 handoff and the candidate build fit together.
6. `docs/11-DIAGNOSTIC-REGRESSION-v1.1.md`: what changed since 1.0.0.
7. `evidence/VERIFICATION.md`: what was run, and what was not.

## State of verification

135 unit tests pass. The repository inventory and the store image validation were run on real inputs. The site diagnostic, the local AI diagnostic, the bake-off, the OpenClaw merge and the Windows task script have not been run on the workstation. `evidence/VERIFICATION.md` has the detail.

## This copy

This is the public-safe subset: code, configuration examples, technical runbooks, the merge kit and verification evidence. The assessment, go-to-market, customer care, economics, regression report and open-items documents, the ROI workbook and the `t47.gtm` and `t47.economics` modules are kept in the private Drive folder `MGT_Team47Studio Deployment Packet`.
