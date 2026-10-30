"""Time-based split, models and baselines (synthetic data only)."""

import pytest

from evaluate import evaluate
from features import build_rows
from generate import generate
from train import TEST_FROM, VAL_FROM, Splits, choose_threshold, split, train


@pytest.fixture(scope="module")
def splits() -> Splits:
    return split(build_rows(generate(users=200, days=180, seed=42)))


def test_split_is_by_day(splits: Splits) -> None:
    assert max(splits.train.day_index) < VAL_FROM
    assert VAL_FROM <= min(splits.val.day_index) and max(splits.val.day_index) < TEST_FROM
    assert min(splits.test.day_index) >= TEST_FROM
    assert (VAL_FROM, TEST_FROM) == (120, 150)


def test_threshold_maximises_f1() -> None:
    y = [0, 0, 1, 1]
    scores = [0.1, 0.4, 0.35, 0.8]
    assert choose_threshold(y, scores) == pytest.approx(0.35)


def test_logistic_regression_beats_both_baselines(splits: Splits) -> None:
    report = evaluate(train(splits), splits)
    lr = report.models["logistic_regression"]
    assert lr.pr_auc > report.models["base_rate"].pr_auc
    assert lr.pr_auc > report.models["simple_rule"].pr_auc
    assert "gradient_boosting" in report.models
    assert 0 < lr.brier < 0.25
    assert 0 < lr.precision <= 1 and 0 < lr.recall <= 1
    assert len(report.calibration) == 10
