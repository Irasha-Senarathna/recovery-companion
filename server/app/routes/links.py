from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.auth import CurrentAccount, require_role
from app.db import get_session
from app.models import Account, Link
from app.schemas import LinkOut
from app.time import Clock, get_clock

router = APIRouter()

DbSession = Annotated[Session, Depends(get_session)]


def to_out(link: Link) -> LinkOut:
    # Account IDs are never returned: each side knows a link only by its own ID.
    return LinkOut(id=link.id, status=link.status, created_at=link.created_at)  # type: ignore[arg-type]


def own_link(db: Session, account: Account, link_id: str) -> Link:
    """A link this account is part of, or 404 (also for links of other people)."""
    link = db.scalars(
        select(Link).where(
            Link.id == link_id,
            or_(Link.member_id == account.id, Link.supporter_id == account.id),
        )
    ).first()
    if link is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "not_found")
    return link


@router.get("/links")
def list_links(account: CurrentAccount, db: DbSession) -> list[LinkOut]:
    side = Link.member_id if account.role == "member" else Link.supporter_id
    links = db.scalars(select(Link).where(side == account.id).order_by(Link.created_at))
    return [to_out(link) for link in links]


@router.post("/links/{link_id}/approve")
def approve_link(
    link_id: str,
    account: CurrentAccount,
    db: DbSession,
    clock: Annotated[Clock, Depends(get_clock)],
) -> LinkOut:
    link = own_link(db, account, link_id)
    require_role(account, "member")
    link.status = "active"
    # From now on: requests sent while the link was pending stay hidden from this person.
    link.created_at = clock()
    db.commit()
    return to_out(link)


@router.delete("/links/{link_id}", status_code=status.HTTP_204_NO_CONTENT)
def revoke_link(link_id: str, account: CurrentAccount, db: DbSession) -> Response:
    """Either side can end a link at any time, with no notice to the other."""
    db.delete(own_link(db, account, link_id))
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
