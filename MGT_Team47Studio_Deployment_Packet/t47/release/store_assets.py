"""Validate store images against the published specifications. Requires Pillow (`pip install t47[assets]`).

Google Play (Play Console Help, "Add preview assets", read 2026-11-14): icon 512 x 512 32-bit PNG, up to 1024 KB;
feature graphic 1024 x 500 JPEG or 24-bit PNG without alpha; screenshots JPEG or 24-bit PNG without alpha, each
side 320 to 3840 px, longest side at most twice the shortest, up to 8 per device type.
App Store (App Store Connect Help, "Screenshot specifications", read 2026-11-14): JPEG or PNG, no alpha, up to 10
per size; 1179 x 2556 and 1206 x 2622 are the accepted sizes for the required iPhone class.
"""
from __future__ import annotations

from pathlib import Path

from t47.diagnostics.checks import Report

APPLE_REQUIRED = {(1179, 2556), (1206, 2622)}
APPLE_OPTIONAL = {(1260, 2736), (1290, 2796), (1320, 2868), (1284, 2778), (1242, 2688)}
IMAGE_SUFFIXES = {".png", ".jpg", ".jpeg"}


def _info(path: Path) -> dict:
    from PIL import Image

    with Image.open(path) as im:
        alpha = im.mode in ("RGBA", "LA", "PA") or "transparency" in im.info
        return {"size": im.size, "alpha": alpha, "format": im.format, "bytes": path.stat().st_size}


def _images(folder: Path) -> list[Path]:
    return sorted(p for p in folder.rglob("*") if p.suffix.lower() in IMAGE_SUFFIXES) if folder.is_dir() else []


def _portrait(size: tuple[int, int]) -> tuple[int, int]:
    return (min(size), max(size))


def check_store_folder(root: str) -> Report:
    base = Path(root)
    report = Report("Store asset validation", str(base))
    play, apple = base / "google-play", base / "app-store"

    for icon in [p for p in _images(play / "icon")]:
        info = _info(icon)
        ok = info["size"] == (512, 512) and info["format"] == "PNG" and info["bytes"] <= 1024 * 1024
        report.add(f"play.icon.{icon.name}", f"Play icon {icon.name}", "pass" if ok else "fail",
                   f"{info['size'][0]} x {info['size'][1]} {info['format']}, {info['bytes'] // 1024} KB")
    for graphic in _images(play / "feature-graphic"):
        info = _info(graphic)
        ok = info["size"] == (1024, 500) and not info["alpha"] and info["format"] in ("PNG", "JPEG")
        report.add(f"play.feature.{graphic.name}", f"Play feature graphic {graphic.name}", "pass" if ok else "fail",
                   f"{info['size'][0]} x {info['size'][1]} {info['format']}, alpha {'yes' if info['alpha'] else 'no'}")
    shots = play / "screenshots"
    for group in sorted(p for p in shots.iterdir() if p.is_dir()) if shots.is_dir() else []:
        files = _images(group)
        for shot in files:
            info = _info(shot)
            short, long = _portrait(info["size"])
            ok = short >= 320 and long <= 3840 and long <= 2 * short and not info["alpha"]
            report.add(f"play.shot.{group.name}.{shot.name}", f"Play screenshot {group.name}/{shot.name}", "pass" if ok else "fail",
                       f"{info['size'][0]} x {info['size'][1]}, alpha {'yes' if info['alpha'] else 'no'}")
        count_ok = 2 <= len(files) <= 8
        report.add(f"play.count.{group.name}", f"Play screenshot set '{group.name}' count", "pass" if count_ok else "fail",
                   f"{len(files)} images (2 to 8 allowed; 4 or more recommended)")

    for icon in _images(apple / "icon"):
        info = _info(icon)
        ok = info["size"] == (1024, 1024)
        report.add(f"apple.icon.{icon.name}", f"App icon {icon.name}", "pass" if ok and not info["alpha"] else "warn" if ok else "fail",
                   f"{info['size'][0]} x {info['size'][1]}, alpha {'yes: confirm the store copy is opaque' if info['alpha'] else 'no'}")
    shots = apple / "screenshots"
    for group in sorted(p for p in shots.iterdir() if p.is_dir()) if shots.is_dir() else []:
        files = _images(group)
        sizes = set()
        for shot in files:
            info = _info(shot)
            size = _portrait(info["size"])
            sizes.add(size)
            ok = size in APPLE_REQUIRED | APPLE_OPTIONAL and not info["alpha"]
            report.add(f"apple.shot.{group.name}.{shot.name}", f"App Store screenshot {group.name}/{shot.name}", "pass" if ok else "fail",
                       f"{info['size'][0]} x {info['size'][1]}, alpha {'yes' if info['alpha'] else 'no'}")
        report.add(f"apple.count.{group.name}", f"App Store screenshot set '{group.name}' count", "pass" if 1 <= len(files) <= 10 else "fail",
                   f"{len(files)} images (1 to 10 per size)")
        report.add(f"apple.required.{group.name}", f"App Store set '{group.name}' covers the required iPhone size",
                   "pass" if sizes & APPLE_REQUIRED else "fail", ", ".join(f"{w} x {h}" for w, h in sorted(sizes)) or "no images")
    if not report.checks:
        report.add("store.empty", "Store images found", "fail", f"no images under {base}/google-play or {base}/app-store")
    return report
