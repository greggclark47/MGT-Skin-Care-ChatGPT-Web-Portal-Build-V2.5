"""The agent roster: who drafts what, with which rules. Loaded from t47/data/agents.json."""
from __future__ import annotations

from dataclasses import dataclass, field

from t47.util import load_data

PROMPT_VERSION = "t47-agents-1.0.0"


@dataclass(frozen=True)
class Agent:
    id: str
    name: str
    origin: str
    role: str
    channel: str
    external_action: str
    profile: str
    system: str
    contract: str
    think: bool = False
    temperature: float = 0.3
    num_predict: int = 600
    max_words: int = 200
    required_tokens: tuple[str, ...] = ()
    format: str | None = None
    json_keys: tuple[str, ...] = field(default_factory=tuple)

    @property
    def public(self) -> dict:
        return {"id": self.id, "name": self.name, "origin": self.origin, "role": self.role, "channel": self.channel,
                "external_action": self.external_action, "mode": "draft_only", "human_review_required": True,
                "automatic_send": False, "automatic_publish": False, "automatic_scraping": False}


def load_roster() -> dict[str, Agent]:
    raw = load_data("agents.json")["agents"]
    roster: dict[str, Agent] = {}
    for agent_id, spec in raw.items():
        roster[agent_id] = Agent(
            id=agent_id, name=spec["name"], origin=spec["origin"], role=spec["role"], channel=spec["channel"],
            external_action=spec["external_action"], profile=spec["profile"], system=spec["system"], contract=spec["contract"],
            think=bool(spec.get("think", False)), temperature=float(spec.get("temperature", 0.3)),
            num_predict=int(spec.get("num_predict", 600)), max_words=int(spec.get("max_words", 200)),
            required_tokens=tuple(spec.get("required_tokens", [])), format=spec.get("format"),
            json_keys=tuple(spec.get("json_keys", [])))
    return roster


def get_agent(agent_id: str) -> Agent:
    roster = load_roster()
    if agent_id not in roster:
        raise KeyError(f"unknown agent: {agent_id}. Choose one of: {', '.join(roster)}")
    return roster[agent_id]
