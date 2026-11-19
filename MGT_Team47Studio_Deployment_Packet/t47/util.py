"""Small shared helpers: time, hashing, JSON, and a dependency-free HTTP client."""
from __future__ import annotations

import hashlib
import json
import socket
import ssl
import time
import urllib.error
import urllib.request
from dataclasses import dataclass, field
from datetime import datetime, timezone
from importlib import resources
from typing import Any, Callable


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")


def sha256_hex(data: bytes | str) -> str:
    if isinstance(data, str):
        data = data.encode("utf-8")
    return hashlib.sha256(data).hexdigest()


def canonical_json(obj: Any) -> str:
    """Compact JSON equal to JavaScript's JSON.stringify for plain data (insertion order, raw UTF-8)."""
    return json.dumps(obj, separators=(",", ":"), ensure_ascii=False)


def load_data(name: str) -> Any:
    """Load a JSON file shipped in t47/data."""
    return json.loads(resources.files("t47").joinpath("data", name).read_text(encoding="utf-8"))


@dataclass
class HttpResponse:
    url: str
    status: int
    headers: dict[str, str] = field(default_factory=dict)
    body: bytes = b""
    elapsed_ms: float = 0.0
    error: str | None = None

    def text(self) -> str:
        return self.body.decode("utf-8", "replace")

    def json(self) -> Any:
        return json.loads(self.text())


class HttpError(RuntimeError):
    def __init__(self, status: int, message: str):
        super().__init__(f"HTTP {status}: {message}")
        self.status = status


class _NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *args, **kwargs):  # noqa: D401 - urllib hook
        return None


def http_request(url: str, *, method: str = "GET", headers: dict[str, str] | None = None, data: bytes | None = None,
                 timeout: float = 15.0, follow_redirects: bool = False, max_bytes: int = 2_000_000) -> HttpResponse:
    """One HTTP request. Never raises for HTTP or network errors: status 0 plus .error means no response."""
    opener = urllib.request.build_opener() if follow_redirects else urllib.request.build_opener(_NoRedirect)
    req = urllib.request.Request(url, data=data, method=method, headers={"User-Agent": "t47-packet/1.0", **(headers or {})})
    start = time.perf_counter()

    def ms() -> float:
        return round((time.perf_counter() - start) * 1000, 1)

    try:
        with opener.open(req, timeout=timeout) as resp:
            body = resp.read(max_bytes)
            return HttpResponse(url, resp.status, {k.lower(): v for k, v in resp.headers.items()}, body, ms())
    except urllib.error.HTTPError as exc:
        body = b""
        try:
            body = exc.read(200_000)
        except Exception:  # body is optional evidence
            pass
        return HttpResponse(url, exc.code, {k.lower(): v for k, v in (exc.headers or {}).items()}, body, ms())
    except Exception as exc:  # DNS, TLS, timeout, refused
        return HttpResponse(url, 0, {}, b"", ms(), error=f"{type(exc).__name__}: {exc}")


Fetch = Callable[..., HttpResponse]


def post_json(url: str, payload: dict, *, headers: dict[str, str] | None = None, timeout: float = 60.0,
              fetch: Fetch = http_request) -> dict:
    resp = fetch(url, method="POST", data=json.dumps(payload).encode("utf-8"),
                 headers={"Content-Type": "application/json", **(headers or {})}, timeout=timeout)
    if resp.status == 0:
        raise HttpError(0, resp.error or "no response")
    if resp.status >= 400:
        raise HttpError(resp.status, resp.text()[:300])
    return resp.json()


def get_json(url: str, *, headers: dict[str, str] | None = None, timeout: float = 15.0, fetch: Fetch = http_request) -> Any:
    resp = fetch(url, headers=headers, timeout=timeout)
    if resp.status == 0:
        raise HttpError(0, resp.error or "no response")
    if resp.status >= 400:
        raise HttpError(resp.status, resp.text()[:300])
    return resp.json()


def tls_expiry_days(host: str, port: int = 443, timeout: float = 10.0) -> float:
    """Days until the server certificate expires (negative when already expired)."""
    ctx = ssl.create_default_context()
    with socket.create_connection((host, port), timeout=timeout) as sock:
        with ctx.wrap_socket(sock, server_hostname=host) as tls:
            cert = tls.getpeercert()
    return (ssl.cert_time_to_seconds(cert["notAfter"]) - time.time()) / 86400


def percentile(values: list[float], pct: float) -> float:
    """Nearest-rank percentile; 0.0 for an empty list."""
    if not values:
        return 0.0
    ordered = sorted(values)
    rank = max(1, round(pct / 100 * len(ordered) + 0.4999))
    return ordered[min(rank, len(ordered)) - 1]
