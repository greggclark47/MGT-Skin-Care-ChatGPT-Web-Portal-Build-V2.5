"""Preflight for merging the packet into a monorepo checkout. Read-only: it runs `git apply --check`, never `git apply`."""
from __future__ import annotations

import hashlib
import json
import subprocess
from pathlib import Path

from t47.diagnostics.checks import Report

PACKET_DIR = "MGT_Team47Studio_Deployment_Packet"
IOS_SCRIPTS = ("ios:preview", "ios:production", "ios:submit:testflight")


def _git(repo: Path, *args: str) -> subprocess.CompletedProcess:
    return subprocess.run(["git", "-C", str(repo), *args], capture_output=True, text=True, timeout=60)


def verify_manifest(folder: Path) -> tuple[int, list[str]]:
    """Return (files checked, problems) for a `sha256sum`-style MANIFEST.sha256 in `folder`."""
    problems, checked = [], 0
    for line in (folder / "MANIFEST.sha256").read_text(encoding="utf-8").splitlines():
        if not line.strip():
            continue
        digest, _, name = line.partition("  ")
        target = folder / name.strip().lstrip("*").removeprefix("./")
        checked += 1
        if not target.is_file():
            problems.append(f"missing: {name.strip()}")
        else:
            content = target.read_bytes()
            raw_digest = hashlib.sha256(content).hexdigest()
            accepted_digests = {raw_digest}
            # Git may materialize tracked UTF-8 text as CRLF on Windows while
            # the packet manifest binds the canonical LF bytes used by CI.
            # Never normalize binary files: their exact bytes stay mandatory.
            try:
                text = content.decode("utf-8")
            except UnicodeDecodeError:
                text = ""
            if text and "\x00" not in text:
                accepted_digests.add(hashlib.sha256(text.replace("\r\n", "\n").encode("utf-8")).hexdigest())
            if digest.strip() not in accepted_digests:
                problems.append(f"changed: {name.strip()}")
    return checked, problems


def patch_state(repo: Path, patch: Path) -> str:
    """'applied' when the reverse applies cleanly, 'applies' when the patch does, otherwise 'conflict'."""
    if _git(repo, "apply", "--reverse", "--check", str(patch)).returncode == 0:
        return "applied"
    return "applies" if _git(repo, "apply", "--check", str(patch)).returncode == 0 else "conflict"


def run(repo: str) -> Report:
    root = Path(repo)
    report = Report("Merge preflight", str(root))
    if not (root / "package.json").is_file():
        report.add("merge.repo", "Monorepo checkout", "fail", f"no package.json at {root}")
        return report
    head = _git(root, "rev-parse", "HEAD")
    branch = _git(root, "rev-parse", "--abbrev-ref", "HEAD")
    report.add("merge.head", "Checkout", "info" if head.returncode == 0 else "warn",
               f"{branch.stdout.strip() or '?'} at {head.stdout.strip()[:12] or 'not a git checkout'}")

    packet = root / PACKET_DIR
    if not (packet / "pyproject.toml").is_file():
        report.add("merge.packet", "Packet folder present", "fail", f"{PACKET_DIR}/ is not in this checkout (merge step 1)")
        return report
    version = (packet / "VERSION").read_text(encoding="utf-8").strip() if (packet / "VERSION").is_file() else "?"
    report.add("merge.packet", "Packet folder present", "pass", f"version {version}")
    if (packet / "MANIFEST.sha256").is_file():
        checked, problems = verify_manifest(packet)
        report.add("merge.manifest", "Packet manifest", "pass" if not problems else "fail",
                   f"{checked} files verified" if not problems else "; ".join(problems[:8]))
    else:
        report.add("merge.manifest", "Packet manifest", "warn", "MANIFEST.sha256 not found")

    for patch in sorted((packet / "merge" / "patches").glob("*.patch")):
        state = patch_state(root, patch)
        report.add(f"merge.patch.{patch.name[:4]}", f"Patch {patch.name}", {"applied": "pass", "applies": "warn", "conflict": "fail"}[state],
                   {"applied": "already applied", "applies": "not applied yet; applies cleanly",
                    "conflict": "does not apply: the target file changed, re-create the patch"}[state])

    mobile = root / "apps" / "mobile" / "package.json"
    if mobile.is_file():
        scripts = json.loads(mobile.read_text(encoding="utf-8")).get("scripts", {})
        missing = [name for name in IOS_SCRIPTS if name not in scripts]
        report.add("merge.ios", "iOS build and submit scripts", "pass" if not missing else "warn",
                   "present" if not missing else "missing: " + ", ".join(missing))
        eas = root / "apps" / "mobile" / "eas.json"
        submit = json.loads(eas.read_text(encoding="utf-8")).get("submit", {}).get("production", {}) if eas.is_file() else {}
        report.add("merge.ios.submit", "EAS iOS submit profile", "info",
                   "configured" if "ios" in submit else "not configured: the first `eas submit` will ask for App Store Connect details")
    else:
        report.add("merge.ios", "iOS build and submit scripts", "warn", "apps/mobile/package.json not found")

    workflow = root / ".github" / "workflows" / "deployment-packet.yml"
    report.add("merge.ci", "Packet CI job", "pass" if workflow.is_file() else "warn",
               "present" if workflow.is_file() else "not present (patch 0002)")

    d09 = root / "docs" / "d09-v3.6"
    if (d09 / "MANIFEST.sha256").is_file():
        checked, problems = verify_manifest(d09)
        status = "PRELIMINARY" if "PRELIMINARY" in (d09 / "README.md").read_text(encoding="utf-8") else "released"
        report.add("merge.d09", "D09 handoff folder", "info" if not problems else "fail",
                   f"{checked} files verified; status {status}" if not problems else "; ".join(problems[:8]))
    else:
        report.add("merge.d09", "D09 handoff folder", "info", "not in this checkout (merge step 4, after the owner releases it)")
    return report
