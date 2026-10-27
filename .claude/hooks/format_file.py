"""Hook: auto-format a file right after Claude edits it.

Python files -> ruff format. JS/TS files -> prettier (if installed).
Formatting problems never block Claude (always exit 0).
"""

import json
import shutil
import subprocess
import sys

data = json.load(sys.stdin)
path = data.get("tool_input", {}).get("file_path", "")

if path.endswith(".py") and shutil.which("ruff"):
    subprocess.run(["ruff", "format", path], capture_output=True)
    subprocess.run(["ruff", "check", "--fix", path], capture_output=True)
elif path.endswith((".ts", ".tsx", ".js", ".jsx", ".json", ".css")) and shutil.which("npx"):
    subprocess.run(["npx", "--no-install", "prettier", "--write", path], capture_output=True)

sys.exit(0)
