"""Deterministic synthetic data: check-ins, cravings and slips with planted patterns.

    python generate.py --users 200 --days 180 --seed 42

Every number below is an assumption, listed in README.md. This is made-up data
for building and testing the risk model; it says nothing about real people.
"""

import argparse
import csv
import math
import random
from collections.abc import Sequence
from dataclasses import dataclass
from datetime import date, timedelta
from pathlib import Path

from schema import SCALE_MAX, SCALE_MIN, CheckIn, Craving, Slip, User

DEFAULT_START = date(2026, 1, 5)
DEFAULT_OUT = Path(__file__).resolve().parent / "data"

# Risk model (log-odds of a slip on a day). See README "Planted patterns".
BASE_RISK_MEAN, BASE_RISK_SD = -4.8, 0.4
POOR_SLEEP = 1.0  # sleep <= 1
HIGH_STRESS = 0.9  # stress >= 3
WEEKEND_RANGE = (0.3, 0.7)  # per-user weekend effect
SLEEP_STRESS_WEEKEND = 0.8  # extra when all three happen together
PAYDAY = 0.7  # payday and the day after
AFTER_SLIP = 0.6  # the 3 days after a slip
AFTER_SLIP_DAYS = 3
TAG_RISK = {"conflict": 0.5, "old_routine": 0.8, "risky_place": 0.8}

# People check in less on hard days (data missing not at random).
SKIP_ON_SLIP_DAY = 0.25


@dataclass(frozen=True)
class Dataset:
    start: date
    users: list[User]
    checkins: list[CheckIn]
    cravings: list[Craving]
    slips: list[Slip]


def _level(value: float) -> int:
    return max(SCALE_MIN, min(SCALE_MAX, round(value)))


def _sigmoid(x: float) -> float:
    return 1 / (1 + math.exp(-x))


def _poisson(rng: random.Random, lam: float) -> int:
    """Knuth's method; fine for the small rates used here."""
    limit, k, p = math.exp(-lam), 0, 1.0
    while True:
        p *= rng.random()
        if p <= limit:
            return k
        k += 1


def _tags(
    rng: random.Random, *, sleep: int, stress: int, weekend: bool, payday: bool
) -> tuple[str, ...]:
    chances = {
        "alone": 0.12,
        "bored": 0.15 + (0.1 if weekend else 0),
        "tired": 0.6 if sleep <= 1 else 0.05,
        "conflict": 0.07 + (0.1 if stress >= 3 else 0),
        "work_stress": 0.55 if stress >= 3 and not weekend else 0.05,
        "money_worries": 0.08,
        "payday": 0.8 if payday else 0,
        "celebration": 0.2 if weekend else 0.03,
        "pain": 0.05,
        "old_routine": 0.05 + (0.1 if weekend else 0),
        "risky_place": 0.04,
    }
    # Fixed order (the shared tag list), so output never depends on set ordering.
    return tuple(tag for tag, chance in chances.items() if rng.random() < chance)


def _user_days(
    rng: random.Random, user: User, start: date, days: int
) -> tuple[list[CheckIn], list[Craving], list[Slip]]:
    sleep_mean = rng.uniform(1.6, 3.2)
    stress_mean = rng.uniform(1.0, 2.6)
    base = rng.gauss(BASE_RISK_MEAN, BASE_RISK_SD)
    weekend_effect = rng.uniform(*WEEKEND_RANGE)
    adherence = rng.uniform(0.65, 0.95)

    checkins: list[CheckIn] = []
    cravings: list[Craving] = []
    slips: list[Slip] = []
    days_since_slip = AFTER_SLIP_DAYS + 1
    prev_stress = stress_mean

    for offset in range(days):
        day = start + timedelta(days=offset)
        weekend = day.weekday() >= 5
        payday = day.day in (user.payday, user.payday + 1)

        stress_raw = (
            0.6 * stress_mean + 0.4 * prev_stress + (-0.3 if weekend else 0.4) + rng.gauss(0, 0.9)
        )
        stress = _level(stress_raw)
        prev_stress = stress_raw
        sleep = _level(rng.gauss(sleep_mean - 0.35 * (stress - 2), 0.9))
        tags = _tags(rng, sleep=sleep, stress=stress, weekend=weekend, payday=payday)

        poor_sleep, high_stress = sleep <= 1, stress >= 3
        lift = (
            POOR_SLEEP * poor_sleep
            + HIGH_STRESS * high_stress
            + weekend_effect * weekend
            + SLEEP_STRESS_WEEKEND * (poor_sleep and high_stress and weekend)
            + PAYDAY * payday
            + AFTER_SLIP * (days_since_slip <= AFTER_SLIP_DAYS)
            + sum(TAG_RISK.get(tag, 0) for tag in tags)
        )
        craving = _level(0.5 + lift + rng.gauss(0, 0.7))
        mood = _level(
            2.6 + 0.45 * (sleep - 2) - 0.45 * (stress - 2) - 0.3 * craving + rng.gauss(0, 0.7)
        )
        slipped = rng.random() < _sigmoid(base + lift)

        if rng.random() < adherence * (1 - SKIP_ON_SLIP_DAY * slipped):
            checkins.append(CheckIn(user.user_id, day, mood, sleep, stress, craving, tags))

        for _ in range(_poisson(rng, 0.15 + 0.6 * craving)):
            used_sos = rng.random() < 0.35
            cravings.append(
                Craving(
                    user_id=user.user_id,
                    day=day,
                    hour=min(23, max(0, round(rng.gauss(19, 3.5)))),
                    intensity=max(SCALE_MIN + 1, _level(craving + rng.gauss(0, 0.8))),
                    used_sos=used_sos,
                    passed=rng.random() < (0.85 if used_sos else 0.7),
                )
            )

        if slipped:
            slips.append(Slip(user.user_id, day))
            days_since_slip = 0
        else:
            days_since_slip += 1

    return checkins, cravings, slips


def generate(*, users: int, days: int, seed: int, start: date = DEFAULT_START) -> Dataset:
    rng = random.Random(seed)
    data = Dataset(start=start, users=[], checkins=[], cravings=[], slips=[])
    for i in range(users):
        user = User(user_id=f"u{i:04d}", payday=rng.choice([1, 10, 25]))
        checkins, cravings, slips = _user_days(rng, user, start, days)
        data.users.append(user)
        data.checkins.extend(checkins)
        data.cravings.extend(cravings)
        data.slips.extend(slips)
    return data


def write_csv(data: Dataset, out: Path) -> None:
    out.mkdir(parents=True, exist_ok=True)

    def write(name: str, header: list[str], rows: list[list[object]]) -> None:
        with (out / name).open("w", newline="", encoding="utf-8") as f:
            writer = csv.writer(f, lineterminator="\n")
            writer.writerow(header)
            writer.writerows(rows)

    write("users.csv", ["user_id", "payday"], [[u.user_id, u.payday] for u in data.users])
    write(
        "checkins.csv",
        ["user_id", "day", "mood", "sleep", "stress", "craving", "tags"],
        [
            [c.user_id, c.day.isoformat(), c.mood, c.sleep, c.stress, c.craving, "|".join(c.tags)]
            for c in data.checkins
        ],
    )
    write(
        "cravings.csv",
        ["user_id", "day", "hour", "intensity", "used_sos", "passed"],
        [
            [c.user_id, c.day.isoformat(), c.hour, c.intensity, int(c.used_sos), int(c.passed)]
            for c in data.cravings
        ],
    )
    write("slips.csv", ["user_id", "day"], [[s.user_id, s.day.isoformat()] for s in data.slips])


def main(argv: Sequence[str] | None = None) -> None:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0] if __doc__ else None)
    parser.add_argument("--users", type=int, default=200)
    parser.add_argument("--days", type=int, default=180)
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument("--start", type=date.fromisoformat, default=DEFAULT_START)
    parser.add_argument("--out", type=Path, default=DEFAULT_OUT)
    args = parser.parse_args(argv)

    data = generate(users=args.users, days=args.days, seed=args.seed, start=args.start)
    write_csv(data, args.out)
    print(
        f"{len(data.users)} users, {len(data.checkins)} check-ins, "
        f"{len(data.cravings)} cravings, {len(data.slips)} slips → {args.out}"
    )


if __name__ == "__main__":
    main()
