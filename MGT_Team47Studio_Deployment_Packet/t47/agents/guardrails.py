"""Deterministic copy guardrails. A model drafts; these rules decide whether a human may even be asked to approve.

Rules are regular expressions with two refinements that keep them honest:
  * negation: "not a diagnosis" or "no guarantee" is the safe statement, not the claim, so a negation word in the
    five tokens before a match clears it for rules marked negatable;
  * operator-supplied facts: an offer, partnership or contact detail is allowed only when the same words appear in
    the operator's brief, so the model cannot invent one.
"""
from __future__ import annotations

import re
from dataclasses import dataclass

MAX_DRAFT_BYTES = 12_000  # same ceiling as the portal's agent-review export
NEGATIONS = {"not", "no", "never", "cannot", "can't", "cant", "isn't", "isnt", "aren't", "arent", "won't", "wont",
             "don't", "dont", "doesn't", "doesnt", "without", "nor", "neither", "non", "zero"}


@dataclass(frozen=True)
class Rule:
    id: str
    severity: str  # "block" stops submission; "review" is shown to the reviewer
    pattern: re.Pattern
    message: str
    negatable: bool = False
    allow_if_in_brief: bool = False


@dataclass(frozen=True)
class Violation:
    rule: str
    severity: str
    match: str
    message: str


def _rule(id: str, severity: str, pattern: str, message: str, **kw) -> Rule:
    return Rule(id, severity, re.compile(pattern, re.I), message, **kw)


RULES: dict[str, Rule] = {r.id: r for r in [
    _rule("secret", "block",
          r"sk-[A-Za-z0-9_-]{20,}|AKIA[0-9A-Z]{16}|ghp_[A-Za-z0-9]{30,}|-----BEGIN [A-Z ]*PRIVATE KEY-----|"
          r"\beyJ[A-Za-z0-9_-]{15,}\.[A-Za-z0-9_-]{15,}\.[A-Za-z0-9_-]{5,}",
          "Looks like a credential. Never place secrets in a draft."),
    _rule("hipaa_claim", "block", r"\bHIPAA[- ]?(?:compliant|certified|compliance)\b",
          "Do not claim HIPAA compliance.", negatable=True),
    _rule("medical_claim", "block",
          r"\b(?:cure[sd]?|curing|heals?|healed|healing|diagnos(?:e|es|ed|is|ing)|prescri(?:be|bes|bed|ption|ptions)|"
          r"clinically[- ]proven|medical[- ]grade|dermatologist[- ](?:approved|recommended))\b|"
          r"\btreat(?:s|ed|ing|ment)?(?: for)? (?:your )?(?:acne|eczema|rosacea|psoriasis|dermatitis|melasma|infections?|"
          r"diseases?|hair loss|alopecia|(?:skin |medical )?conditions?)\b",
          "Cosmetic guidance only: no diagnosis, treatment or cure language.", negatable=True),
    _rule("guaranteed_result", "block",
          r"\b(?:guarantee[sd]?|guaranteed|100% (?:effective|results?|satisfaction)|risk[- ]free|miracle|"
          r"(?:instant|overnight|flawless|permanent) results?|permanently (?:remove|eliminate|fix)\w*|"
          r"will (?:erase|eliminate|reverse) (?:wrinkles|aging|ageing|fine lines|acne|dark spots))\b",
          "No promised or guaranteed cosmetic outcomes.", negatable=True),
    _rule("timeline_claim", "review", r"\b(?:in|within) (?:just |only |as little as )?\d+\s?(?:days?|weeks?|hours?|minutes?)\b",
          "Timeline stated: confirm it has a source before approval."),
    _rule("shame_vocab", "block", r"\b(?:damaged|abused|over-?processed|fried|ruined|you should have)\b",
          "Shame vocabulary is not used, including on lift-refusal copy."),
    _rule("corrective_vocab", "block",
          r"\b(?:flatter(?:s|ing|ed)?|slim(?:s|ming|mer|med)?|problem areas?|body types?|disguis(?:e|es|ed|ing)|"
          r"camouflag(?:e|es|ed|ing))\b|\bhide (?:your|the|a)\b|\byour weight\b|\bbody shape\b|\bBMI\b",
          "Style copy states preferences, never corrections or body metrics."),
    _rule("action_claim", "block",
          r"\b(?:i|we)(?:'ve| have)?(?: just| already| now)? (?:reset|changed|updated|refunded|cancell?ed|deleted|sent|emailed|"
          r"contacted|scheduled|charged|upgraded|downgraded)\b|"
          r"\b(?:i|we)(?:'ll| will| am going to| are going to) (?:reset|change|update|refund|cancel|delete|send|email|"
          r"contact|schedule|charge|upgrade|downgrade)\b",
          "The agent drafts text only; it cannot claim to have acted on an account, payment or message."),
    _rule("partnership_claim", "block",
          r"\b(?:official|exclusive|authorized|proud) partners?(?:hip)?\b|\bin partnership with\b|\bpartner(?:ed|ing) with\b",
          "No partnership claim unless the operator supplied it.", allow_if_in_brief=True),
    _rule("invented_offer", "block",
          r"\b\d{1,3}\s?% off\b|\b(?:promo|discount|coupon) codes?\b|\bfree (?:trial|month|gift|shipping)\b|"
          r"\b(?:limited[- ]time|today only|last chance|act now|hurry)\b",
          "No discount, trial or urgency unless the operator supplied it.", allow_if_in_brief=True),
    _rule("sensitive_trait", "block",
          r"\b(?:your|you have|you've got) (?:acne|eczema|rosacea|wrinkles|dark spots|breakouts|oily skin|dry skin|"
          r"sensitive skin|skin condition|hair loss|thinning hair)\b",
          "Marketing copy must not use a person's profile traits."),
    _rule("pii", "block", r"[\w.+-]+@[\w-]+\.[\w.-]{2,}|(?<!\d)(?:\+?1[ .-])?\(?\d{3}\)?[ .-]\d{3}[ .-]\d{4}(?!\d)",
          "Contact details appear that the operator did not supply.", allow_if_in_brief=True),
    _rule("scrape_claim", "block", r"\b(?:scrap(?:e|es|ed|ing)|crawl(?:s|ed|ing)?|harvest(?:s|ed|ing)?|purchased (?:a )?list)\b",
          "No scraping, crawling or purchased lists.", negatable=True),
    _rule("realtime_claim", "review", r"\b(?:trending now|real[- ]time trends?|going viral)\b",
          "Real-time trend claim: the agent has no live monitoring."),
]}

_BASE = ["secret", "hipaa_claim", "medical_claim", "guaranteed_result", "timeline_claim"]
PROFILES: dict[str, list[str]] = {
    "care": _BASE + ["action_claim", "pii", "shame_vocab"],
    "social": _BASE + ["partnership_claim", "invented_offer", "pii", "realtime_claim"],
    "email": _BASE + ["partnership_claim", "invented_offer", "sensitive_trait", "pii"],
    "partner": _BASE + ["partnership_claim", "invented_offer", "scrape_claim", "pii"],
    "internal": ["secret", "hipaa_claim", "scrape_claim"],
    "style": _BASE + ["corrective_vocab", "shame_vocab"],
}


def _negated(text: str, start: int) -> bool:
    window = text[max(0, start - 60):start].lower()
    tokens = re.findall(r"[a-z']+", window)[-5:]
    return any(t in NEGATIONS for t in tokens) or bool(re.search(r"(?:rather than|instead of|free of)\s*$", window))


def scan(text: str, profile: str, *, brief: str = "", required_tokens: tuple[str, ...] | list[str] = (),
         max_words: int | None = None) -> list[Violation]:
    """Return every rule violation in `text` for the named profile."""
    if profile not in PROFILES:
        raise KeyError(f"unknown guardrail profile: {profile}")
    found: list[Violation] = []
    brief_lower = brief.lower()
    for rule_id in PROFILES[profile]:
        rule = RULES[rule_id]
        for match in rule.pattern.finditer(text):
            if rule.negatable and _negated(text, match.start()):
                continue
            if rule.allow_if_in_brief and match.group(0).lower() in brief_lower:
                continue
            found.append(Violation(rule.id, rule.severity, match.group(0)[:80] if rule.id != "secret" else "[redacted]", rule.message))
    if not text.strip():
        found.append(Violation("empty", "block", "", "The model returned no text."))
    if len(text.encode("utf-8")) > MAX_DRAFT_BYTES:
        found.append(Violation("too_long", "block", "", f"Draft exceeds {MAX_DRAFT_BYTES} bytes."))
    if re.search(r"[\x00\x7f]", text):
        found.append(Violation("control_chars", "block", "", "Draft contains control characters."))
    for token in required_tokens:
        if token not in text:
            found.append(Violation("missing_token", "block", token, f"Required placeholder {token} is missing."))
    if max_words and len(text.split()) > max_words:
        found.append(Violation("word_limit", "review", str(len(text.split())), f"Longer than the {max_words}-word target."))
    return found


def verdict(violations: list[Violation]) -> str:
    if any(v.severity == "block" for v in violations):
        return "blocked"
    return "review" if violations else "clean"
