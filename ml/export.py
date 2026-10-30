"""Exports the logistic regression as plain JSON for the app, plus parity fixtures."""

import json
import math
import random
from collections import defaultdict
from pathlib import Path
from typing import Any

from features import EVENING_HOUR, FEATURES, feature_vector
from generate import Dataset, generate
from schema import CheckIn
from train import Trained

MODEL_VERSION = 1
FIXTURE_COUNT = 40


def export_model(trained: Trained) -> dict[str, Any]:
    scaler = trained.lr.named_steps["scaler"]
    model = trained.lr.named_steps["model"]
    return {
        "version": MODEL_VERSION,
        "trained_on": "synthetic data from ml/generate.py (not real people)",
        "target": f"slip that day, or a strong craving from {EVENING_HOUR}:00",
        "features": list(FEATURES),
        "scaler": {
            "mean": [float(v) for v in scaler.mean_],
            "scale": [float(v) for v in scaler.scale_],
        },
        "coefficients": [float(v) for v in model.coef_[0]],
        "intercept": float(model.intercept_[0]),
        "threshold": trained.threshold,
    }


def predict(model: dict[str, Any], x: list[float]) -> float:
    """The same sum the app computes: sigmoid(w · standardised(x) + b)."""
    z = model["intercept"]
    for value, mean, scale, w in zip(
        x, model["scaler"]["mean"], model["scaler"]["scale"], model["coefficients"], strict=True
    ):
        z += w * (value - mean) / scale
    return 1 / (1 + math.exp(-z))


def _checkin_json(c: CheckIn) -> dict[str, Any]:
    return {
        "day": c.day.isoformat(),
        "mood": c.mood,
        "sleep": c.sleep,
        "stress": c.stress,
        "craving": c.craving,
        "tags": list(c.tags),
    }


def fixtures(model: dict[str, Any], data: Dataset, count: int) -> list[dict[str, Any]]:
    """Raw history → expected features and score, so the app can check it matches."""
    by_user: dict[str, list[CheckIn]] = defaultdict(list)
    for c in data.checkins:
        by_user[c.user_id].append(c)
    candidates = []
    for checkins in by_user.values():
        checkins.sort(key=lambda c: c.day)
        for i, today in enumerate(checkins):
            previous = checkins[max(0, i - 5) : i]
            candidates.append((today, previous))
    picked = random.Random(0).sample(candidates, count)
    cases = []
    for today, previous in picked:
        x = feature_vector(today, previous)
        cases.append(
            {
                "today": _checkin_json(today),
                "previous": [_checkin_json(c) for c in previous],
                "features": x,
                "score": predict(model, x),
            }
        )
    return cases


def write_app_files(trained: Trained, data: Dataset, folder: Path) -> None:
    del data  # fixtures use their own small, separate synthetic set
    folder.mkdir(parents=True, exist_ok=True)
    model = export_model(trained)
    cases = fixtures(model, generate(users=10, days=40, seed=11), FIXTURE_COUNT)
    (folder / "model.json").write_text(json.dumps(model, indent=2) + "\n", encoding="utf-8")
    (folder / "fixtures.json").write_text(json.dumps(cases, indent=2) + "\n", encoding="utf-8")
