from t47.agents.guardrails import MAX_DRAFT_BYTES, PROFILES, RULES, scan, verdict


def rules(text, profile, **kw):
    return {v.rule for v in scan(text, profile, **kw)}


def test_clean_care_reply_passes():
    text = ("Thanks for writing in. You can reset your password from the sign-in page: choose 'Forgot password' and follow "
            "the link we email you. If the link does not arrive, a team member can help from the Support page.")
    assert scan(text, "care") == []
    assert verdict([]) == "clean"


def test_medical_and_guarantee_claims_block():
    assert "medical_claim" in rules("This serum cures acne.", "social")
    assert "medical_claim" in rules("A treatment for eczema that works.", "email")
    assert "guaranteed_result" in rules("Guaranteed results or your money back.", "social")
    assert "hipaa_claim" in rules("We are HIPAA compliant.", "care")


def test_negation_clears_the_safe_statement():
    assert "medical_claim" not in rules("This is cosmetic guidance, not a diagnosis or a treatment for acne.", "care")
    assert "guaranteed_result" not in rules("We do not guarantee results.", "social")
    assert "scrape_claim" not in rules("We never scrape contact lists.", "partner")
    # a negation far away does not clear a later claim
    assert "guaranteed_result" in rules("We do not sell hardware. Separately and for everyone here, results are guaranteed.", "social")


def test_agent_cannot_claim_an_action():
    assert "action_claim" in rules("I've reset your password for you.", "care")
    assert "action_claim" in rules("We will refund the second charge today.", "care")
    assert "action_claim" not in rules("A team member can review the second charge with you.", "care")


def test_offers_and_partnerships_need_the_operator_brief():
    draft = "Get 20% off this week with our official partner Glow Supply."
    found = rules(draft, "social")
    assert {"invented_offer", "partnership_claim"} <= found
    allowed = rules(draft, "social", brief="Announce 20% off this week. Glow Supply is our official partner.")
    assert "invented_offer" not in allowed and "partnership_claim" not in allowed


def test_contact_details_must_come_from_the_brief():
    assert "pii" in rules("Write to jane@example.com for help.", "care")
    assert "pii" not in rules("Write to support@team47studio.com for help.", "care", brief="Our address is support@team47studio.com")
    assert "pii" in rules("Call 212-555-0147 today.", "partner")


def test_profile_traits_never_appear_in_marketing_email():
    assert "sensitive_trait" in rules("Because you have dry skin, try this.", "email")


def test_style_profile_blocks_corrective_and_shame_language():
    assert "corrective_vocab" in rules("A cut that flatters your body type.", "style")
    assert "shame_vocab" in rules("Your hair is damaged from bleach.", "style")
    assert rules("A relaxed cut in the colors you said you prefer.", "style") == set()


def test_required_tokens_and_limits():
    assert "missing_token" in rules("Hello there.", "email", required_tokens=["{{unsubscribe_link}}"])
    assert "missing_token" not in rules("Hello. {{unsubscribe_link}}", "email", required_tokens=["{{unsubscribe_link}}"])
    assert "word_limit" in rules("word " * 30, "social", max_words=10)
    assert "too_long" in rules("a" * (MAX_DRAFT_BYTES + 1), "internal")
    assert "empty" in rules("   ", "care")


def test_secret_is_blocked_and_never_echoed():
    found = scan("Use key sk-abcdefghijklmnopqrstuvwxyz123456 to sign in.", "internal")
    assert [v.rule for v in found] == ["secret"]
    assert found[0].match == "[redacted]"


def test_review_severity_does_not_block():
    found = scan("Most people see a clearer routine within 2 weeks.", "social")
    assert [v.rule for v in found] == ["timeline_claim"]
    assert verdict(found) == "review"


def test_every_profile_names_real_rules():
    for names in PROFILES.values():
        assert all(name in RULES for name in names)
