"""Read-only checks against the public site. GET requests only; no cookies kept, no forms posted."""
from __future__ import annotations

import re
from urllib.parse import urlparse

from t47.diagnostics.checks import Report
from t47.util import Fetch, http_request, tls_expiry_days

SECURITY_HEADERS = ("strict-transport-security", "content-security-policy", "x-content-type-options", "referrer-policy")
POLICY_PATHS = ("/privacy", "/terms", "/ai-disclosure", "/support", "/membership")
# The route contract verified in the 2026-11-13 checkpoint: /healthz and /api/hub/session answer 200;
# /readyz stays 503 until the backup and catalog gates pass, which is the intended fail-closed state.
API_PROBES = (("/healthz", (200,)), ("/readyz", (200, 503)), ("/api/hub/session", (200,)))


def _meta(html: str, name: str) -> str | None:
    match = re.search(rf'<meta[^>]+name=["\']{name}["\'][^>]*content=["\']([^"\']*)["\']', html, re.I) or \
        re.search(rf'<meta[^>]+content=["\']([^"\']*)["\'][^>]*name=["\']{name}["\']', html, re.I)
    return match.group(1).strip() if match else None


def run(origin: str, www: str, *, fetch: Fetch = http_request, tls_days=tls_expiry_days, timeout: float = 15.0) -> Report:
    origin = origin.rstrip("/")
    host = urlparse(origin).hostname or ""
    report = Report("Site diagnostic", origin)

    home = fetch(origin + "/", timeout=timeout)
    if home.status == 0:
        report.add("site.reach", "Home page reachable", "fail", home.error or "no response")
        report.notes.append("The site could not be reached from this machine; the remaining checks were skipped.")
        return report
    report.add("site.home", "Home page returns 200", "pass" if home.status == 200 else "fail",
               f"HTTP {home.status} in {home.elapsed_ms} ms", http_status=home.status, ms=home.elapsed_ms)
    html = home.text()
    title = re.search(r"<title[^>]*>(.*?)</title>", html, re.I | re.S)
    report.add("site.title", "Title present", "pass" if title else "warn", (title.group(1).strip() if title else "no <title>")[:120])
    description = _meta(html, "description")
    report.add("site.description", "Meta description present", "pass" if description else "warn", (description or "missing")[:160])
    canonical = re.search(r'<link[^>]+rel=["\']canonical["\'][^>]*href=["\']([^"\']+)["\']', html, re.I)
    report.add("site.canonical", "Canonical URL points at the apex", "pass" if canonical and urlparse(canonical.group(1)).hostname == host else "warn",
               canonical.group(1) if canonical else "no canonical link")
    for name in ("author", "creator"):
        value = _meta(html, name)
        if value:
            report.add(f"site.meta.{name}", f"Meta {name}", "info", f"Carries a personal or brand name ({len(value)} chars); confirm it is intended.")
    if "cosmetic guidance" in html.lower():
        report.add("site.disclaimer", "Cosmetic-guidance statement on the home page", "pass", "found")
    else:
        report.add("site.disclaimer", "Cosmetic-guidance statement on the home page", "warn", "not found in the served HTML")

    for header in SECURITY_HEADERS:
        present = header in home.headers
        report.add(f"site.header.{header}", f"Header {header}", "pass" if present else "warn", "present" if present else "missing")
    framing = "x-frame-options" in home.headers or "frame-ancestors" in home.headers.get("content-security-policy", "")
    report.add("site.header.framing", "Framing control (X-Frame-Options or CSP frame-ancestors)", "pass" if framing else "warn",
               "present" if framing else "missing")

    redirect = fetch(www.rstrip("/") + "/", timeout=timeout)
    location = redirect.headers.get("location", "")
    good = redirect.status in (301, 308) and urlparse(location).hostname == host
    report.add("site.www", "www redirects permanently to the apex", "pass" if good else "warn",
               f"HTTP {redirect.status} -> {location or 'no Location header'}", http_status=redirect.status)

    for path, accepted in API_PROBES:
        resp = fetch(origin + path, timeout=timeout)
        status = "pass" if resp.status in accepted else "fail"
        detail = f"HTTP {resp.status}"
        if path == "/readyz" and resp.status == 503:
            status, detail = "info", "HTTP 503: readiness is still fail-closed (backup and catalog gates open)"
        report.add(f"site.probe{path.replace('/', '.')}", f"GET {path}", status, detail, http_status=resp.status, ms=resp.elapsed_ms)

    for path in POLICY_PATHS:
        resp = fetch(origin + path, timeout=timeout, follow_redirects=True)
        report.add(f"site.page{path.replace('/', '.')}", f"Page {path}", "pass" if resp.status == 200 else "warn", f"HTTP {resp.status}")

    for path in ("/robots.txt", "/sitemap.xml"):
        resp = fetch(origin + path, timeout=timeout)
        report.add(f"site.file{path.replace('/', '.')}", f"{path} served", "pass" if resp.status == 200 else "info", f"HTTP {resp.status}")

    try:
        days = tls_days(host)
        report.add("site.tls", "TLS certificate validity", "pass" if days > 21 else "warn" if days > 0 else "fail", f"{days:.0f} days remaining")
    except Exception as exc:  # no TLS evidence is a skipped check, not a failure
        report.add("site.tls", "TLS certificate validity", "skipped", f"{type(exc).__name__}: {exc}")
    return report
