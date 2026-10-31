"""The CI gate: `make ml` fails when the shipped model stops beating its baselines."""

import math
from dataclasses import replace
from pathlib import Path

import pytest

from evaluate import Report, evaluate, quality_problems
from features import build_rows
from generate import generate, write_csv
from train import main, split, train


@pytest.fixture(scope="module")
def report() -> Report:
    splits = split(build_rows(generate(users=200, days=180, seed=42)))
    return evaluate(train(splits), splits)


def _with_lr(report: Report, **changes: float) -> Report:
    models = dict(report.models)
    models["logistic_regression"] = replace(models["logistic_regression"], **changes)
    return replace(report, models=models)


def test_current_model_passes(report: Report) -> None:
    assert quality_problems(report) == []


def test_fails_when_no_better_than_base_rate(report: Report) -> None:
    worse = _with_lr(report, pr_auc=report.models["base_rate"].pr_auc)
    assert any("base rate" in p for p in quality_problems(worse))


def test_fails_when_no_better_than_simple_rule(report: Report) -> None:
    worse = _with_lr(report, pr_auc=report.models["simple_rule"].pr_auc - 0.01)
    assert any("simple rule" in p for p in quality_problems(worse))


def test_fails_when_brier_worse_than_base_rate(report: Report) -> None:
    worse = _with_lr(report, brier=report.models["base_rate"].brier + 0.01)
    assert any("Brier" in p for p in quality_problems(worse))


def test_fails_when_model_never_flags_a_day(report: Report) -> None:
    worse = _with_lr(report, recall=0.0)
    assert any("recall" in p for p in quality_problems(worse))


def test_missing_model_is_a_problem(report: Report) -> None:
    models = {k: v for k, v in report.models.items() if k != "logistic_regression"}
    assert quality_problems(replace(report, models=models)) != []


def test_main_exits_non_zero_when_gate_fails(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    write_csv(generate(users=40, days=180, seed=7), tmp_path / "data")
    monkeypatch.setattr("evaluate.quality_problems", lambda _report: ["made up problem"])
    args = ["--data", str(tmp_path / "data"), "--report", str(tmp_path / "report.md")]
    with pytest.raises(SystemExit) as exit_info:
        main([*args, "--app-dir", str(tmp_path / "app")])
    assert exit_info.value.code == 1
    # The report is still written, so CI can show why it failed.
    assert (tmp_path / "report.md").exists()
    # ...but the app keeps its last good model.
    assert not (tmp_path / "app").exists()


@pytest.mark.parametrize("metric", ["pr_auc", "brier", "recall"])
def test_nan_metrics_fail(report: Report, metric: str) -> None:
    assert any(
        "not a number" in p for p in quality_problems(_with_lr(report, **{metric: math.nan}))
    )
