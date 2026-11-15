import pytest

from t47.release.gates import PLATFORMS, evaluate, initial_state, load_catalog, load_state, render, save_state, set_gate
from t47.release.store_assets import check_store_folder

PIL = pytest.importorskip("PIL.Image")


def statuses(report):
    return {c.id: c.status for c in report.checks}


# ---- gates ----

def test_catalog_is_well_formed():
    catalog = load_catalog()
    ids = [g["id"] for g in catalog]
    assert ids == [f"G{n:02d}" for n in range(1, len(catalog) + 1)] and len(catalog) >= 20
    for gate in catalog:
        assert gate["priority"] in {"P0", "P1", "P2"} and gate["platforms"] and set(gate["platforms"]) <= set(PLATFORMS)
        assert gate["title"] and gate["evidence"] and gate["owner"]


def test_nothing_starts_accepted_and_every_platform_holds():
    state = initial_state()
    assert not [g for g, entry in state.items() if entry["status"] == "accepted"]
    assert {entry["status"] for entry in state.values()} == {"open", "reported"}
    for platform in ("web", "android", "ios"):
        result = evaluate(platform, state)
        assert result["decision"] == "HOLD" and result["blockers"] and result["accepted"] == 0
    with pytest.raises(ValueError):
        evaluate("windows-phone", state)


def test_reported_is_not_accepted():
    state = initial_state()
    reported = [g["id"] for g in load_catalog() if g.get("reported") and g["priority"] == "P0" and "web" in g["platforms"]]
    assert reported, "the catalog records work the diagnostic says was done"
    blockers = {b["id"]: b["status"] for b in evaluate("web", state)["blockers"]}
    assert all(blockers[g] == "reported" for g in reported)


def test_acceptance_needs_evidence_and_a_named_person():
    state = initial_state()
    with pytest.raises(ValueError, match="evidence"):
        set_gate(state, "G07", "accepted", by="Gregg Clark")
    with pytest.raises(ValueError, match="person"):
        set_gate(state, "G07", "accepted", evidence="drive:abc123")
    with pytest.raises(ValueError, match="agent"):
        set_gate(state, "G07", "accepted", evidence="drive:abc123", by="agent:t47-local")
    with pytest.raises(KeyError):
        set_gate(state, "G99", "open")
    with pytest.raises(ValueError):
        set_gate(state, "G07", "done")
    set_gate(state, "G07", "accepted", evidence="drive:abc123", by="Gregg Clark")
    assert state["G07"]["status"] == "accepted" and state["G07"]["accepted_by"] == "Gregg Clark"
    set_gate(state, "G07", "open")
    assert state["G07"]["accepted_by"] == ""


def test_platform_ships_only_when_all_its_p0_gates_are_accepted():
    state = initial_state()
    catalog = load_catalog()
    for gate in catalog:
        if gate["priority"] == "P0" and "web" in gate["platforms"]:
            set_gate(state, gate["id"], "accepted", evidence=f"drive:evidence-{gate['id']}", by="Gregg Clark")
    web = evaluate("web", state)
    assert web["decision"] == "SHIP" and web["blockers"] == []
    assert web["launch_readiness_open"] and web["broad_marketing_ready"] is False  # P1 work still open
    assert evaluate("android", state)["decision"] == "HOLD"                       # store and billing gates are still open
    assert {b["id"] for b in evaluate("android", state)["blockers"]} == {"G14", "G15", "G18"}
    assert {b["id"] for b in evaluate("ios", state)["blockers"]} == {"G16", "G17", "G18"}
    for gate in catalog:
        if gate["priority"] == "P1" and "web" in gate["platforms"]:
            set_gate(state, gate["id"], "accepted", evidence="drive:evidence", by="Gregg Clark")
    assert evaluate("web", state)["broad_marketing_ready"] is True


def test_state_file_roundtrip_and_new_gates_default_open(tmp_path):
    path = tmp_path / "nested" / "gates.json"
    assert load_state(path) == load_state(path)  # missing file: the initial state
    state = set_gate(initial_state(), "G03", "accepted", evidence="stripe-dashboard-export.pdf", by="Gregg Clark")
    del state["G23"]  # a gate added to the catalog after the file was written
    save_state(path, state)
    loaded = load_state(path)
    assert loaded["G03"]["status"] == "accepted" and loaded["G23"]["status"] == "open"


def test_render_lists_blockers_per_platform():
    text = render(initial_state())
    assert "| web | **HOLD** |" in text and "## ios: HOLD" in text and "G16" in text
    assert "reported" in text and "SHIP" not in text.replace("ships", "")


# ---- store assets ----

def image(path, size, mode="RGB"):
    path.parent.mkdir(parents=True, exist_ok=True)
    PIL.new(mode, size, (20, 20, 60) if mode == "RGB" else (20, 20, 60, 255)).save(path)


def good_folder(root):
    image(root / "google-play/icon/icon-512.png", (512, 512), "RGBA")
    image(root / "google-play/feature-graphic/feature.png", (1024, 500))
    for n in range(4):
        image(root / f"google-play/screenshots/phone/{n + 1}.png", (1080, 1920))
        image(root / f"app-store/screenshots/iphone-6.9/{n + 1}.png", (1206, 2622))
    image(root / "app-store/icon/icon-1024.png", (1024, 1024))
    return root


def test_store_assets_pass_on_a_correct_set(tmp_path):
    report = check_store_folder(str(good_folder(tmp_path)))
    assert report.ok and report.counts["warn"] == 0 and report.counts["pass"] == len(report.checks) >= 14


def test_store_assets_catch_the_usual_mistakes(tmp_path):
    root = good_folder(tmp_path)
    image(root / "google-play/icon/icon-wrong.png", (500, 500))
    image(root / "google-play/feature-graphic/alpha.png", (1024, 500), "RGBA")
    image(root / "google-play/screenshots/phone/too-tall.png", (1080, 2400))
    image(root / "google-play/screenshots/tablet/only-one.png", (1600, 2560))
    image(root / "app-store/screenshots/iphone-6.9/alpha.png", (1206, 2622), "RGBA")
    image(root / "app-store/screenshots/odd/1.png", (1000, 2000))
    image(root / "app-store/icon/alpha-icon.png", (1024, 1024), "RGBA")
    got = statuses(check_store_folder(str(root)))
    assert got["play.icon.icon-wrong.png"] == "fail" and got["play.feature.alpha.png"] == "fail"
    assert got["play.shot.phone.too-tall.png"] == "fail" and got["play.count.tablet"] == "fail"
    assert got["apple.shot.iphone-6.9.alpha.png"] == "fail" and got["apple.shot.odd.1.png"] == "fail" and got["apple.required.odd"] == "fail"
    assert got["apple.icon.alpha-icon.png"] == "warn" and got["play.icon.icon-512.png"] == "pass"


def test_store_assets_empty_folder_fails(tmp_path):
    assert statuses(check_store_folder(str(tmp_path))) == {"store.empty": "fail"}
