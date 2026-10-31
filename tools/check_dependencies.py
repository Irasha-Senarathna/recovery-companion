"""Dependency allow-list check (privacy rule: no third-party analytics or ad SDKs).

python check_dependencies.py      # exit 1 and list the problems if any are found

Two checks:
1. Every direct dependency (app/package.json; server, coach, ml, tools pyproject.toml) must be
   on `dependency_allowlist.json`. Adding one is a reviewed change to that file.
2. No package anywhere in the lock files, direct or transitive, may be an analytics,
   advertising, attribution or crash-reporting SDK (DENIED below). These names can
   not be put on the allow-list either. Aliased packages are checked by their real name.
3. Every npm package must come from the npm registry: no `npm:` aliases, git, URL or
   file sources in package.json, and no lock entry resolved from anywhere else.
"""

import json
import re
import sys
import tomllib
from pathlib import Path
from typing import Any

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
ALLOWLIST = HERE / "dependency_allowlist.json"
PYTHON_PROJECTS = ("server", "coach", "ml", "tools")

# Exact names, or prefixes ending in "/" (npm scopes) or "-" (name families).
DENIED_NPM = (
    # analytics and product tracking
    "@segment/", "analytics-react-native", "@amplitude/", "amplitude-js", "mixpanel",
    "mixpanel-react-native", "mixpanel-browser", "posthog-react-native", "posthog-js",
    "@heap/", "@braze/", "react-native-clevertap", "@aptabase/", "react-ga", "react-ga4",
    "@vercel/analytics", "expo-analytics", "expo-analytics-amplitude", "expo-firebase-analytics",
    "@react-native-firebase/", "firebase", "@firebase/", "countly-sdk-react-native-bridge",
    "@microsoft/applicationinsights-web", "appcenter", "appcenter-", "@datadog/",
    "@newrelic/", "newrelic", "logrocket", "@logrocket/", "@intercom/", "smartlook-",
    # crash reporting (sends device and usage data to a third party)
    "@sentry/", "sentry-expo", "@bugsnag/", "instabug-reactnative", "@instabug/",
    # advertising, attribution and tracking permission prompts
    "react-native-google-mobile-ads", "react-native-admob", "expo-ads-admob",
    "expo-ads-facebook", "react-native-fbsdk", "react-native-fbsdk-next", "react-native-fbads",
    "react-native-appsflyer", "react-native-adjust", "react-native-branch",
    "react-native-kochava-tracker", "expo-tracking-transparency", "react-native-onesignal",
    "onesignal-expo-plugin", "@applovin/", "react-native-applovin-max",
    "react-native-unity-ads", "@airship/",
    # more analytics, session replay, feature-flag telemetry and APM
    "expo-insights", "@posthog/", "@rudderstack/", "@snowplow/", "@statsig/",
    "@launchdarkly/", "@embrace-io/", "@fullstory/", "@grafana/faro-",
    "@microsoft/applicationinsights-", "@vercel/speed-insights", "react-native-mixpanel",
    "react-native-ux-cam", "@onesignal/", "@customerio/", "@iterable/",
    "@opentelemetry/exporter-",
)  # fmt: skip
DENIED_PYTHON = (
    "sentry-sdk", "raven", "bugsnag", "rollbar", "honeybadger", "posthog", "mixpanel",
    "analytics-python", "segment-analytics-python", "amplitude-analytics", "ddtrace",
    "datadog", "newrelic", "elastic-apm", "scout-apm", "logfire", "opentelemetry-exporter-",
    # LLM tracing: would send coach messages to a third party
    "langsmith", "langfuse", "helicone", "traceloop-sdk", "openlit", "agentops", "wandb",
    "arize-phoenix",
    # error reporting and APM
    "airbrake", "pybrake", "raygun4py", "appsignal", "atatus", "honeycomb-beeline",
    "highlight-io",
)  # fmt: skip
NPM_REGISTRY = "https://registry.npmjs.org/"
# Version specs that install something other than the named package from the registry.
NON_REGISTRY_SPECS = ("npm:", "git", "github:", "http:", "https:", "file:", "link:")


def normalise_python(name: str) -> str:
    """PEP 503: case and runs of '-', '_' and '.' do not matter."""
    return re.sub(r"[-_.]+", "-", name).lower()


def _matches(name: str, patterns: tuple[str, ...]) -> bool:
    return any(name.startswith(p) if p.endswith(("/", "-")) else name == p for p in patterns)


def is_denied(name: str) -> bool:
    return _matches(name, DENIED_NPM) or _matches(normalise_python(name), DENIED_PYTHON)


def load_allowlist(path: Path = ALLOWLIST) -> dict[str, list[str]]:
    data: dict[str, Any] = json.loads(path.read_text(encoding="utf-8"))
    return {"npm": list(data["npm"]), "python": list(data["python"])}


def _requirement_name(requirement: str) -> str:
    match = re.match(r"\s*([A-Za-z0-9][A-Za-z0-9._-]*)", requirement)
    return normalise_python(match.group(1)) if match else requirement


def _python_direct(pyproject: Path) -> list[str]:
    data: dict[str, Any] = tomllib.loads(pyproject.read_text(encoding="utf-8"))
    project = data.get("project", {})
    requirements = list(project.get("dependencies", []))
    for extra in project.get("optional-dependencies", {}).values():
        requirements += list(extra)
    for group in data.get("dependency-groups", {}).values():
        requirements += [r for r in group if isinstance(r, str)]
    return [_requirement_name(r) for r in requirements]


def _uv_locked(lock: Path) -> list[str]:
    data: dict[str, Any] = tomllib.loads(lock.read_text(encoding="utf-8"))
    return [normalise_python(p["name"]) for p in data.get("package", [])]


def _npm_locked(lock: Path) -> list[tuple[str, str | None, str | None]]:
    """(folder name, real name if aliased, resolved URL) for each installed package."""
    packages: dict[str, Any] = json.loads(lock.read_text(encoding="utf-8")).get("packages", {})
    return [
        (key.rsplit("node_modules/", 1)[-1], entry.get("name"), entry.get("resolved"))
        for key, entry in packages.items()
        if key.startswith("node_modules/") or "/node_modules/" in key
    ]


def check(root: Path, allowlist: dict[str, list[str]]) -> list[str]:
    problems: list[str] = []
    allowed_npm = set(allowlist.get("npm", []))
    allowed_python = {normalise_python(n) for n in allowlist.get("python", [])}

    for name in sorted(allowed_npm | allowed_python):
        if is_denied(name):
            problems.append(f"{name}: on the allow-list itself, but analytics/ad SDKs are banned")

    package = json.loads((root / "app" / "package.json").read_text(encoding="utf-8"))
    for section in ("dependencies", "devDependencies"):
        for name, spec in sorted(package.get(section, {}).items()):
            if str(spec).startswith(NON_REGISTRY_SPECS):
                problems.append(f"{name} (app {section}): '{spec}' is not from the npm registry")
            elif is_denied(name):
                problems.append(f"{name} (app {section}): not allowed, analytics/ad SDK")
            elif name not in allowed_npm:
                problems.append(f"{name} (app {section}): not on the allow-list")

    npm_lock = root / "app" / "package-lock.json"
    if not npm_lock.exists():
        problems.append("app/package-lock.json: missing, so installed packages cannot be checked")
    for folder, real, resolved in sorted(_npm_locked(npm_lock) if npm_lock.exists() else []):
        for installed in sorted({folder, real or folder}):
            if is_denied(installed):
                problems.append(
                    f"{installed} (app/package-lock.json): not allowed, ad/analytics SDK"
                )
        if resolved and not resolved.startswith(NPM_REGISTRY):
            problems.append(f"{folder} (app/package-lock.json): not from the npm registry")

    for project in PYTHON_PROJECTS:
        for name in sorted(set(_python_direct(root / project / "pyproject.toml"))):
            if is_denied(name):
                problems.append(f"{name} ({project}/pyproject.toml): not allowed, analytics SDK")
            elif name not in allowed_python:
                problems.append(f"{name} ({project}/pyproject.toml): not on the allow-list")
        lock = root / project / "uv.lock"
        if not lock.exists():
            problems.append(f"{project}/uv.lock: missing, so installed packages cannot be checked")
        for name in sorted(set(_uv_locked(lock)) if lock.exists() else ()):
            if is_denied(name):
                problems.append(f"{name} ({project}/uv.lock): not allowed, analytics SDK")

    return problems


def main() -> int:
    problems = check(ROOT, load_allowlist())
    for problem in problems:
        print(f"FAIL {problem}")
    if problems:
        print(
            "\nAnalytics, advertising and crash-reporting SDKs are not allowed (CLAUDE.md,"
            " privacy rules). For any other new dependency, add it to"
            " tools/dependency_allowlist.json in the same pull request."
        )
        return 1
    print("Dependency allow-list: OK")
    return 0


if __name__ == "__main__":
    sys.exit(main())
