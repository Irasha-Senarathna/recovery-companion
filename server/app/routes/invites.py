import secrets
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session

from app.auth import CurrentAccount, hash_secret, require_role
from app.db import get_session
from app.models import Invite, Link
from app.ratelimit import Limits, client_address, get_limits
from app.schemas import InviteCreated, InviteRedeem, Redeemed
from app.time import Clock, get_clock

router = APIRouter()

DbSession = Annotated[Session, Depends(get_session)]
ClockDep = Annotated[Clock, Depends(get_clock)]
LimitsDep = Annotated[Limits, Depends(get_limits)]

BASE32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567"
CODE_LENGTH = 10  # 50 bits
INVITE_TTL = 24 * 3600
MAX_SUPPORTERS = 3

# The same answer for unknown, used and expired codes, so none can be told apart.
_NOT_FOUND = HTTPException(status.HTTP_404_NOT_FOUND, "not_found")


def supporter_count(db: Session, member_id: str) -> int:
    """Pending and approved supporters both take a place."""
    count = db.scalar(select(func.count()).select_from(Link).where(Link.member_id == member_id))
    return count or 0


def new_code() -> str:
    return "".join(secrets.choice(BASE32) for _ in range(CODE_LENGTH))


def clean_code(typed: str) -> str:
    return typed.replace(" ", "").replace("-", "").upper()


@router.post("/invites", status_code=status.HTTP_201_CREATED)
def create_invite(
    account: CurrentAccount, db: DbSession, clock: ClockDep, limits: LimitsDep
) -> InviteCreated:
    require_role(account, "member")
    if supporter_count(db, account.id) >= MAX_SUPPORTERS:
        raise HTTPException(status.HTTP_409_CONFLICT, "circle_full")
    now = clock()
    limits.invites_per_member.check_and_hit(account.id, now)
    # One open code per member: a new one replaces the last.
    db.execute(delete(Invite).where(Invite.member_id == account.id))
    code = new_code()
    expires_at = now + INVITE_TTL
    db.add(Invite(code_hash=hash_secret(code), member_id=account.id, expires_at=expires_at))
    db.commit()
    return InviteCreated(code=code, expires_at=expires_at)


@router.post("/invites/redeem", status_code=status.HTTP_201_CREATED)
def redeem_invite(
    body: InviteRedeem,
    request: Request,
    account: CurrentAccount,
    db: DbSession,
    clock: ClockDep,
    limits: LimitsDep,
) -> Redeemed:
    """A supporter joins with a code. The link waits for the member's approval."""
    require_role(account, "supporter")
    now = clock()
    address = client_address(request)
    code = clean_code(body.code)
    if len(code) != CODE_LENGTH:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "invalid_code")

    # Every guess counts before the lookup, so parallel requests cannot slip past
    # the limit; a right code is refunded below.
    limits.bad_codes_per_account.check_and_hit(account.id, now)
    try:
        limits.bad_codes_per_address.check_and_hit(address, now)
    except HTTPException:
        limits.bad_codes_per_account.refund(account.id)
        raise

    invite = db.get(Invite, hash_secret(code))
    if invite is None or invite.expires_at <= now:
        raise _NOT_FOUND
    limits.bad_codes_per_account.refund(account.id)
    limits.bad_codes_per_address.refund(address)

    if supporter_count(db, invite.member_id) >= MAX_SUPPORTERS:
        raise HTTPException(status.HTTP_409_CONFLICT, "circle_full")
    already = db.scalar(
        select(Link.id).where(Link.member_id == invite.member_id, Link.supporter_id == account.id)
    )
    if already is not None:
        raise HTTPException(status.HTTP_409_CONFLICT, "already_linked")

    link = Link(
        member_id=invite.member_id, supporter_id=account.id, status="pending", created_at=now
    )
    db.add(link)
    db.delete(invite)
    db.commit()
    return Redeemed(link_id=link.id, status="pending")
