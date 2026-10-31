"""Text clean-up shared by the crisis detector, topic guard and output checker."""

import re
import unicodedata

_LEET = str.maketrans(
    {"0": "o", "1": "i", "3": "e", "4": "a", "5": "s", "7": "t", "@": "a", "$": "s"}
)
# Single letters split by spaces or marks: "d o s e", "d.o.s.e", "d-o-s-e".
_SPACED = re.compile(r"(?<![\w'@$])(?:[a-z][\s.\-_*]){2,}[a-z](?![\w@$])")
_MIXED = re.compile(r"[a-z@$]*[0-9@$][a-z0-9@$]*")


def normalise(text: str) -> str:
    """Lower-case, unify apostrophes and dashes, drop zero-width joiners, collapse spaces."""
    text = unicodedata.normalize("NFC", text).lower()
    text = re.sub(r"[‘’ʼ`]", "'", text)
    text = re.sub(r"[‐-―]", "-", text)
    text = re.sub(r"[‌‍]", "", text)
    return re.sub(r"\s+", " ", text).strip()


def _unleet(word: str) -> str:
    letters = sum(ch.isalpha() for ch in word)
    return word.translate(_LEET) if letters >= 2 else word


def deobfuscate(text: str) -> str:
    """Undo common spelling tricks ("d0se", "x@nax", "d o s e") on normalised text."""
    text = _SPACED.sub(lambda m: re.sub(r"[\s.\-_*]", "", m.group()), text)
    return _MIXED.sub(lambda m: _unleet(m.group()), text)


def variants(text: str) -> tuple[str, ...]:
    """The normalised text, plus a de-obfuscated copy when it differs."""
    clean = normalise(text)
    tricky = deobfuscate(clean)
    return (clean,) if tricky == clean else (clean, tricky)


def latin_pattern(fragments: list[str]) -> re.Pattern[str]:
    return re.compile(r"\b(?:" + "|".join(fragments) + r")\b")
