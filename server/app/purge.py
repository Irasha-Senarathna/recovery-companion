from sqlalchemy import delete
from sqlalchemy.orm import Session

from app.models import Invite, Signal

SIGNAL_TTL = 7 * 24 * 3600


def purge(db: Session, now: int) -> None:
    """Deletes signals older than 7 days and invites past their expiry."""
    db.execute(delete(Signal).where(Signal.created_at <= now - SIGNAL_TTL))
    db.execute(delete(Invite).where(Invite.expires_at <= now))
    db.commit()
