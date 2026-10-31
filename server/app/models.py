"""The whole server schema. Only random IDs, hashes and timestamps.

Every column must be on the allow-list in tests/test_schema_allowlist.py and in
docs/privacy.md. Never add names, contact details, free text or health data.
"""

import uuid

from sqlalchemy import BigInteger, CheckConstraint, ForeignKey, String, UniqueConstraint
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Base(DeclarativeBase):
    pass


def new_id() -> str:
    return str(uuid.uuid4())


class Account(Base):
    __tablename__ = "account"
    __table_args__ = (CheckConstraint("role IN ('member', 'supporter')", name="account_role"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    token_hash: Mapped[str] = mapped_column(String(64), unique=True)
    role: Mapped[str] = mapped_column(String(10))
    created_at: Mapped[int] = mapped_column(BigInteger)


class Invite(Base):
    """One open invite per member, single use, deleted when used or expired."""

    __tablename__ = "invite"

    code_hash: Mapped[str] = mapped_column(String(64), primary_key=True)
    member_id: Mapped[str] = mapped_column(
        ForeignKey("account.id", ondelete="CASCADE"), unique=True
    )
    expires_at: Mapped[int] = mapped_column(BigInteger)


class Link(Base):
    __tablename__ = "link"
    __table_args__ = (
        UniqueConstraint("member_id", "supporter_id", name="link_pair"),
        CheckConstraint("status IN ('pending', 'active')", name="link_status"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    member_id: Mapped[str] = mapped_column(ForeignKey("account.id", ondelete="CASCADE"), index=True)
    supporter_id: Mapped[str] = mapped_column(
        ForeignKey("account.id", ondelete="CASCADE"), index=True
    )
    status: Mapped[str] = mapped_column(String(10))
    created_at: Mapped[int] = mapped_column(BigInteger)


class Signal(Base):
    """'Please check in on me'. No content at all. Purged after 7 days."""

    __tablename__ = "signal"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    member_id: Mapped[str] = mapped_column(ForeignKey("account.id", ondelete="CASCADE"), index=True)
    created_at: Mapped[int] = mapped_column(BigInteger, index=True)


class PushToken(Base):
    """A supporter's Expo push token and the language of the fixed push text."""

    __tablename__ = "push_token"
    __table_args__ = (CheckConstraint("lang IN ('en', 'si', 'ta')", name="push_token_lang"),)

    account_id: Mapped[str] = mapped_column(
        ForeignKey("account.id", ondelete="CASCADE"), primary_key=True
    )
    token: Mapped[str] = mapped_column(String(200))
    lang: Mapped[str] = mapped_column(String(2))
