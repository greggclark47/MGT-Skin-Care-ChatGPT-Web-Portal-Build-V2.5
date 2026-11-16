"""Backup retention: seven daily and four weekly points, the cadence set in the 2026-11-10 gap analysis."""
from __future__ import annotations

from datetime import datetime


def plan_retention(timestamps: list[datetime], *, daily: int = 7, weekly: int = 4) -> dict[str, list[datetime]]:
    """Split backup timestamps into keep and prune.

    Keep the newest backup from each of the most recent `daily` days that have one, then the newest backup from each
    of the next `weekly` ISO weeks older than those days. The most recent backup is always kept.
    """
    ordered = sorted(set(timestamps), reverse=True)
    keep: list[datetime] = []
    days_seen: list = []
    for stamp in ordered:
        if stamp.date() not in days_seen:
            if len(days_seen) >= daily:
                break
            days_seen.append(stamp.date())
            keep.append(stamp)
    oldest_daily = min(days_seen) if days_seen else None
    weeks_seen: list = []
    daily_weeks = {d.isocalendar()[:2] for d in days_seen}
    for stamp in ordered:
        if oldest_daily is None or stamp.date() >= oldest_daily:
            continue
        week = stamp.isocalendar()[:2]
        if week in weeks_seen or week in daily_weeks:
            continue
        if len(weeks_seen) >= weekly:
            break
        weeks_seen.append(week)
        keep.append(stamp)
    if ordered and ordered[0] not in keep:  # never prune the newest backup, whatever the policy numbers are
        keep.append(ordered[0])
    keep_set = set(keep)
    return {"keep": sorted(keep_set, reverse=True), "prune": [s for s in ordered if s not in keep_set]}
