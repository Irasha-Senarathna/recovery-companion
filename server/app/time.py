import time
from collections.abc import Callable

Clock = Callable[[], int]


def system_clock() -> int:
    """Now, in whole seconds since the epoch (UTC)."""
    return int(time.time())


def get_clock() -> Clock:
    """FastAPI dependency; tests swap in a clock they can move forward."""
    return system_clock
