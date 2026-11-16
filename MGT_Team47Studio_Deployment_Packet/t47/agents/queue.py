"""Local review queue for agent drafts (SQLite).

States: draft -> pending_review -> approved | rejected. Nothing here contacts anyone. The rules match the portal's
agent operations console: the creator cannot approve, and only an approved run can be exported.
"""
from __future__ import annotations

import json
import sqlite3
import uuid
from dataclasses import asdict
from pathlib import Path

from t47.agents.guardrails import Violation, verdict
from t47.util import now_iso

SCHEMA = """
CREATE TABLE IF NOT EXISTS runs (
  id TEXT PRIMARY KEY, agent_id TEXT NOT NULL, status TEXT NOT NULL, brief TEXT NOT NULL, draft TEXT NOT NULL,
  source_refs TEXT NOT NULL DEFAULT '[]', created_by TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
  reviewed_by TEXT, reviewed_at TEXT, review_decision TEXT, review_note TEXT,
  provider TEXT, model TEXT, prompt_version TEXT, latency_ms REAL,
  guardrail TEXT NOT NULL DEFAULT '[]', verdict TEXT NOT NULL DEFAULT 'clean');
CREATE TABLE IF NOT EXISTS audit (id INTEGER PRIMARY KEY AUTOINCREMENT, at TEXT NOT NULL, actor TEXT NOT NULL,
  action TEXT NOT NULL, target TEXT NOT NULL);
"""
STATUSES = ("draft", "pending_review", "approved", "rejected")


class QueueError(RuntimeError):
    pass


def is_agent_identity(actor: str) -> bool:
    return actor.startswith("agent:")


class Store:
    def __init__(self, path: str | Path):
        self.path = Path(path)
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self._db = sqlite3.connect(self.path)
        self._db.row_factory = sqlite3.Row
        self._db.executescript(SCHEMA)
        self._db.commit()

    def close(self) -> None:
        self._db.close()

    def _audit(self, actor: str, action: str, target: str) -> None:
        self._db.execute("INSERT INTO audit (at, actor, action, target) VALUES (?,?,?,?)", (now_iso(), actor, action, target))

    @staticmethod
    def _row(row: sqlite3.Row | None) -> dict:
        if row is None:
            raise QueueError("run not found")
        data = dict(row)
        data["source_refs"] = json.loads(data["source_refs"])
        data["guardrail"] = json.loads(data["guardrail"])
        return data

    def create(self, *, agent_id: str, brief: str, draft: str, source_refs: list[str], created_by: str,
               violations: list[Violation], provider: str | None = None, model: str | None = None,
               prompt_version: str | None = None, latency_ms: float | None = None) -> dict:
        run_id, now = f"agent_{uuid.uuid4()}", now_iso()
        self._db.execute(
            "INSERT INTO runs (id, agent_id, status, brief, draft, source_refs, created_by, created_at, updated_at, provider,"
            " model, prompt_version, latency_ms, guardrail, verdict) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
            (run_id, agent_id, "draft", brief, draft, json.dumps(source_refs), created_by, now, now, provider, model,
             prompt_version, latency_ms, json.dumps([asdict(v) for v in violations]), verdict(violations)))
        self._audit(created_by, "agent_draft_created", run_id)
        self._db.commit()
        return self.get(run_id)

    def get(self, run_id: str) -> dict:
        return self._row(self._db.execute("SELECT * FROM runs WHERE id = ?", (run_id,)).fetchone())

    def list(self, *, status: str | None = None, agent_id: str | None = None, limit: int = 50) -> list[dict]:
        query, args = "SELECT * FROM runs", []
        clauses = [("status = ?", status), ("agent_id = ?", agent_id)]
        where = [c for c, v in clauses if v]
        args = [v for _, v in clauses if v]
        if where:
            query += " WHERE " + " AND ".join(where)
        query += " ORDER BY created_at DESC LIMIT ?"
        return [self._row(r) for r in self._db.execute(query, (*args, limit)).fetchall()]

    def replace_draft(self, run_id: str, draft: str, violations: list[Violation], actor: str) -> dict:
        run = self.get(run_id)
        if run["status"] != "draft":
            raise QueueError("only a draft can be edited")
        self._db.execute("UPDATE runs SET draft = ?, guardrail = ?, verdict = ?, updated_at = ? WHERE id = ?",
                         (draft, json.dumps([asdict(v) for v in violations]), verdict(violations), now_iso(), run_id))
        self._audit(actor, "agent_draft_edited", run_id)
        self._db.commit()
        return self.get(run_id)

    def submit(self, run_id: str, actor: str) -> dict:
        run = self.get(run_id)
        if run["status"] != "draft":
            raise QueueError(f"run is {run['status']}; only a draft can be submitted")
        if run["verdict"] == "blocked":
            raise QueueError("draft has blocking guardrail findings; rerun the agent or edit the draft first")
        self._db.execute("UPDATE runs SET status = 'pending_review', updated_at = ? WHERE id = ?", (now_iso(), run_id))
        self._audit(actor, "agent_draft_submitted", run_id)
        self._db.commit()
        return self.get(run_id)

    def review(self, run_id: str, reviewer: str, decision: str, note: str = "") -> dict:
        if decision not in ("approve", "reject"):
            raise QueueError("decision must be approve or reject")
        run = self.get(run_id)
        if run["status"] != "pending_review":
            raise QueueError(f"run is {run['status']}; only a pending review can be decided")
        if not reviewer.strip() or is_agent_identity(reviewer):
            raise QueueError("a named human reviewer is required")
        if reviewer == run["created_by"]:
            raise QueueError("the creator of a draft cannot approve or reject it")
        status, now = ("approved" if decision == "approve" else "rejected"), now_iso()
        self._db.execute("UPDATE runs SET status = ?, reviewed_by = ?, reviewed_at = ?, review_decision = ?, review_note = ?,"
                         " updated_at = ? WHERE id = ?", (status, reviewer, now, decision, note[:500], now, run_id))
        self._audit(reviewer, f"agent_draft_{status}", run_id)
        self._db.commit()
        return self.get(run_id)

    def record_export(self, run_id: str, actor: str) -> None:
        self._audit(actor, "agent_draft_exported", run_id)
        self._db.commit()

    def audit_log(self, limit: int = 100) -> list[dict]:
        return [dict(r) for r in self._db.execute("SELECT at, actor, action, target FROM audit ORDER BY id DESC LIMIT ?", (limit,))]
