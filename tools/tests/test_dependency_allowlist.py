"""The dependency allow-list: no analytics, ads or crash-reporting SDKs, ever."""

import json
from pathlib import Path

import pytest

from check_dependencies import ROOT, check, is_denied, load_allowlist

PYPROJECT = """[project]
name = "{name}"
dependencies = [{deps}]

[dependency-groups]
dev = ["pytest>=8.3"]
"""


def _repo(
    tmp_path: Path,
    *,
    npm: dict[str, str] | None = None,
    npm_dev: dict[str, str] | None = None,
    npm_lock: list[str] | None = None,
    server: list[str] | None = None,
    uv_lock: list[str] | None = None,
) -> Path:
    """A tiny copy of the repo layout with only the dependency files."""
    (tmp_path / "app").mkdir()
    package = {"dependencies": npm or {"expo": "~58.0.20"}, "devDependencies": npm_dev or {}}
    (tmp_path / "app" / "package.json").write_text(json.dumps(package))
    lock_names = npm_lock if npm_lock is not None else list(package["dependencies"])
    lock: dict[str, dict[str, object]] = {
        "packages": {key: {} for key in ["", *(f"node_modules/{n}" for n in lock_names)]}
    }
    (tmp_path / "app" / "package-lock.json").write_text(json.dumps(lock))
    for project in ("server", "coach", "ml", "tools"):
        (tmp_path / project).mkdir()
        deps = server if project == "server" and server is not None else ["fastapi>=0.115"]
        quoted = ", ".join(f'"{d}"' for d in deps)
        (tmp_path / project / "pyproject.toml").write_text(
            PYPROJECT.format(name=project, deps=quoted)
        )
        names = uv_lock if project == "server" and uv_lock is not None else ["fastapi"]
        (tmp_path / project / "uv.lock").write_text(
            "".join(f'[[package]]\nname = "{n}"\nversion = "1.0"\n\n' for n in names)
        )
    return tmp_path


ALLOW = {"npm": ["expo", "jest"], "python": ["fastapi", "pytest"]}


def test_real_repo_passes() -> None:
    assert check(ROOT, load_allowlist()) == []


def test_allowed_dependencies_pass(tmp_path: Path) -> None:
    assert check(_repo(tmp_path, npm_dev={"jest": "^30"}), ALLOW) == []


@pytest.mark.parametrize(
    "package",
    [
        "@segment/analytics-react-native",
        "@react-native-firebase/analytics",
        "@sentry/react-native",
        "react-native-google-mobile-ads",
        "expo-tracking-transparency",
        "mixpanel-react-native",
        "posthog-react-native",
        "@amplitude/analytics-react-native",
        "react-native-fbsdk-next",
        "react-native-appsflyer",
    ],
)
def test_analytics_and_ad_sdks_fail(tmp_path: Path, package: str) -> None:
    allow = {"npm": [*ALLOW["npm"], package], "python": ALLOW["python"]}
    problems = check(_repo(tmp_path, npm={"expo": "1", package: "1"}), allow)
    assert any(package in p and "not allowed" in p for p in problems)


def test_unlisted_npm_dependency_fails(tmp_path: Path) -> None:
    problems = check(_repo(tmp_path, npm={"expo": "1", "left-pad": "1"}), ALLOW)
    assert any("left-pad" in p and "allow-list" in p for p in problems)


def test_unlisted_dev_dependency_fails(tmp_path: Path) -> None:
    problems = check(_repo(tmp_path, npm_dev={"jest": "1", "is-odd": "1"}), ALLOW)
    assert any("is-odd" in p for p in problems)


def test_unlisted_python_dependency_fails(tmp_path: Path) -> None:
    problems = check(_repo(tmp_path, server=["fastapi>=0.115", "requests>=2"]), ALLOW)
    assert any("requests" in p and "server" in p for p in problems)


def test_python_tracking_sdk_fails(tmp_path: Path) -> None:
    allow = {"npm": ALLOW["npm"], "python": [*ALLOW["python"], "sentry-sdk"]}
    problems = check(_repo(tmp_path, server=["fastapi", "sentry-sdk[fastapi]>=2"]), allow)
    assert any("sentry-sdk" in p and "not allowed" in p for p in problems)


def test_transitive_npm_tracker_in_lock_fails(tmp_path: Path) -> None:
    repo = _repo(tmp_path, npm_lock=["expo", "node_modules/expo/node_modules/@sentry/core"])
    problems = check(repo, ALLOW)
    assert any("@sentry/core" in p and "package-lock.json" in p for p in problems)


def test_transitive_python_tracker_in_lock_fails(tmp_path: Path) -> None:
    problems = check(_repo(tmp_path, uv_lock=["fastapi", "posthog"]), ALLOW)
    assert any("posthog" in p and "uv.lock" in p for p in problems)


def test_python_names_are_normalised(tmp_path: Path) -> None:
    allow = {"npm": ALLOW["npm"], "python": ["fastapi", "pytest", "pydantic-settings"]}
    assert check(_repo(tmp_path, server=["fastapi", "Pydantic_Settings>=2"]), allow) == []


def test_denied_name_cannot_be_put_on_the_allow_list(tmp_path: Path) -> None:
    allow = {"npm": [*ALLOW["npm"], "@sentry/react-native"], "python": ALLOW["python"]}
    problems = check(_repo(tmp_path), allow)
    assert any("allow-list itself" in p for p in problems)


@pytest.mark.parametrize(
    "name",
    ["expo-notifications", "react-native-safe-area-context", "headers", "uploads", "threads"],
)
def test_ordinary_names_are_not_denied(name: str) -> None:
    assert not is_denied(name)


@pytest.mark.parametrize(
    "spec",
    [
        "npm:@sentry/react-native@6",
        "github:someone/expo-fork",
        "git+https://example.org/x.git",
        "https://example.org/x.tgz",
        "file:../x",
        "link:../x",
    ],
)
def test_aliases_and_non_registry_sources_fail(tmp_path: Path, spec: str) -> None:
    problems = check(_repo(tmp_path, npm={"expo": spec}), ALLOW)
    assert any("expo" in p and "registry" in p for p in problems)


def test_aliased_tracker_in_lock_fails(tmp_path: Path) -> None:
    repo = _repo(tmp_path)
    lock_path = repo / "app" / "package-lock.json"
    lock = json.loads(lock_path.read_text())
    lock["packages"]["node_modules/expo"] = {"name": "@sentry/react-native"}
    lock_path.write_text(json.dumps(lock))
    assert any("@sentry/react-native" in p for p in check(repo, ALLOW))


def test_lock_entry_from_outside_the_registry_fails(tmp_path: Path) -> None:
    repo = _repo(tmp_path)
    lock_path = repo / "app" / "package-lock.json"
    lock = json.loads(lock_path.read_text())
    lock["packages"]["node_modules/expo"] = {"resolved": "https://evil.example/expo.tgz"}
    lock_path.write_text(json.dumps(lock))
    assert any("expo" in p and "registry" in p for p in check(repo, ALLOW))


def test_missing_lock_file_fails(tmp_path: Path) -> None:
    repo = _repo(tmp_path)
    (repo / "coach" / "uv.lock").unlink()
    assert any("coach/uv.lock" in p and "missing" in p for p in check(repo, ALLOW))


def test_optional_python_dependencies_are_checked(tmp_path: Path) -> None:
    repo = _repo(tmp_path)
    pyproject = repo / "ml" / "pyproject.toml"
    pyproject.write_text(
        pyproject.read_text() + '\n[project.optional-dependencies]\nx = ["langsmith"]\n'
    )
    assert any("langsmith" in p and "not allowed" in p for p in check(repo, ALLOW))


@pytest.mark.parametrize(
    "name",
    [
        "expo-insights",
        "@posthog/react-native-session-replay",
        "@rudderstack/rudder-sdk-react-native",
        "@statsig/react-native-bindings",
        "@embrace-io/react-native",
        "@onesignal/node-onesignal",
        "@opentelemetry/exporter-trace-otlp-http",
        "langsmith",
        "langfuse",
        "traceloop-sdk",
        "agentops",
        "wandb",
        "arize-phoenix",
        "raygun4py",
        "highlight-io",
    ],
)
def test_more_tracking_sdks_are_denied(name: str) -> None:
    assert is_denied(name)
