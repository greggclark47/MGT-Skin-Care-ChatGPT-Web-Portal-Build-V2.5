# Local RTX 5080 AI qualification

The local Ollama runtime is a development and controlled-evaluation resource. It is not a
public production origin and must never be reachable from the internet, Cloudflare DNS,
Google load balancing or a router port-forward.

Approved baseline:

- listener: `127.0.0.1:11434` or `::1:11434` only;
- primary reasoning: `deepseek-r1:8b`;
- secondary conversation: `qwen3.5:4b`;
- embeddings: `nomic-embed-text:latest`;
- synthetic health prompts only during qualification;
- no customer images or profile data until the local photo-analysis privacy gate passes.

Run a read-only inventory and health check:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/Test-Team47LocalAI.ps1
```

Run short synthetic inference checks after the inventory passes:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/Test-Team47LocalAI.ps1 -RunInference
```

Do not set `OLLAMA_HOST=0.0.0.0`, create a public tunnel, publish port 11434, or put a
Cloudflare record in front of the local runtime. Remote production inference belongs behind
the private broker described in `infra/gcp/phase3-ai`.
