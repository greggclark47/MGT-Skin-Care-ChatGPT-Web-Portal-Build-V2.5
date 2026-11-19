import io
import json

from t47.mcp import SUPPORTED_PROTOCOLS, TOOLS, McpServer
from t47.openclaw.audit import audit_config, audit_file, parse_json5
from t47.openclaw.render import DENY_TOOLS, WORKSPACE_AGENTS_MD, build_fragment, render_fragment


def statuses(report):
    return {c.id: c.status for c in report.checks}


# ---- JSON5 ----

def test_parse_json5_subset():
    text = """// leading comment
    {
      gateway: { bind: 'loopback', /* inline */ port: 18789, },
      "tools": { deny: ["exec", 'browser',], elevated: { enabled: false } },
      url: "https://example.com/a//b",   // a URL is not a comment
      quote: 'it\\'s "fine"',
      nested: [ { a: 1, }, ],
    }"""
    data = parse_json5(text)
    assert data["gateway"] == {"bind": "loopback", "port": 18789}
    assert data["tools"]["deny"] == ["exec", "browser"] and data["tools"]["elevated"]["enabled"] is False
    assert data["url"] == "https://example.com/a//b" and data["quote"] == 'it\'s "fine"' and data["nested"] == [{"a": 1}]
    assert parse_json5('{"plain": true, "n": null}') == {"plain": True, "n": None}


# ---- fragment ----

def test_fragment_is_least_privilege(settings):
    fragment = build_fragment(settings)
    provider = fragment["models"]["providers"]["ollama"]
    assert provider["baseUrl"] == "http://127.0.0.1:11434" and provider["api"] == "ollama" and "/v1" not in provider["baseUrl"]
    assert fragment["tools"]["elevated"]["enabled"] is False and fragment["tools"]["openclaw"]["autoApproveChanges"] is False
    assert {"exec", "browser", "group:fs", "group:messaging"} <= set(fragment["tools"]["deny"])
    assert fragment["agents"]["defaults"]["sandbox"]["mode"] == "all"
    for entry in fragment["agents"]["entries"].values():
        assert entry["tools"] == {"profile": "minimal", "deny": DENY_TOOLS} and entry["sandbox"]["mode"] == "all"
        assert entry["model"]["primary"].startswith("ollama/") and all(f.startswith("ollama/") for f in entry["model"]["fallbacks"])
    assert fragment["mcp"]["servers"]["t47"]["args"] == ["-m", "t47", "mcp", "serve"]
    assert "apiKey" in provider and provider["apiKey"] == "ollama-local"  # placeholder the local provider expects, not a secret


def test_fragment_adds_cloud_fallback_only_when_enabled(settings):
    settings.cloud_enabled = True
    fallbacks = build_fragment(settings)["agents"]["entries"]["t47-ops"]["model"]["fallbacks"]
    assert fallbacks[-1] == "ollama-cloud/deepseek-v4.1-flash:cloud"


def test_rendered_fragment_parses_and_passes_its_own_audit(settings, tmp_path):
    text = render_fragment(settings)
    assert text.startswith("//") and parse_json5(text) == build_fragment(settings)
    file = tmp_path / "openclaw.json"
    file.write_text(text, encoding="utf-8")
    report = audit_file(str(file))
    got = statuses(report)
    assert report.ok and "warn" not in got.values()
    assert got["claw.agents"] == "pass" and got["claw.mcp"] == "pass" and got["claw.agent.t47-ops"] == "pass"
    assert "send" in WORKSPACE_AGENTS_MD.lower() and "t47_create_draft" in WORKSPACE_AGENTS_MD


# ---- audit ----

def test_audit_flags_risky_config_without_printing_secrets():
    secret = "sk-live-0123456789abcdefghijklmnop"
    config = {"models": {"providers": {"ollama": {"baseUrl": "http://192.168.1.20:11434/v1", "api": "openai"}}},
              "tools": {"elevated": {"enabled": True}, "deny": [], "openclaw": {"autoApproveChanges": True}},
              "gateway": {"bind": "0.0.0.0", "auth": {"token": secret}},
              "channels": {"telegram": {"botToken": secret}, "discord": {"token": "${DISCORD_TOKEN}"}, "slack": {"token": "SLACK_BOT_TOKEN"}},
              "agents": {"entries": {"t47-ops": {"tools": {"profile": "full"}}}}}
    report = audit_config(config)
    got = statuses(report)
    assert got["claw.provider"] == "warn" and got["claw.provider.native"] == "fail"
    assert got["claw.elevated"] == "fail" and got["claw.deny"] == "warn" and got["claw.autoapprove"] == "fail"
    assert got["claw.gateway.bind"] == "fail" and got["claw.secrets"] == "warn" and got["claw.agent.t47-ops"] == "warn"
    assert not report.ok
    dumped = json.dumps(report.to_dict()) + report.to_markdown()
    assert secret not in dumped
    secrets_detail = next(c.detail for c in report.checks if c.id == "claw.secrets")
    assert "gateway.auth.token" in secrets_detail and "channels.telegram.botToken" in secrets_detail
    assert "discord" not in secrets_detail and "slack" not in secrets_detail  # environment references are fine


def test_audit_tolerates_missing_keys_and_bad_files(tmp_path):
    got = statuses(audit_config({}))
    assert got["claw.provider"] == "info" and got["claw.elevated"] == "pass" and got["claw.sandbox"] == "warn" and got["claw.mcp"] == "info"
    bad = tmp_path / "broken.json"
    bad.write_text("{ not: valid: json5 ", encoding="utf-8")
    assert statuses(audit_file(str(bad))) == {"claw.parse": "fail"}
    assert statuses(audit_file(str(tmp_path / "absent.json"))) == {"claw.parse": "fail"}
    listy = tmp_path / "list.json"
    listy.write_text("[1, 2]", encoding="utf-8")
    assert statuses(audit_file(str(listy))) == {"claw.parse": "fail"}


# ---- MCP ----

def server(settings, store, fake_client, reply="Thanks for writing. A team member can help from the Support page."):
    return McpServer(settings, store, {"ollama": fake_client({"*": reply})})


def call(srv, method, params=None, msg_id=1):
    return srv.handle({"jsonrpc": "2.0", "id": msg_id, "method": method, **({"params": params} if params is not None else {})})


def test_mcp_handshake_and_tool_list(settings, store, fake_client):
    srv = server(settings, store, fake_client)
    init = call(srv, "initialize", {"protocolVersion": "2025-03-26", "capabilities": {}, "clientInfo": {"name": "openclaw", "version": "x"}})
    assert init["result"]["protocolVersion"] == "2025-03-26" and init["result"]["serverInfo"]["name"] == "t47"
    assert call(srv, "initialize", {"protocolVersion": "1999-01-01"})["result"]["protocolVersion"] == SUPPORTED_PROTOCOLS[0]
    assert srv.handle({"jsonrpc": "2.0", "method": "notifications/initialized"}) is None
    assert call(srv, "ping")["result"] == {}
    names = [t["name"] for t in call(srv, "tools/list")["result"]["tools"]]
    assert names == ["t47_list_agents", "t47_create_draft", "t47_list_runs", "t47_get_run"]
    assert call(srv, "resources/list")["error"]["code"] == -32601


def test_mcp_exposes_no_way_to_approve_export_or_send():
    names = [tool["name"] for tool in TOOLS]
    assert names == ["t47_list_agents", "t47_create_draft", "t47_list_runs", "t47_get_run"]
    for name in names:
        assert not any(word in name for word in ("approve", "review", "export", "publish", "submit", "send", "delete", "gate", "edit"))
    assert all(tool["inputSchema"].get("additionalProperties") is False for tool in TOOLS)


def test_mcp_create_draft_then_read_it(settings, store, fake_client):
    srv = server(settings, store, fake_client)
    out = call(srv, "tools/call", {"name": "t47_create_draft", "arguments": {"agent_id": "customer_care", "brief": "Reply to a login question."}})
    payload = json.loads(out["result"]["content"][0]["text"])
    assert out["result"]["isError"] is False and payload["status"] == "draft" and payload["verdict"] == "clean"
    assert "Nothing was sent" in payload["next_step"]
    listing = json.loads(call(srv, "tools/call", {"name": "t47_list_runs", "arguments": {}})["result"]["content"][0]["text"])
    assert [r["id"] for r in listing["runs"]] == [payload["run_id"]]
    got = json.loads(call(srv, "tools/call", {"name": "t47_get_run", "arguments": {"run_id": payload["run_id"]}})["result"]["content"][0]["text"])
    assert got["draft"].startswith("Thanks for writing")
    assert store.get(payload["run_id"])["status"] == "draft"  # still a draft: the agent cannot move it


def test_mcp_errors_are_tool_errors_not_crashes(settings, store, fake_client):
    srv = server(settings, store, fake_client)
    bad_agent = call(srv, "tools/call", {"name": "t47_create_draft", "arguments": {"agent_id": "nobody", "brief": "x"}})
    assert bad_agent["result"]["isError"] is True and "unknown agent" in bad_agent["result"]["content"][0]["text"]
    assert call(srv, "tools/call", {"name": "t47_get_run", "arguments": {"run_id": "agent_missing"}})["result"]["isError"] is True
    assert call(srv, "tools/call", {"name": "t47_approve", "arguments": {}})["error"]["code"] == -32602
    assert call(srv, "tools/call", {"name": "t47_create_draft", "arguments": {"agent_id": "customer_care"}})["result"]["isError"] is True


def test_mcp_stdio_loop(settings, store, fake_client):
    srv = server(settings, store, fake_client)
    stdin = io.StringIO("\n".join([json.dumps({"jsonrpc": "2.0", "id": 1, "method": "ping"}), "", "{broken",
                                   json.dumps({"jsonrpc": "2.0", "method": "notifications/initialized"}),
                                   json.dumps({"jsonrpc": "2.0", "id": 2, "method": "tools/list"})]) + "\n")
    stdout = io.StringIO()
    srv.serve(stdin, stdout)
    replies = [json.loads(line) for line in stdout.getvalue().splitlines()]
    assert [r.get("id") for r in replies] == [1, None, 2]
    assert replies[1]["error"]["code"] == -32700 and len(replies[2]["result"]["tools"]) == 4
