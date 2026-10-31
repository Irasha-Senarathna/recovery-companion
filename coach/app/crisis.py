"""Second crisis check (safety rule 4). The phone checks first, before sending;
this catches anything that reaches the service anyway. Same word list as the app.
"""

import json
import re
from functools import cache
from pathlib import Path

from app.config import settings
from app.text import latin_pattern, normalise, variants

HERE = Path(__file__).resolve().parent


def content_path(name: str) -> Path:
    """A shared file in content/: next to the app in Docker, at the repo root otherwise."""
    if settings.content_dir:
        return Path(settings.content_dir) / name
    for base in (HERE.parent, HERE.parent.parent):
        candidate = base / "content" / name
        if candidate.exists():
            return candidate
    raise FileNotFoundError(f"content/{name} not found")


def terms_path() -> Path:
    return content_path("crisis_terms.json")


@cache
def _matchers() -> tuple[re.Pattern[str], tuple[str, ...]]:
    data = json.loads(terms_path().read_text(encoding="utf-8"))
    pattern = latin_pattern(data["en"]["patterns"] + data["romanised"]["patterns"])
    script = tuple(normalise(t) for t in data["si"]["terms"] + data["ta"]["terms"])
    return pattern, script


def detect_crisis(text: str) -> bool:
    """True if the text contains crisis words in any app language."""
    pattern, script = _matchers()
    for clean in variants(text):
        if clean and (pattern.search(clean) or any(term in clean for term in script)):
            return True
    return False
