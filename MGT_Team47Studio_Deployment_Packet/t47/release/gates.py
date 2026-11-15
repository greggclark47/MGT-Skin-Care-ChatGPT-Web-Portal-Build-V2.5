"""One view over the release gates. The decision is mechanical: a platform ships only when every P0 gate that
applies to it has been accepted by the owner with an evidence reference. This tool never accepts a gate itself.
"""
from __future__ import annotations

import json
from pathlib import Path

from t47.util import load_data, now_iso

STATUSES = ("open", "reported", "accepted")
PLATFORMS = ("web", "android", "ios", "ops")


def load_catalog() -> list[dict]:
    return load_data("gates.json")["gates"]


def initial_state() -> dict:
    """Everything starts open, or 'reported' where a document already records the work. Nothing starts accepted."""
    state = {}
    for gate in load_catalog():
        reported = gate.get("reported")
        state[gate["id"]] = {"status": "reported" if reported else "open", "evidence": "", "note": reported or "",
                             "accepted_by": "", "updated_at": now_iso()}
    return state


def load_state(path: str | Path) -> dict:
    file = Path(path)
    if not file.is_file():
        return initial_state()
    state = json.loads(file.read_text(encoding="utf-8"))
    for gate_id, entry in initial_state().items():  # gates added to the catalog later appear as open
        state.setdefault(gate_id, entry)
    return state


def save_state(path: str | Path, state: dict) -> None:
    file = Path(path)
    file.parent.mkdir(parents=True, exist_ok=True)
    file.write_text(json.dumps(state, indent=2), encoding="utf-8")


def set_gate(state: dict, gate_id: str, status: str, *, evidence: str = "", note: str = "", by: str = "") -> dict:
    """Record a gate status. Acceptance needs an evidence reference and the name of the person accepting it."""
    if gate_id not in {g["id"] for g in load_catalog()}:
        raise KeyError(f"unknown gate: {gate_id}")
    if status not in STATUSES:
        raise ValueError(f"status must be one of: {', '.join(STATUSES)}")
    by = by.strip()
    if status == "accepted":
        if not evidence.strip():
            raise ValueError("an accepted gate needs an evidence reference (a document id, a path or a link)")
        if not by or by.lower().startswith("agent:"):
            raise ValueError("an accepted gate needs the name of the person accepting it; an agent identity cannot accept a gate")
    state[gate_id] = {"status": status, "evidence": evidence.strip(), "note": note.strip() or state.get(gate_id, {}).get("note", ""),
                      "accepted_by": by if status == "accepted" else "", "updated_at": now_iso()}
    return state


def evaluate(platform: str, state: dict | None = None) -> dict:
    if platform not in PLATFORMS:
        raise ValueError(f"platform must be one of: {', '.join(PLATFORMS)}")
    state = state if state is not None else initial_state()
    gates = [g for g in load_catalog() if platform in g["platforms"]]

    def pending(priority: str) -> list[dict]:
        return [{"id": g["id"], "title": g["title"], "status": state[g["id"]]["status"], "owner": g["owner"], "evidence": g["evidence"]}
                for g in gates if g["priority"] == priority and state[g["id"]]["status"] != "accepted"]

    blockers, readiness, later = pending("P0"), pending("P1"), pending("P2")
    return {"platform": platform, "decision": "HOLD" if blockers else "SHIP", "gates": len(gates),
            "accepted": sum(1 for g in gates if state[g["id"]]["status"] == "accepted"),
            "reported": sum(1 for g in gates if state[g["id"]]["status"] == "reported"),
            "blockers": blockers, "launch_readiness_open": readiness, "later_open": later,
            "broad_marketing_ready": not blockers and not readiness}


def render(state: dict | None = None, platforms: tuple[str, ...] = PLATFORMS) -> str:
    state = state if state is not None else initial_state()
    lines = ["# Release gate status", "", f"Generated: {now_iso()}", "",
             "A platform ships only when every P0 gate that applies to it is accepted with evidence. "
             "'reported' means a document says the work was done and the owner has not yet accepted it.", "",
             "| Platform | Decision | Accepted | Reported | Open P0 | Open P1 | Open P2 |", "|---|---|---|---|---|---|---|"]
    results = [evaluate(p, state) for p in platforms]
    for r in results:
        lines.append(f"| {r['platform']} | **{r['decision']}** | {r['accepted']}/{r['gates']} | {r['reported']} | "
                     f"{len(r['blockers'])} | {len(r['launch_readiness_open'])} | {len(r['later_open'])} |")
    for r in results:
        lines += ["", f"## {r['platform']}: {r['decision']}", ""]
        if not r["blockers"]:
            lines.append("No open P0 gates.")
        for g in r["blockers"]:
            lines.append(f"- {g['id']} ({g['status']}): {g['title']}. Evidence: {g['evidence']}. Owner: {g['owner']}.")
    return "\n".join(lines) + "\n"
