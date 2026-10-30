"""Shared feature spec. app/src/ml/featureBuilder.ts must compute exactly the same.

One row per check-in. Features use only that check-in and the user's earlier
ones (never later days). The label asks: "was the rest of that day hard?" —
a slip that day, or a strong craving (intensity >= 3) in the evening.
"""

import csv
from collections import defaultdict
from collections.abc import Sequence
from dataclasses import dataclass
from datetime import date, timedelta
from pathlib import Path

from generate import Dataset
from schema import CHECKIN_TAGS, CheckIn, Craving, Slip, User

#: The "evening window" the early warning is about (from this hour on).
EVENING_HOUR = 17
STRONG_CRAVING = 3
RECENT_DAYS = 3

FEATURES: tuple[str, ...] = (
    "mood",
    "sleep",
    "stress",
    "craving",
    "poor_sleep",
    "high_stress",
    "weekend",
    "poor_sleep_high_stress_weekend",
    "craving_recent",
    "stress_recent",
    *(f"tag_{tag}" for tag in CHECKIN_TAGS),
)


@dataclass
class Rows:
    x: list[list[float]]
    y: list[int]
    day_index: list[int]
    user_id: list[str]


def _recent_mean(today: CheckIn, previous: Sequence[CheckIn], measure: str) -> float:
    """Mean over check-ins in the RECENT_DAYS days before today; today's value if none."""
    window = [
        getattr(c, measure)
        for c in previous
        if today.day - timedelta(days=RECENT_DAYS) <= c.day < today.day
    ]
    return sum(window) / len(window) if window else float(getattr(today, measure))


def feature_vector(today: CheckIn, previous: Sequence[CheckIn]) -> list[float]:
    poor_sleep = today.sleep <= 1
    high_stress = today.stress >= 3
    weekend = today.day.weekday() >= 5
    return [
        float(today.mood),
        float(today.sleep),
        float(today.stress),
        float(today.craving),
        float(poor_sleep),
        float(high_stress),
        float(weekend),
        float(poor_sleep and high_stress and weekend),
        _recent_mean(today, previous, "craving"),
        _recent_mean(today, previous, "stress"),
        *(float(tag in today.tags) for tag in CHECKIN_TAGS),
    ]


def build_rows(data: Dataset) -> Rows:
    hard_days = {(s.user_id, s.day) for s in data.slips} | {
        (c.user_id, c.day)
        for c in data.cravings
        if c.intensity >= STRONG_CRAVING and c.hour >= EVENING_HOUR
    }
    by_user: dict[str, list[CheckIn]] = defaultdict(list)
    for c in data.checkins:
        by_user[c.user_id].append(c)

    rows = Rows(x=[], y=[], day_index=[], user_id=[])
    for user_id, checkins in by_user.items():
        checkins.sort(key=lambda c: c.day)
        for i, today in enumerate(checkins):
            rows.x.append(feature_vector(today, checkins[:i]))
            rows.y.append(int((user_id, today.day) in hard_days))
            rows.day_index.append((today.day - data.start).days)
            rows.user_id.append(user_id)
    return rows


def load_dataset(folder: Path) -> Dataset:
    """Reads the CSVs written by generate.py."""

    def read(name: str) -> list[dict[str, str]]:
        with (folder / name).open(encoding="utf-8") as f:
            return list(csv.DictReader(f))

    checkins = [
        CheckIn(
            r["user_id"],
            date.fromisoformat(r["day"]),
            int(r["mood"]),
            int(r["sleep"]),
            int(r["stress"]),
            int(r["craving"]),
            tuple(t for t in r["tags"].split("|") if t),
        )
        for r in read("checkins.csv")
    ]
    cravings = [
        Craving(
            r["user_id"],
            date.fromisoformat(r["day"]),
            int(r["hour"]),
            int(r["intensity"]),
            r["used_sos"] == "1",
            r["passed"] == "1",
        )
        for r in read("cravings.csv")
    ]
    slips = [Slip(r["user_id"], date.fromisoformat(r["day"])) for r in read("slips.csv")]
    users = [User(r["user_id"], int(r["payday"])) for r in read("users.csv")]
    start = min(c.day for c in checkins)
    return Dataset(start=start, users=users, checkins=checkins, cravings=cravings, slips=slips)
