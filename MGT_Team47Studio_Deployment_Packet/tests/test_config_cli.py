import json

import pytest

from t47 import __version__
from t47.cli import build_parser, main
from t47.config import Settings, load_settings


def run(capsys, *argv, expect=0):
    code = main(list(argv))
    captured = capsys.readouterr()
    assert code == expect, captured.err or captured.out
    return captured.out, captured.err


@pytest.fixture
def cfg(tmp_path, monkeypatch):
    """A config file pointing the state directory at a temp folder; the CLI picks it up from $T47_CONFIG."""
    path = tmp_path / "t47.toml"
    path.write_text(f'[paths]\nstate_dir = "{(tmp_path / "state").as_posix()}"\n', encoding="utf-8")
    monkeypatch.setenv("T47_CONFIG", str(path))
    monkeypatch.delenv("T47_BACKUP_KEY", raising=False)
    return tmp_path


# ---- config ----

def test_defaults_are_valid_and_local_first():
    settings = Settings()
    assert settings.validate() == [] and settings.cloud_enabled is False and settings.ollama_base_url.startswith("http://127.0.0.1")


def test_validation_rules():
    assert any("loopback" in e for e in Settings(ollama_base_url="http://10.0.0.5:11434").validate())
    assert Settings(ollama_base_url="http://10.0.0.5:11434", allow_remote_ollama=True).validate() == []
    assert any("/v1" in e for e in Settings(ollama_base_url="http://127.0.0.1:11434/v1").validate())
    assert any("https" in e for e in Settings(site_origin="http://team47studio.com").validate())
    assert any("https" in e for e in Settings(cloud_enabled=True, cloud_base_url="http://ollama.com").validate())
    assert any("vram" in e for e in Settings(vram_gb=0).validate())
    assert any("drafting" in e for e in Settings(models={"reasoning": "x"}).validate())


def test_load_settings_reads_toml_and_refuses_secrets(tmp_path, monkeypatch):
    monkeypatch.delenv("T47_CONFIG", raising=False)
    monkeypatch.chdir(tmp_path)
    assert load_settings().source == "defaults"
    good = tmp_path / "good.toml"
    good.write_text('[site]\norigin = "https://team47studio.com"\n[ollama]\nbase_url = "http://localhost:11434/"\nnum_ctx = 16384\n'
                    '[ollama_cloud]\nenabled = true\napi_key_env = "MY_KEY"\n[models]\ndrafting = "gemma4:12b"\n'
                    '[hardware]\nvram_gb = 16\n[paths]\nrepo = "C:/src/t47"\n[operator]\nagent_identity = "agent:ops"\n', encoding="utf-8")
    settings = load_settings(str(good))
    assert settings.ollama_base_url == "http://localhost:11434" and settings.num_ctx == 16384 and settings.cloud_enabled is True
    assert settings.models == {"drafting": "gemma4:12b", "reasoning": "deepseek-r1:8b", "embedding": "nomic-embed-text"}
    assert settings.cloud_api_key_env == "MY_KEY" and settings.cloud_api_key is None and settings.repo_path == "C:/src/t47"
    monkeypatch.setenv("MY_KEY", "value-from-environment")
    assert settings.cloud_api_key == "value-from-environment"
    bad = tmp_path / "bad.toml"
    bad.write_text('[ollama_cloud]\napi_key = "sk-something-pasted-here"\n', encoding="utf-8")
    with pytest.raises(ValueError, match="must not contain secret"):
        load_settings(str(bad))
    with pytest.raises(FileNotFoundError):
        load_settings(str(tmp_path / "absent.toml"))
    (tmp_path / "config").mkdir()
    (tmp_path / "config" / "t47.toml").write_text('[hardware]\nvram_gb = 24\n', encoding="utf-8")
    assert load_settings().vram_gb == 24  # ./config/t47.toml is found automatically


def test_shipped_example_config_loads(monkeypatch):
    from pathlib import Path

    example = Path(__file__).resolve().parents[1] / "config" / "t47.example.toml"
    settings = load_settings(str(example))
    assert settings.validate() == [] and settings.cloud_enabled is False


# ---- CLI ----

def test_parser_builds_and_version(capsys):
    assert build_parser().prog == "t47"
    out, _ = run(capsys, "version")
    assert out.strip() == f"t47 {__version__}"
    with pytest.raises(SystemExit):
        main(["nonsense"])


def test_config_show_and_bad_config(cfg, capsys, monkeypatch):
    out, _ = run(capsys, "config", "show", "--json")
    assert json.loads(out)["errors"] == []
    bad = cfg / "bad.toml"
    bad.write_text('[ollama]\nbase_url = "http://203.0.113.9:11434"\n', encoding="utf-8")
    monkeypatch.setenv("T47_CONFIG", str(bad))
    out, _ = run(capsys, "config", "show", expect=1)
    assert "loopback" in out
    _, err = run(capsys, "agents", "list", expect=2)
    assert "configuration has problems" in err


def test_read_only_listings(cfg, capsys):
    pytest.importorskip("t47.gtm.calendar")  # private packet only
    out, _ = run(capsys, "agents", "list")
    assert "customer_care" in out and "draft only" in out
    out, _ = run(capsys, "models", "list", "--json")
    assert {r["id"] for r in json.loads(out)} >= {"qwen3.5:4b", "gemma4:12b"}
    out, _ = run(capsys, "gtm", "calendar")
    assert "planned items" in out and "Paid search" in out
    out, _ = run(capsys, "gtm", "calendar", "--format", "csv", "--start", "2027-01-11")
    assert out.splitlines()[0].startswith("week,week_start") and "2027-01-11" in out
    _, err = run(capsys, "gtm", "calendar", "--start", "soon", expect=2)
    assert "YYYY" in err or "date" in err
    out, _ = run(capsys, "gtm", "utm", "--url", "https://team47studio.com/skin-match", "--source", "instagram", "--medium", "social",
                 "--campaign", "skin-match-launch")
    assert out.strip().endswith("utm_campaign=skin-match-launch")
    _, err = run(capsys, "gtm", "utm", "--url", "https://team47studio.com/", "--source", "a", "--medium", "email", "--campaign", "user-99",
                 expect=2)
    assert "personal" in err


def test_economics_commands(cfg, capsys):
    pytest.importorskip("t47.gtm.calendar")  # private packet only
    out, _ = run(capsys, "economics", "summary", "--preset", "B", "--json")
    assert [r["scenario"] for r in json.loads(out)] == ["LEAN", "BASE", "GROWTH"]
    out, _ = run(capsys, "economics", "summary")
    assert "Break-even paid subscribers" in out and "not forecasts" in out
    out, _ = run(capsys, "economics", "local-vs-hosted", "--tokens-in-m", "20", "--tokens-out-m", "6")
    assert json.loads(out)["hosted_usd"] == pytest.approx(13.2)
    pytest.importorskip("openpyxl")
    target = cfg / "model.xlsx"
    run(capsys, "economics", "workbook", "--out", str(target))
    assert target.stat().st_size > 5000


def test_release_flow(cfg, capsys):
    out, _ = run(capsys, "release", "status")
    assert "| web | **HOLD** |" in out
    run(capsys, "release", "status", "--strict", expect=1)
    run(capsys, "release", "init")
    _, err = run(capsys, "release", "init", expect=2)
    assert "already exists" in err
    _, err = run(capsys, "release", "set", "G07", "--status", "accepted", "--evidence", "drive:abc123", expect=2)
    assert "person" in err
    run(capsys, "release", "set", "G07", "--status", "accepted", "--evidence", "drive:abc123", "--by", "Gregg Clark")
    out, _ = run(capsys, "release", "gates", "--json")
    gate = next(g for g in json.loads(out) if g["id"] == "G07")
    assert gate["status"] == "accepted" and gate["accepted_by"] == "Gregg Clark" and gate["evidence_on_file"] == "drive:abc123"
    out, _ = run(capsys, "release", "status", "--platform", "ops", "--json")
    assert json.loads(out)["ops"]["decision"] == "HOLD" and json.loads(out)["ops"]["blockers"][0]["id"] == "G23"
    run(capsys, "release", "set", "G23", "--status", "accepted", "--evidence", "bakeoff-20261120.md", "--by", "Gregg Clark")
    out, _ = run(capsys, "release", "status", "--platform", "ops", "--json")
    assert json.loads(out)["ops"]["decision"] == "SHIP"


def test_agent_queue_flow_without_a_model(cfg, capsys, monkeypatch):
    out, _ = run(capsys, "agents", "run", "customer_care", "--brief", "Reply to a password question.", "--dry-run")
    plan = json.loads(out)
    assert plan["dry_run"] is True and plan["chain"][0] == ["ollama", "qwen3.5:4b"]
    _, err = run(capsys, "agents", "run", "customer_care", expect=2)
    assert "--brief" in err
    out, _ = run(capsys, "agents", "queue")
    assert "empty" in out

    from t47.models import ollama

    def fake_chat(self, model, messages, **options):
        return ollama.ChatResult(provider="ollama", model=model, content="Thanks for writing. A team member can help from the Support page.",
                                 total_ms=900.0, tokens_per_s=42.0)

    monkeypatch.setattr(ollama.OllamaClient, "chat", fake_chat)
    out, _ = run(capsys, "agents", "run", "customer_care", "--brief", "Reply to a password question.", "--json")
    run_id = json.loads(out)["run"]["id"]
    out, _ = run(capsys, "agents", "show", run_id)
    assert "Guardrail verdict: clean" in out
    _, err = run(capsys, "agents", "export", run_id, expect=2)
    assert "approved" in err
    run(capsys, "agents", "submit", run_id, "--actor", "gregg")
    _, err = run(capsys, "agents", "review", run_id, "--reviewer", "agent:t47-local", "--decision", "approve", expect=2)
    assert "named human" in err
    out, _ = run(capsys, "agents", "review", run_id, "--reviewer", "gregg", "--decision", "approve", "--note", "ok")
    assert "Nothing was sent" in out
    artifact_path = cfg / "export.json"
    run(capsys, "agents", "export", run_id, "--out", str(artifact_path), "--actor", "gregg")
    artifact = json.loads(artifact_path.read_text(encoding="utf-8"))
    assert artifact["controls"]["automatic_send"] is False and artifact["origin"] == "local_agent_plane"
    out, _ = run(capsys, "agents", "verify", str(artifact_path))
    assert "unchanged" in out
    artifact["draft"] += " Edited after review."
    artifact_path.write_text(json.dumps(artifact), encoding="utf-8")
    out, _ = run(capsys, "agents", "verify", str(artifact_path), expect=1)
    assert "MISMATCH" in out
    out, _ = run(capsys, "agents", "audit", "--json")
    assert [e["action"] for e in json.loads(out)][:2] == ["agent_draft_exported", "agent_draft_approved"]


def test_blocked_draft_exits_nonzero_and_can_be_edited(cfg, capsys, monkeypatch):
    from t47.models import ollama

    monkeypatch.setattr(ollama.OllamaClient, "chat", lambda self, model, messages, **o: ollama.ChatResult(
        provider="ollama", model=model, content="I've reset your password. Guaranteed results!"))
    out, _ = run(capsys, "agents", "run", "customer_care", "--brief", "Reply to a password question.", "--json", "--submit", expect=1)
    run_id = json.loads(out)["run"]["id"]
    assert json.loads(out)["run"]["status"] == "draft"  # --submit does not override a block
    _, err = run(capsys, "agents", "submit", run_id, expect=2)
    assert "blocking" in err
    fixed = cfg / "fixed.txt"
    fixed.write_text("You can reset your password from the sign-in page. A team member can help from the Support page.", encoding="utf-8")
    out, _ = run(capsys, "agents", "edit", run_id, "--file", str(fixed), "--actor", "gregg", "--json")
    assert json.loads(out)["verdict"] == "clean"
    run(capsys, "agents", "submit", run_id, "--actor", "gregg")


def test_openclaw_and_backup_commands(cfg, capsys, monkeypatch):
    fragment = cfg / "fragment.json5"
    run(capsys, "openclaw", "render", "--out", str(fragment), "--workspace-out", str(cfg / "AGENTS.md"))
    out, _ = run(capsys, "openclaw", "audit", str(fragment))
    assert "FAIL" not in out and "t47 MCP server registered" in out
    assert "never act on the outside world" in (cfg / "AGENTS.md").read_text(encoding="utf-8")
    out, _ = run(capsys, "backup", "drill", "--commit", "b" * 40, "--evidence-out", str(cfg / "evidence.json"))
    assert "pnpm backup:restore-test" in out and json.loads((cfg / "evidence.json").read_text())["candidate_commit"] == "b" * 40

    pytest.importorskip("cryptography")
    _, err = run(capsys, "backup", "agent-plane", expect=2)
    assert "T47_BACKUP_KEY" in err
    monkeypatch.setenv("T47_BACKUP_KEY", "ab" * 32)
    run(capsys, "release", "init")  # something to back up
    out, _ = run(capsys, "backup", "agent-plane")
    receipt = json.loads(out)
    assert receipt["verified_at"] and receipt["files"] == 1
    out, _ = run(capsys, "backup", "verify", receipt["file"])
    assert json.loads(out)["ok"] is True
    out, _ = run(capsys, "backup", "restore", receipt["file"], "--dest", str(cfg / "restored"))
    assert (cfg / "restored" / "gates.json").is_file()
    import shutil
    from pathlib import Path

    older = Path(receipt["file"]).with_name("agent-plane-20260101T023000Z.t47enc.json")
    shutil.copy(receipt["file"], older)
    shutil.copy(receipt["file"] + ".receipt.json", str(older) + ".receipt.json")
    out, _ = run(capsys, "backup", "prune", "--daily", "1", "--weekly", "0")
    plan = json.loads(out)
    assert plan["applied"] is False and plan["deleted"] == [] and plan["prune"] == [older.name] and older.is_file()
    out, _ = run(capsys, "backup", "prune", "--daily", "1", "--weekly", "0", "--apply")
    assert len(json.loads(out)["deleted"]) == 2 and not older.exists()  # the archive and its receipt
    out, _ = run(capsys, "backup", "prune", "--daily", "0", "--weekly", "0", "--apply")
    assert json.loads(out)["prune"] == [] and Path(receipt["file"]).is_file()  # the newest backup is never pruned


def test_diagnostics_commands_offline(cfg, capsys, tmp_path):
    _, err = run(capsys, "diagnostics", "repo", expect=2)
    assert "--repo" in err
    out, _ = run(capsys, "diagnostics", "repo", "--repo", str(tmp_path / "absent"), expect=1)
    assert "FAIL" in out
    pytest.importorskip("PIL")
    out, _ = run(capsys, "release", "assets", str(tmp_path), expect=1)
    assert "no images" in out
