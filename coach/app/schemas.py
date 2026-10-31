from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field

from app.topic_guard import Topic

Language = Literal["en", "si", "ta"]
Text = Annotated[str, Field(min_length=1, max_length=500)]
MAX_HISTORY = 6


class Turn(BaseModel):
    model_config = ConfigDict(extra="forbid")

    role: Literal["user", "coach"]
    text: Text


class CoachRequest(BaseModel):
    """The current message and at most the last 6 turns. Held in memory only."""

    model_config = ConfigDict(extra="forbid")

    lang: Language
    message: Text
    history: Annotated[list[Turn], Field(max_length=MAX_HISTORY)] = []


class CoachResult(BaseModel):
    """What the app shows. Only `reply` carries model text; every other kind is
    shown with the app's own fixed, translated text and help buttons.
    """

    kind: Literal["reply", "crisis", "refusal", "fallback"]
    topic: Topic | None = None
    text: str | None = None
    # "reach_out": the user leans only on the coach; the app adds a gentle note.
    note: Literal["reach_out"] | None = None
