# Model registry

| Model | Status | Roles | Weights GB | Fit on 16 GB | Confidence | Source |
|---|---|---|---|---|---|---|
| `deepseek-r1:8b` | incumbent | reasoning | 5.23 | fits | measured | docs/production/LOCAL-AI-SUPABASE-ACTIVATION-2026-11-06.md |
| `qwen3.5:4b` | incumbent | drafting, agent | 3.32 | fits | measured | docs/production/LOCAL-AI-SUPABASE-ACTIVATION-2026-11-06.md |
| `nomic-embed-text` | incumbent | embedding | 0.27 | fits | measured | docs/production/LOCAL-AI-SUPABASE-ACTIVATION-2026-11-06.md |
| `llava:latest` | incumbent | vision | not read | unknown | repo | packages/ai-gateway/src/task-registry.ts |
| `gemma4:12b` | candidate | drafting, agent, vision | 8.0 | fits | published | https://registry.ollama.ai/library/gemma4 |
| `gemma4:e4b` | candidate | drafting, vision | 9.5 | fits | published | https://registry.ollama.ai/library/gemma4 |
| `qwen3.5:9b` | candidate | drafting, agent | not read | unknown | secondary | https://summarizemeeting.com/en/news/ollama-qwen-3-5-local-tool-calling-multimodal |
| `mistral-small3.2` | candidate | drafting | not read | unknown | local-inventory | workstation model directory listing, 2026-11-14 |
| `qwen3.8:27b` | not_local | reasoning, agent | 18.0 | exceeds | secondary | https://www.orcarouter.ai/blog/qwen-3-8-27b-ollama |
| `deepseek-v4.1-flash` | hosted_fallback | drafting, reasoning | not read | hosted | repo | docs/production/OLLAMA-CLOUD-WORKSPACE-GCP-ACTIVATION-2026-11-06.md |

Fit is a screening rule on published weight size (fits: 4 GB or more headroom; tight: 1 to 4 GB; exceeds: under 1 GB). Context memory is extra. The real answer is `ollama ps` after loading the model at the context you will run.
