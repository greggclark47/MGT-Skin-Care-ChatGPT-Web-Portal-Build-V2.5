"""Check and report containers shared by every diagnostic."""
from __future__ import annotations

from dataclasses import asdict, dataclass, field
from typing import Any

from t47.util import now_iso

STATUSES = ("pass", "info", "warn", "fail", "skipped")
ICON = {"pass": "PASS", "info": "INFO", "warn": "WARN", "fail": "FAIL", "skipped": "SKIP"}


@dataclass
class Check:
    id: str
    title: str
    status: str
    detail: str = ""
    evidence: dict[str, Any] = field(default_factory=dict)

    def __post_init__(self) -> None:
        if self.status not in STATUSES:
            raise ValueError(f"unknown status: {self.status}")


@dataclass
class Report:
    name: str
    target: str
    checks: list[Check] = field(default_factory=list)
    generated_at: str = field(default_factory=now_iso)
    notes: list[str] = field(default_factory=list)

    def add(self, id: str, title: str, status: str, detail: str = "", /, **evidence: Any) -> Check:
        """Record one check. The four fields are positional-only so evidence may use any keyword, including `status`."""
        check = Check(id, title, status, detail, evidence)
        self.checks.append(check)
        return check

    @property
    def counts(self) -> dict[str, int]:
        return {s: sum(1 for c in self.checks if c.status == s) for s in STATUSES}

    @property
    def ok(self) -> bool:
        return self.counts["fail"] == 0

    def to_dict(self) -> dict[str, Any]:
        return {"name": self.name, "target": self.target, "generated_at": self.generated_at, "counts": self.counts,
                "ok": self.ok, "notes": self.notes, "checks": [asdict(c) for c in self.checks]}

    def to_markdown(self) -> str:
        c = self.counts
        lines = [f"# {self.name}", "", f"Target: `{self.target}`  ", f"Generated: {self.generated_at}  ",
                 f"Result: {c['pass']} pass, {c['warn']} warn, {c['fail']} fail, {c['info']} info, {c['skipped']} skipped", ""]
        if self.notes:
            lines += [f"> {n}" for n in self.notes] + [""]
        lines += ["| Status | Check | Detail |", "|---|---|---|"]
        for check in self.checks:
            detail = check.detail.replace("|", "\\|").replace("\n", " ")
            lines.append(f"| {ICON[check.status]} | {check.title} | {detail} |")
        return "\n".join(lines) + "\n"
