"""A small MCP server (JSON-RPC 2.0 over stdio) that gives an OpenClaw agent three safe capabilities:
list the drafting agents, create a draft, read the review queue.

There is deliberately no tool to approve, export, send or publish. Those stay with a person at the CLI.
Verified here against the MCP message shapes in unit tests only; confirm it against the installed OpenClaw version.
"""
from __future__ import annotations

import json
import sys
from typing import Any, Callable

from t47 import __version__
from t47.agents.queue import QueueError, Store
from t47.agents.roster import load_roster
from t47.agents.runner import run_agent
from t47.config import Settings

SUPPORTED_PROTOCOLS = ("2025-06-18", "2025-03-26", "2024-11-05")
TOOLS = [
    {"name": "t47_list_agents", "description": "List the Team 47 Studio drafting agents. All are draft-only.",
     "inputSchema": {"type": "object", "properties": {}, "additionalProperties": False}},
    {"name": "t47_create_draft",
     "description": "Create one draft for human review. Sends nothing. Returns the run id and guardrail verdict.",
     "inputSchema": {"type": "object", "required": ["agent_id", "brief"], "additionalProperties": False, "properties": {
         "agent_id": {"type": "string"}, "brief": {"type": "string", "maxLength": 4000},
         "source_refs": {"type": "array", "items": {"type": "string"}, "maxItems": 20}}}},
    {"name": "t47_list_runs", "description": "List drafts in the review queue, newest first.",
     "inputSchema": {"type": "object", "additionalProperties": False, "properties": {
         "status": {"type": "string", "enum": ["draft", "pending_review", "approved", "rejected"]}}}},
    {"name": "t47_get_run", "description": "Read one draft and its guardrail findings.",
     "inputSchema": {"type": "object", "required": ["run_id"], "additionalProperties": False,
                     "properties": {"run_id": {"type": "string"}}}},
]


class McpServer:
    def __init__(self, settings: Settings, store: Store, clients: dict):
        self.settings, self.store, self.clients = settings, store, clients

    # ---- tools -------------------------------------------------------------------------------
    def _call(self, name: str, args: dict) -> Any:
        if name == "t47_list_agents":
            return {"agents": [a.public for a in load_roster().values()]}
        if name == "t47_create_draft":
            out = run_agent(args["agent_id"], args["brief"], settings=self.settings, store=self.store, clients=self.clients,
                            source_refs=args.get("source_refs", []))
            run = out["run"]
            return {"run_id": run["id"], "status": run["status"], "verdict": run["verdict"],
                    "findings": [{"rule": g["rule"], "severity": g["severity"], "message": g["message"]} for g in run["guardrail"]],
                    "draft": run["draft"], "next_step": "A named person reviews this with `t47 agents review`. Nothing was sent."}
        if name == "t47_list_runs":
            runs = self.store.list(status=args.get("status"))
            return {"runs": [{k: r[k] for k in ("id", "agent_id", "status", "verdict", "created_at")} for r in runs]}
        if name == "t47_get_run":
            run = self.store.get(args["run_id"])
            return {k: run[k] for k in ("id", "agent_id", "status", "verdict", "draft", "guardrail", "source_refs", "created_at")}
        raise KeyError(name)

    # ---- protocol ----------------------------------------------------------------------------
    def handle(self, message: dict) -> dict | None:
        method, msg_id = message.get("method"), message.get("id")
        if msg_id is None:  # notification: no reply
            return None

        def ok(result: Any) -> dict:
            return {"jsonrpc": "2.0", "id": msg_id, "result": result}

        def err(code: int, text: str) -> dict:
            return {"jsonrpc": "2.0", "id": msg_id, "error": {"code": code, "message": text}}

        if method == "initialize":
            asked = (message.get("params") or {}).get("protocolVersion")
            version = asked if asked in SUPPORTED_PROTOCOLS else SUPPORTED_PROTOCOLS[0]
            return ok({"protocolVersion": version, "capabilities": {"tools": {"listChanged": False}},
                       "serverInfo": {"name": "t47", "version": __version__}})
        if method == "ping":
            return ok({})
        if method == "tools/list":
            return ok({"tools": TOOLS})
        if method == "tools/call":
            params = message.get("params") or {}
            name, args = params.get("name"), params.get("arguments") or {}
            if name not in {t["name"] for t in TOOLS}:
                return err(-32602, f"unknown tool: {name}")
            try:
                payload, failed = self._call(name, args), False
            except (KeyError, ValueError, QueueError, RuntimeError) as exc:
                payload, failed = {"error": str(exc)}, True
            return ok({"content": [{"type": "text", "text": json.dumps(payload, ensure_ascii=False)}], "isError": failed})
        return err(-32601, f"method not found: {method}")

    def serve(self, stdin=sys.stdin, stdout=sys.stdout, log: Callable[[str], None] | None = None) -> None:
        for line in stdin:
            line = line.strip()
            if not line:
                continue
            try:
                message = json.loads(line)
            except ValueError:
                reply = {"jsonrpc": "2.0", "id": None, "error": {"code": -32700, "message": "parse error"}}
            else:
                reply = self.handle(message)
            if reply is not None:
                stdout.write(json.dumps(reply, ensure_ascii=False) + "\n")
                stdout.flush()
            if log:
                log(line[:120])
