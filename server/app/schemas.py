"""Request and response bodies. Requests forbid unknown fields, so nothing
personal can be sent along by mistake."""

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

Role = Literal["member", "supporter"]
Lang = Literal["en", "si", "ta"]


class Strict(BaseModel):
    model_config = ConfigDict(extra="forbid")


class AccountCreate(Strict):
    role: Role


class AccountCreated(BaseModel):
    account_id: str
    token: str
    role: Role


class InviteCreated(BaseModel):
    code: str
    expires_at: int


class InviteRedeem(Strict):
    # Spaces and dashes are allowed while typing; checked again after cleaning.
    code: str = Field(min_length=10, max_length=14, pattern=r"^[A-Za-z2-7 \-]+$")


class LinkOut(BaseModel):
    id: str
    status: Literal["pending", "active"]
    created_at: int


class Redeemed(BaseModel):
    link_id: str
    status: Literal["pending"]


class SignalSent(BaseModel):
    created_at: int
    remaining_today: int


class SignalOut(BaseModel):
    link_id: str
    created_at: int


class PushTokenIn(Strict):
    token: str = Field(max_length=200, pattern=r"^Expo(nent)?PushToken\[[A-Za-z0-9_\-]+\]$")
    lang: Lang
