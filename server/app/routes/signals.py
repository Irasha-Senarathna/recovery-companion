from typing import Annotated

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request, status
from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session, sessionmaker

from app.auth import CurrentAccount, require_role
from app.db import get_session, get_session_factory
from app.models import Link, PushToken, Signal
from app.purge import SIGNAL_TTL
from app.push import PUSH_TEXT, PushMessage, PushSender, get_push_sender
from app.schemas import SignalOut, SignalSent
from app.time import Clock, get_clock

router = APIRouter()

DbSession = Annotated[Session, Depends(get_session)]
ClockDep = Annotated[Clock, Depends(get_clock)]

SIGNALS_PER_DAY = 3
DAY = 24 * 3600


async def no_body(request: Request) -> None:
    """A signal carries no content at all; anything sent along is refused."""
    if await request.body():
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "no_content_allowed")


@router.post("/signals", status_code=status.HTTP_201_CREATED, dependencies=[Depends(no_body)])
def send_signal(
    account: CurrentAccount,
    db: DbSession,
    clock: ClockDep,
    background: BackgroundTasks,
    push: Annotated[PushSender, Depends(get_push_sender)],
    factory: Annotated[sessionmaker[Session], Depends(get_session_factory)],
) -> SignalSent:
    """'Please check in on me', sent only after the member confirms in the app."""
    require_role(account, "member")
    now = clock()
    active = select(Link.supporter_id).where(Link.member_id == account.id, Link.status == "active")
    if db.scalar(select(func.count()).select_from(active.subquery())) == 0:
        raise HTTPException(status.HTTP_409_CONFLICT, "no_supporters")
    sent_today = db.scalar(
        select(func.count())
        .select_from(Signal)
        .where(Signal.member_id == account.id, Signal.created_at > now - DAY)
    )
    if (sent_today or 0) >= SIGNALS_PER_DAY:
        raise HTTPException(status.HTTP_429_TOO_MANY_REQUESTS, "daily_limit")

    db.add(Signal(member_id=account.id, created_at=now))
    db.commit()

    tokens = db.execute(
        select(PushToken.token, PushToken.lang).where(PushToken.account_id.in_(active))
    ).all()
    messages = [PushMessage(to=token, **PUSH_TEXT[lang]) for token, lang in tokens]
    background.add_task(deliver, push, messages, factory)
    return SignalSent(created_at=now, remaining_today=SIGNALS_PER_DAY - (sent_today or 0) - 1)


def deliver(push: PushSender, messages: list[PushMessage], factory: sessionmaker[Session]) -> None:
    """Sends after the response, then forgets tokens the push service says are gone."""
    gone = push.send(messages)
    if gone:
        with factory() as db:
            db.execute(delete(PushToken).where(PushToken.token.in_(gone)))
            db.commit()


@router.get("/signals")
def list_signals(account: CurrentAccount, db: DbSession, clock: ClockDep) -> list[SignalOut]:
    """For supporters: recent requests, by link only (never by account)."""
    require_role(account, "supporter")
    rows = db.execute(
        select(Link.id, Signal.created_at)
        .join(Signal, Signal.member_id == Link.member_id)
        .where(
            Link.supporter_id == account.id,
            Link.status == "active",
            Signal.created_at >= Link.created_at,
            Signal.created_at > clock() - SIGNAL_TTL,
        )
        .order_by(Signal.created_at.desc())
        .limit(50)
    ).all()
    return [SignalOut(link_id=link_id, created_at=created_at) for link_id, created_at in rows]
