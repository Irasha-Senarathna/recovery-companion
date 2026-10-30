"""Record types for the synthetic dataset. Scale and tags are shared with the app."""

import json
from dataclasses import dataclass
from datetime import date
from pathlib import Path

_CONFIG = json.loads(
    (Path(__file__).resolve().parent.parent / "content" / "checkin.json").read_text("utf-8")
)

SCALE_MIN: int = _CONFIG["scale"]["min"]
SCALE_MAX: int = _CONFIG["scale"]["max"]
MEASURES: tuple[str, ...] = tuple(_CONFIG["measures"])
CHECKIN_TAGS: tuple[str, ...] = tuple(_CONFIG["tags"])


@dataclass(frozen=True)
class User:
    user_id: str
    #: Day of the month their pay arrives (a hidden driver, see README).
    payday: int


@dataclass(frozen=True)
class CheckIn:
    """One daily check-in, like the app's (levels run SCALE_MIN..SCALE_MAX)."""

    user_id: str
    day: date
    mood: int
    sleep: int
    stress: int
    craving: int
    tags: tuple[str, ...]


@dataclass(frozen=True)
class Craving:
    """A craving moment, like an SOS session in the app."""

    user_id: str
    day: date
    hour: int
    intensity: int
    used_sos: bool
    passed: bool


@dataclass(frozen=True)
class Slip:
    user_id: str
    day: date
