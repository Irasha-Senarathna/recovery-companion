"""In-memory sliding-window limits. Keys (account IDs, client addresses) live
only in this process's memory, are never written to disk, and drop out after
their window. One server process on the laptop, so no shared store is needed.
"""

import threading
from collections import deque
from dataclasses import dataclass, field

from fastapi import HTTPException, Request, status

HOUR = 3600


@dataclass
class Limiter:
    limit: int
    window: int
    _hits: dict[str, deque[int]] = field(default_factory=dict)
    # Sync routes run in a thread pool, so every read-modify-write takes the lock.
    _lock: threading.Lock = field(default_factory=threading.Lock)

    def _recent(self, key: str, now: int) -> deque[int]:
        hits = self._hits.pop(key, deque())
        while hits and hits[0] <= now - self.window:
            hits.popleft()
        if hits:
            self._hits[key] = hits  # keys with no recent hits are forgotten
        return hits

    def check_and_hit(self, key: str, now: int) -> None:
        """Counts this attempt, or raises 429 if the limit is already reached."""
        with self._lock:
            hits = self._recent(key, now)
            if len(hits) >= self.limit:
                raise too_many()
            hits.append(now)
            self._hits[key] = hits

    def refund(self, key: str) -> None:
        """Takes back the latest attempt (e.g. the code turned out to be right)."""
        with self._lock:
            hits = self._hits.get(key)
            if hits:
                hits.pop()
                if not hits:
                    del self._hits[key]


@dataclass
class Limits:
    accounts_per_address: Limiter = field(default_factory=lambda: Limiter(10, HOUR))
    invites_per_member: Limiter = field(default_factory=lambda: Limiter(10, HOUR))
    # Brute-force guard on invite codes: failed guesses only.
    bad_codes_per_account: Limiter = field(default_factory=lambda: Limiter(5, HOUR))
    bad_codes_per_address: Limiter = field(default_factory=lambda: Limiter(20, HOUR))


def too_many() -> HTTPException:
    return HTTPException(status.HTTP_429_TOO_MANY_REQUESTS, "too_many_tries")


def get_limits(request: Request) -> Limits:
    limits: Limits = request.app.state.limits
    return limits


def client_address(request: Request) -> str:
    return request.client.host if request.client else "unknown"
