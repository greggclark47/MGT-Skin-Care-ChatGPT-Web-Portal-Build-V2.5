# OpenClaw policy audit

Target: `config/openclaw.team47.fragment.json5`  
Generated: 2026-11-15T02:51:16Z  
Result: 11 pass, 0 warn, 0 fail, 2 info, 0 skipped

> Static check of the file only. Run `openclaw doctor` and OpenClaw's security audit as well.

| Status | Check | Detail |
|---|---|---|
| PASS | Ollama provider endpoint is loopback | host 127.0.0.1 |
| PASS | Native Ollama API (no /v1) | native |
| PASS | Elevated execution is off | off or not set |
| PASS | Command execution and browser are denied | denied |
| PASS | Sessions are sandboxed by default | agents.defaults.sandbox.mode = 'all' |
| PASS | Config changes need human approval | off |
| INFO | Gateway bind address | not set in the file; confirm loopback with the security audit |
| INFO | Gateway authentication configured | not set in the file |
| PASS | No literal secrets in the config file | none found |
| PASS | Team 47 Studio agents defined | t47-ops, t47-strategy |
| PASS | Agent t47-ops is least-privilege | profile minimal |
| PASS | Agent t47-strategy is least-privilege | profile minimal |
| PASS | t47 MCP server registered | registered |
