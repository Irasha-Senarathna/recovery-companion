"""The shared feature spec: what the app computes from a user's own check-ins."""

from datetime import date, timedelta

from features import (
    EVENING_HOUR,
    FEATURES,
    build_rows,
    feature_vector,
)
from generate import Dataset
from schema import CheckIn, Craving, Slip

MONDAY = date(2026, 1, 5)


def ci(day: date, **levels: int) -> CheckIn:
    values = {"mood": 2, "sleep": 2, "stress": 2, "craving": 1} | levels
    return CheckIn(
        "u", day, values["mood"], values["sleep"], values["stress"], values["craving"], ()
    )


def named(vector: list[float]) -> dict[str, float]:
    assert len(vector) == len(FEATURES)
    return dict(zip(FEATURES, vector, strict=True))


def test_basic_levels_and_flags() -> None:
    saturday = MONDAY + timedelta(days=5)
    f = named(feature_vector(ci(saturday, sleep=1, stress=3, craving=4), []))
    assert (f["sleep"], f["stress"], f["craving"]) == (1, 3, 4)
    assert f["poor_sleep"] == f["high_stress"] == f["weekend"] == 1
    assert f["poor_sleep_high_stress_weekend"] == 1


def test_interaction_needs_all_three() -> None:
    f = named(feature_vector(ci(MONDAY, sleep=1, stress=3), []))
    assert f["poor_sleep"] == f["high_stress"] == 1
    assert f["weekend"] == 0
    assert f["poor_sleep_high_stress_weekend"] == 0


def test_tags_become_flags() -> None:
    today = CheckIn("u", MONDAY, 2, 2, 2, 1, ("conflict", "tired"))
    f = named(feature_vector(today, []))
    assert f["tag_conflict"] == f["tag_tired"] == 1
    assert f["tag_payday"] == 0


def test_recent_averages_use_only_the_previous_three_days() -> None:
    today = MONDAY + timedelta(days=10)
    previous = [
        ci(today - timedelta(days=1), craving=4, stress=4),
        ci(today - timedelta(days=3), craving=2, stress=0),
        ci(today - timedelta(days=4), craving=0, stress=0),  # too old
    ]
    f = named(feature_vector(ci(today, craving=1, stress=1), previous))
    assert f["craving_recent"] == 3
    assert f["stress_recent"] == 2


def test_recent_averages_fall_back_to_today() -> None:
    f = named(feature_vector(ci(MONDAY, craving=3, stress=1), []))
    assert f["craving_recent"] == 3
    assert f["stress_recent"] == 1


def test_no_peeking_at_the_future() -> None:
    today = MONDAY + timedelta(days=2)
    later = [ci(today + timedelta(days=1), craving=4)]
    assert feature_vector(ci(today), later) == feature_vector(ci(today), [])


def test_label_is_slip_or_strong_evening_craving_that_day() -> None:
    days = [MONDAY + timedelta(days=i) for i in range(4)]
    data = Dataset(
        start=MONDAY,
        users=[],
        checkins=[ci(d) for d in days],
        cravings=[
            Craving("u", days[1], EVENING_HOUR, 3, False, True),  # strong, evening → 1
            Craving("u", days[2], EVENING_HOUR - 1, 4, False, True),  # afternoon → 0
            Craving("u", days[3], 20, 2, False, True),  # mild → 0
        ],
        slips=[Slip("u", days[0])],
    )
    rows = build_rows(data)
    assert rows.y == [1, 1, 0, 0]
    assert rows.day_index == [0, 1, 2, 3]
    assert len(rows.x[0]) == len(FEATURES)


def test_slip_recent_flags_a_slip_in_the_three_days_before_today() -> None:
    today = MONDAY + timedelta(days=10)
    for days_ago, expected in [(1, 1), (3, 1), (4, 0), (0, 0)]:
        slips = [today - timedelta(days=days_ago)]
        f = named(feature_vector(ci(today), [], slips))
        assert f["slip_recent"] == expected, days_ago


def test_slip_recent_never_peeks_at_today_or_later() -> None:
    today = MONDAY + timedelta(days=5)
    later = [today, today + timedelta(days=1)]
    assert feature_vector(ci(today), [], later) == feature_vector(ci(today), [])


def test_rows_use_each_users_own_slips() -> None:
    days = [MONDAY + timedelta(days=i) for i in range(3)]
    other = CheckIn("v", days[1], 2, 2, 2, 1, ())
    data = Dataset(
        start=MONDAY,
        users=[],
        checkins=[ci(d) for d in days] + [other],
        cravings=[],
        slips=[Slip("u", days[0])],
    )
    rows = build_rows(data)
    recent = FEATURES.index("slip_recent")
    by_user = {
        (u, d): x[recent] for u, d, x in zip(rows.user_id, rows.day_index, rows.x, strict=True)
    }
    assert by_user[("u", 1)] == 1
    assert by_user[("v", 1)] == 0
