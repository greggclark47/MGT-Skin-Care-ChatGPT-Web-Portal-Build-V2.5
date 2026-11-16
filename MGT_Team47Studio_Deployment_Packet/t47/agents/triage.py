"""Deterministic triage for customer care, run before any model call.

Mirrors the D09 v3.9 handoff (coach_pipeline step 1, care_hard_escalation): a reaction or safety concern, a privacy
or deletion request, a payment dispute, or a request for a person is never answered by a model. The reply is fixed
text and the draft is flagged so the reviewer routes it to a person. No model call also means no cost and no variance.
"""
from __future__ import annotations

import re
from dataclasses import dataclass

# Fixed wording. The reaction reply follows coach_limits.reaction_reply in handoff.spec.json: stop, rinse, seek help,
# never diagnose. No response time is promised anywhere (handoff locked rule 11).
REPLIES = {
    "reaction": ("Thank you for telling us. Please stop using the product and rinse the area gently with water. If symptoms are severe, "
                 "spreading or affecting your breathing, seek medical or emergency help now. We cannot assess symptoms here. "
                 "A team member will follow up about the product and your order."),
    "privacy": ("Thank you for your request. Privacy and deletion requests are handled by a team member, not by an automated reply. "
                "We have passed your message on and a team member will confirm the next step with you."),
    "payment_dispute": ("Thank you for flagging this. Billing questions are reviewed by a team member, who will look at the charge with you. "
                        "No change has been made to your account or payment yet."),
    "human": "Of course. We have passed your message to a team member, who will pick this up with you.",
}

_PATTERNS = [
    ("reaction", r"\b(rash|hives|swell\w*|swollen|blister\w*|burn(?:s|ed|ing)?|sting(?:s|ing)?|itch\w*|allergic|allergy|reaction|"
                 r"breaking out|broke out|irritat\w+|can'?t breathe|trouble breathing|anaphyla\w+)\b"),
    ("privacy", r"\b(delete (?:my|the) (?:account|data|profile|information)|erase (?:my|the) (?:account|data)|deletion request|"
                r"privacy request|data (?:subject )?request|right to (?:be forgotten|delete|access)|gdpr|ccpa|"
                r"(?:copy|export) of my data)\b"),
    ("payment_dispute", r"\b(charge ?back|dispute\w*|charged (?:me )?(?:twice|double|again)|double[- ]charg\w+|duplicate charge|"
                        r"unauthori[sz]ed (?:charge|payment|transaction)|fraud\w*|refund\w*|money back)\b"),
    ("human", r"\b(?:speak|talk|chat) (?:to|with) (?:a |an |the )?(?:real )?(?:person|human|agent|someone|representative|manager)\b|"
              r"\breal person\b|\bhuman (?:agent|being)\b"),
]
_COMPILED = [(kind, re.compile(pattern, re.I)) for kind, pattern in _PATTERNS]
_NOT_REACTION = re.compile(r"\b(no|not|without|never|free of)\b(?:\W+\w+){0,3}\W+$", re.I)


@dataclass(frozen=True)
class Escalation:
    kind: str
    match: str
    reply: str


def triage(brief: str) -> Escalation | None:
    """Return the first hard-escalation trigger in the brief, in priority order (safety first), or None."""
    for kind, pattern in _COMPILED:
        for found in pattern.finditer(brief):
            if kind == "reaction" and _NOT_REACTION.search(brief[:found.start()]):
                continue  # "no rash", "without irritation"
            return Escalation(kind, found.group(0)[:60], REPLIES[kind])
    return None
