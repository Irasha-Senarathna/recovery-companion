import hashlib
import secrets
from typing import Annotated

from fastapi import Depends, Header, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db import get_session
from app.models import Account


def new_token() -> str:
    """256 random bits. Shown to the app once; the server keeps only the hash."""
    return secrets.token_urlsafe(32)


def hash_secret(value: str) -> str:
    return hashlib.sha256(value.encode()).hexdigest()


_UNAUTHORIZED = HTTPException(
    status.HTTP_401_UNAUTHORIZED, "unauthorized", headers={"WWW-Authenticate": "Bearer"}
)


def current_account(
    db: Annotated[Session, Depends(get_session)],
    authorization: Annotated[str | None, Header()] = None,
) -> Account:
    scheme, _, token = (authorization or "").partition(" ")
    if scheme.lower() != "bearer" or not token or len(token) > 100:
        raise _UNAUTHORIZED
    account = db.scalars(select(Account).where(Account.token_hash == hash_secret(token))).first()
    if account is None:
        raise _UNAUTHORIZED
    return account


CurrentAccount = Annotated[Account, Depends(current_account)]


def require_role(account: Account, role: str) -> None:
    if account.role != role:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "wrong_role")
