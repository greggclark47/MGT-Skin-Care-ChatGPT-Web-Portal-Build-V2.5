# 03 AI and agent operations

Version 1.2.0, 2026-11-16.

## 1. How the pieces fit

The operator talks to OpenClaw. OpenClaw runs on a local Ollama model and can call exactly four tools on the `t47` MCP server: list the drafting agents, create a draft, list the queue, read one run. `t47` builds the prompt, calls the local model, scans the draft with deterministic rules, and stores it in a SQLite review queue. A named person reviews at the CLI. An approved draft is exported as a signed-digest artifact. Delivery is outside the package.

OpenClaw is the driver, not the authority: it has no tool to approve, export, send, browse, run commands, write files or schedule jobs. The fragment denies those tool groups and sandboxes every session. OpenClaw's own documentation notes that local models come without a hosted provider's safety filters, which is the reason the guardrails here are code and the last step is a person.

## 2. Agent roster

| Agent | Origin | Local model role | Output | Guardrail profile |
|---|---|---|---|---|
| `customer_care` | existing in the portal | drafting | support reply | care |
| `gtm_strategy` | existing, blocked in the portal (deprecated hosted model) | reasoning | JSON brief with eight required keys | internal |
| `social_engagement` | existing | drafting | short post | social |
| `marketing_promotions` | existing | drafting | email with unsubscribe and postal-address placeholders | email |
| `retailer_partnerships` | existing | reasoning | first-contact outreach | partner |
| `retention_lifecycle` | proposed here | drafting | member retention email | email |

Ids, names, channels and the four existing system prompts are copied from `apps/api/src/portal/agent-operations.ts` at `1ef5c51`. Re-homing `gtm_strategy` on a local open-weight model removes its blocker without a hosted dependency. That is a proposal until the bake-off confirms the JSON contract holds on the workstation.

## 3. Guardrails

Rules are regular expressions, so the same draft always gets the same verdict. `blocked` cannot be submitted. `review` findings are shown to the reviewer. Covered: credentials, HIPAA claims, diagnosis, treatment and cure language, guaranteed outcomes, shame and corrective vocabulary, claims of having acted on an account, invented offers, partnerships and contact details (allowed only when the same words are in the operator's brief), profile traits in marketing copy, scraping, timeline and real-time claims, missing required placeholders, length.

Two limits to know. Rules catch phrasing, not meaning, so a careful reviewer still matters. And a negation within five words clears a negatable rule ("not a diagnosis"), which a determined writer could misuse; the reviewer sees the full draft.

### Deterministic triage for customer care (1.1.0)

Before any model call, a customer-care brief is checked for the four hard escalations in the D09 v3.9 handoff: a reaction or safety concern, a privacy or deletion request, a payment dispute, or a request for a person. A match produces a fixed reply and a flagged draft, with no model call. The reaction reply is fixed wording (stop, rinse, seek medical or emergency help, no assessment). This is cheaper and more predictable than asking a model, and it cannot be talked out of the rule.

A payment card number is refused in a brief and blocked in a draft (13 to 19 digits passing the Luhn check). Photos, scan results, card details and health information are the handoff's never-share list; this packet has no path that reads any of them.

## 4. Review flow

```
t47 agents run customer_care --brief "..." --source drive:<id>
t47 agents submit <run id>
t47 agents review <run id> --reviewer "Gregg Clark" --decision approve
t47 agents export <run id> --out approved.json
t47 agents verify approved.json
```

The reviewer must be a named person and cannot be the creator. By default the creator is the agent identity, so a sole operator can review. That is a human-in-the-loop control, not the portal's two-person control. For two-person control, create with `--created-by <person>` and have someone else review.

The export uses the portal's artifact shape and digest rule under its own schema id, `team47studio.local-agent-review-export.v1`, so a locally reviewed draft is never mistaken for one reviewed in the portal console.

## 5. Model plan

Incumbents stay: `qwen3.5:4b` for drafting and tool use, `deepseek-r1:8b` for reasoning, both measured on the RTX 5080 in the repository's 2026-11-06 report. Candidates to qualify, all open-weight and all screened against 16 GB: `gemma4:12b`, `gemma4:e4b` and `qwen3.5:9b` (6.6 GB) fit. `mistral-small3.2` is 15 GB, which leaves about 1 GB, so expect CPU spill; it is low priority. `qwen3.8:27b` is reported at 18 GB and would spill to CPU. Sizes and capabilities are published figures, not measurements; `t47 models list` shows the source of each.

**The rule.** `t47 models bakeoff` runs 15 synthetic cases (10 of them safety cases) on each model and prints PROPOSE only when the candidate has no request errors, fails no safety case, passes at least as many cases as the incumbent, stays inside a 30-second p95, and is better on one measure. PROPOSE is a recommendation. The repository's task registry changes only after the owner accepts it and the staging regression passes (gate G12).

Operating settings carried into the packet: thinking off for copy agents (the repository measured 416 reasoning tokens on a trivial prompt), 8,192-token context, native Ollama API. Two findings to fix in the repository regardless of any swap: `llava:latest` and `nomic-embed-text` are unpinned tags, and `gpt-5` is listed for removal on 2026-12-11.

## 6. Hardening checklist

1. `OLLAMA_HOST=127.0.0.1:11434`. No tunnel, no port forward.
2. Merge the fragment by hand; run `t47 openclaw audit`, `openclaw doctor`, and OpenClaw's security audit.
3. OpenClaw gateway bound to loopback with authentication on. The fragment does not set these; the audit reports them as not set.
4. No messaging channel connected to the `t47-*` agents.
5. Keep personal finance and credential files out of any folder an agent or connector can read.
6. Briefs marked `--data-class sensitive` or `biometric` never leave the workstation, even with the cloud fallback on.
7. Nightly `t47 backup agent-plane`; verify a restore monthly.

## 7. Not verified

The MCP server was exercised over stdio with protocol messages only. It has not been connected to the installed OpenClaw. The fragment uses only keys seen in OpenClaw's documentation on 2026-11-14; that schema moves, so `openclaw doctor` has the final word.
