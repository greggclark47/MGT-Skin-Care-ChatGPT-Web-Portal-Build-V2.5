# Verification record, packet 1.0.0

Run 2026-11-15 (UTC) in the build workspace, Python 3.13.

| Check | Result | What it does and does not show |
|---|---|---|
| Unit tests (`python -m pytest`) | 116 passed | Logic of every module with stand-ins for the network, the model and OpenClaw. |
| Repository inventory on `codex/reconcile-main-2026-09-20` at `1ef5c51` | 5 pass, 4 warn, 1 fail | Real run on the real checkout. See `repo-inventory-1ef5c51.md`. |
| Store images from the D09 v2.1 packet | 35 pass | Real run on the real image files. See `store-assets-d09-v2.1.md`. |
| OpenClaw fragment self-audit | 11 pass, 2 info | The rendered fragment against this packet's own policy. Not a run of OpenClaw. |
| Release status | HOLD on web, android, ios, ops | Initial state: nothing is accepted. See `release-status-initial.md`. |
| Workbook recalculation (LibreOffice) | 89 formulas, 0 errors | Model sheet agrees with `t47.economics.model` on 9 measures across 3 scenarios, to the cent. |
| MCP server over stdio | initialize, tools/list, tools/call answered | Message shapes only. Not connected to a real OpenClaw gateway. |
| HTTP path against a loopback stub | diagnostics, agent run, submit, bake-off completed | The client, queue and CLI work end to end. The stub is not a model: no draft quality is implied. |

## Not run, and why

- `t47 diagnostics site`: the build workspace cannot reach team47studio.com. Run it on the workstation.
- `t47 diagnostics local-ai` and `t47 models bakeoff` against real models: they need the workstation's Ollama.
- `config/windows/Register-T47Tasks.ps1`: written, never executed. Use `-WhatIf` first.
- The OpenClaw fragment on the installed OpenClaw: merge by hand, then `openclaw doctor` and its security audit.
- No model quality, latency or cost figure in this packet is a measurement by this packet. Measured figures are quoted from the repository's own 2026-11-06 report and labelled as such.
