"""model.json carries everything the app needs, and gives sklearn's scores."""

import json
from pathlib import Path

import pytest

from export import MODEL_VERSION, export_model, fixtures, predict
from features import FEATURES, build_rows
from generate import generate
from train import Trained, split, train


@pytest.fixture(scope="module")
def trained() -> Trained:
    return train(split(build_rows(generate(users=60, days=180, seed=3))))


def test_model_json_has_spec_scaler_coefficients_threshold(trained: Trained) -> None:
    model = export_model(trained)
    assert model["version"] == MODEL_VERSION
    assert model["features"] == list(FEATURES)
    assert len(model["scaler"]["mean"]) == len(model["scaler"]["scale"]) == len(FEATURES)
    assert len(model["coefficients"]) == len(FEATURES)
    assert isinstance(model["intercept"], float)
    assert 0 < model["threshold"] < 1
    assert "synthetic" in model["trained_on"]
    json.dumps(model)  # plain JSON only


def test_json_scores_match_sklearn(trained: Trained) -> None:
    model = export_model(trained)
    rows = build_rows(generate(users=5, days=30, seed=9))
    expected = trained.lr.predict_proba(rows.x)[:, 1]
    for x, want in zip(rows.x, expected, strict=True):
        assert predict(model, x) == pytest.approx(float(want), abs=1e-9)


def test_fixtures_hold_raw_history_features_and_score(trained: Trained, tmp_path: Path) -> None:
    model = export_model(trained)
    cases = fixtures(model, generate(users=3, days=20, seed=5), count=12)
    assert len(cases) == 12
    case = cases[0]
    assert set(case) == {"today", "previous", "features", "score"}
    assert len(case["features"]) == len(FEATURES)
    assert case["score"] == pytest.approx(predict(model, case["features"]), abs=1e-12)
