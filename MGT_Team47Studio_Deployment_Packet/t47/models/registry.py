"""Model registry: incumbents, candidates and a plain fit rule for the workstation GPU."""
from __future__ import annotations

from t47.util import load_data


def load_registry() -> dict:
    return load_data("models.json")


def get_model(model_id: str) -> dict | None:
    return next((m for m in load_registry()["models"] if m["id"] == model_id), None)


def fit_class(size_gb: float | None, vram_gb: float) -> str:
    """Classify by headroom between published weight size and VRAM.

    This is a screening rule, not a memory model: context and the KV cache need room on top of the weights, and the
    only reliable answer is `ollama ps` after loading at the context you intend to run.
    """
    if size_gb is None:
        return "unknown"
    headroom = vram_gb - size_gb
    if headroom >= 4:
        return "fits"
    if headroom >= 1:
        return "tight"
    return "exceeds"


def fit_table(vram_gb: float) -> list[dict]:
    rows = []
    for model in load_registry()["models"]:
        if model.get("provider") == "ollama_cloud":
            fit = "hosted"
        else:
            fit = fit_class(model.get("size_gb"), vram_gb)
        rows.append({"id": model["id"], "status": model["status"], "roles": model["roles"], "size_gb": model.get("size_gb"),
                     "fit": fit, "confidence": model["confidence"], "source": model["source"]})
    return rows


def candidates_for(role: str, vram_gb: float) -> list[str]:
    """Local candidates for a role that are not already ruled out by size."""
    return [m["id"] for m in load_registry()["models"]
            if m["status"] == "candidate" and role in m["roles"] and fit_class(m.get("size_gb"), vram_gb) != "exceeds"]
