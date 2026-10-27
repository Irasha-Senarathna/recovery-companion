"""Hook: stop Claude from editing secret files, lock files, or the verified
safety content (helplines, disclaimers) without the user's say-so.

Claude Code sends the tool call as JSON on stdin.
Exit code 2 = block the edit and tell Claude why (message on stderr).
Exit code 0 = allow.
"""

import json
import os
import sys

# Exact file names Claude must never edit.
PROTECTED_NAMES = {
    ".env",
    "package-lock.json",
    "uv.lock",
    "poetry.lock",
    # Human-verified safety content. Only the user changes these.
    "helplines.json",
    "disclaimer.md",
}
PROTECTED_DIRS = ("/.git/",)

data = json.load(sys.stdin)
path = data.get("tool_input", {}).get("file_path", "")
name = os.path.basename(path)

if name in PROTECTED_NAMES or any(d in path for d in PROTECTED_DIRS):
    print(
        f"Blocked: '{path}' is protected. Helplines and the disclaimer must be "
        "verified and edited by the user. Secrets go in .env.example as placeholders. "
        "Tell the user what change you recommend instead.",
        file=sys.stderr,
    )
    sys.exit(2)

sys.exit(0)
