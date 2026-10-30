"""Tests for the synthetic data generator (shape, ranges, determinism, planted pattern)."""

import csv
from datetime import date
from pathlib import Path

import pytest

from generate import Dataset, generate, main, write_csv
from schema import CHECKIN_TAGS, MEASURES, SCALE_MAX, SCALE_MIN, CheckIn

USERS = 200
DAYS = 180


@pytest.fixture(scope="module")
def data() -> Dataset:
    return generate(users=USERS, days=DAYS, seed=42)


def test_shape(data: Dataset) -> None:
    assert {u.user_id for u in data.users} == {f"u{i:04d}" for i in range(USERS)}
    possible = USERS * DAYS
    # Not every day has a check-in (people skip some), but most do.
    assert 0.5 * possible < len(data.checkins) < possible
    assert len(data.cravings) > 0
    assert 0 < len(data.slips) < 0.2 * possible


def test_one_checkin_per_user_and_day(data: Dataset) -> None:
    keys = [(c.user_id, c.day) for c in data.checkins]
    assert len(keys) == len(set(keys))


def test_value_ranges(data: Dataset) -> None:
    start = data.start
    for c in data.checkins:
        for measure in MEASURES:
            assert SCALE_MIN <= getattr(c, measure) <= SCALE_MAX
        assert set(c.tags) <= set(CHECKIN_TAGS)
        assert 0 <= (c.day - start).days < DAYS
    for craving in data.cravings:
        assert SCALE_MIN + 1 <= craving.intensity <= SCALE_MAX
        assert 0 <= craving.hour <= 23
    for slip in data.slips:
        assert 0 <= (slip.day - start).days < DAYS


def test_deterministic_for_a_seed(tmp_path: Path) -> None:
    a, b = tmp_path / "a", tmp_path / "b"
    write_csv(generate(users=20, days=30, seed=7), a)
    write_csv(generate(users=20, days=30, seed=7), b)
    for name in ("users.csv", "checkins.csv", "cravings.csv", "slips.csv"):
        assert (a / name).read_bytes() == (b / name).read_bytes()


def test_different_seeds_differ() -> None:
    assert generate(users=20, days=30, seed=1) != generate(users=20, days=30, seed=2)


def _slip_rate(data: Dataset, risky: bool) -> float:
    slips = {(s.user_id, s.day) for s in data.slips}
    days = [
        c
        for c in data.checkins
        if (c.sleep <= 1 and c.stress >= 3 and c.day.weekday() >= 5) == risky
    ]
    return sum((c.user_id, c.day) in slips for c in days) / len(days)


def test_planted_pattern_is_measurable(data: Dataset) -> None:
    """Poor sleep + high stress + weekend → clearly more slips (see README)."""
    assert _slip_rate(data, risky=True) > 4 * _slip_rate(data, risky=False)


def test_strong_cravings_come_before_slips(data: Dataset) -> None:
    slips = {(s.user_id, s.day) for s in data.slips}
    high = [c for c in data.checkins if c.craving >= 3]
    low = [c for c in data.checkins if c.craving <= 1]

    def rate(rows: list[CheckIn]) -> float:
        return sum((c.user_id, c.day) in slips for c in rows) / len(rows)

    assert rate(high) > 2 * rate(low)


def test_cli_writes_csv_files(tmp_path: Path) -> None:
    main(["--users", "5", "--days", "10", "--seed", "3", "--out", str(tmp_path)])
    with (tmp_path / "checkins.csv").open() as f:
        rows = list(csv.DictReader(f))
    assert rows
    assert set(rows[0]) == {"user_id", "day", "mood", "sleep", "stress", "craving", "tags"}
    date.fromisoformat(rows[0]["day"])
    assert (tmp_path / "users.csv").exists()
