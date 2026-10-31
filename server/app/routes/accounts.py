from typing import Annotated

from fastapi import APIRouter, Depends, Request, Response, status
from sqlalchemy import delete
from sqlalchemy.orm import Session

from app.auth import CurrentAccount, hash_secret, new_token, require_role
from app.db import get_session
from app.models import Account, PushToken
from app.ratelimit import Limits, client_address, get_limits
from app.schemas import AccountCreate, AccountCreated, PushTokenIn
from app.time import Clock, get_clock

router = APIRouter()

DbSession = Annotated[Session, Depends(get_session)]


@router.post("/accounts", status_code=status.HTTP_201_CREATED)
def create_account(
    body: AccountCreate,
    request: Request,
    db: DbSession,
    clock: Annotated[Clock, Depends(get_clock)],
    limits: Annotated[Limits, Depends(get_limits)],
) -> AccountCreated:
    """Made only when the user turns the circle on. No name, email or phone."""
    now = clock()
    limits.accounts_per_address.check_and_hit(client_address(request), now)
    token = new_token()
    account = Account(token_hash=hash_secret(token), role=body.role, created_at=now)
    db.add(account)
    db.commit()
    return AccountCreated(account_id=account.id, token=token, role=body.role)


@router.delete("/account", status_code=status.HTTP_204_NO_CONTENT)
def delete_account(account: CurrentAccount, db: DbSession) -> Response:
    """Removes the account; links, invites, signals and push token cascade."""
    db.execute(delete(Account).where(Account.id == account.id))
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.put("/account/push-token", status_code=status.HTTP_204_NO_CONTENT)
def set_push_token(body: PushTokenIn, account: CurrentAccount, db: DbSession) -> Response:
    """Supporters only, after they turn on notifications in the app."""
    require_role(account, "supporter")
    db.merge(PushToken(account_id=account.id, token=body.token, lang=body.lang))
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.delete("/account/push-token", status_code=status.HTTP_204_NO_CONTENT)
def remove_push_token(account: CurrentAccount, db: DbSession) -> Response:
    db.execute(delete(PushToken).where(PushToken.account_id == account.id))
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
