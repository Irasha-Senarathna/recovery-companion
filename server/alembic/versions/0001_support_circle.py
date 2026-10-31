"""Support circle: random IDs, hashes and timestamps only (see docs/privacy.md).

Revision ID: 0001
Revises:
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0001"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "account",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("token_hash", sa.String(length=64), nullable=False),
        sa.Column("role", sa.String(length=10), nullable=False),
        sa.Column("created_at", sa.BigInteger(), nullable=False),
        sa.CheckConstraint("role IN ('member', 'supporter')", name="account_role"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("token_hash"),
    )
    op.create_table(
        "invite",
        sa.Column("code_hash", sa.String(length=64), nullable=False),
        sa.Column("member_id", sa.String(length=36), nullable=False),
        sa.Column("expires_at", sa.BigInteger(), nullable=False),
        sa.ForeignKeyConstraint(["member_id"], ["account.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("code_hash"),
        sa.UniqueConstraint("member_id"),
    )
    op.create_table(
        "link",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("member_id", sa.String(length=36), nullable=False),
        sa.Column("supporter_id", sa.String(length=36), nullable=False),
        sa.Column("status", sa.String(length=10), nullable=False),
        sa.Column("created_at", sa.BigInteger(), nullable=False),
        sa.CheckConstraint("status IN ('pending', 'active')", name="link_status"),
        sa.ForeignKeyConstraint(["member_id"], ["account.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["supporter_id"], ["account.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("member_id", "supporter_id", name="link_pair"),
    )
    op.create_index(op.f("ix_link_member_id"), "link", ["member_id"], unique=False)
    op.create_index(op.f("ix_link_supporter_id"), "link", ["supporter_id"], unique=False)
    op.create_table(
        "push_token",
        sa.Column("account_id", sa.String(length=36), nullable=False),
        sa.Column("token", sa.String(length=200), nullable=False),
        sa.Column("lang", sa.String(length=2), nullable=False),
        sa.CheckConstraint("lang IN ('en', 'si', 'ta')", name="push_token_lang"),
        sa.ForeignKeyConstraint(["account_id"], ["account.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("account_id"),
    )
    op.create_table(
        "signal",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("member_id", sa.String(length=36), nullable=False),
        sa.Column("created_at", sa.BigInteger(), nullable=False),
        sa.ForeignKeyConstraint(["member_id"], ["account.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_signal_created_at"), "signal", ["created_at"], unique=False)
    op.create_index(op.f("ix_signal_member_id"), "signal", ["member_id"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_signal_member_id"), table_name="signal")
    op.drop_index(op.f("ix_signal_created_at"), table_name="signal")
    op.drop_table("signal")
    op.drop_table("push_token")
    op.drop_index(op.f("ix_link_supporter_id"), table_name="link")
    op.drop_index(op.f("ix_link_member_id"), table_name="link")
    op.drop_table("link")
    op.drop_table("invite")
    op.drop_table("account")
