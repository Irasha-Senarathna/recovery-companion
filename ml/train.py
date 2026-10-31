"""Train the risk model on synthetic data, evaluate it and export it to the app.

python train.py            # reads ml/data/, writes ml/report.md and app/src/ml/*.json

Exits with 1, without updating the app files, if the model fails the quality gate.
"""

import argparse
import sys
from collections.abc import Sequence
from dataclasses import dataclass
from pathlib import Path

from sklearn.ensemble import HistGradientBoostingClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler

from features import Rows, build_rows, load_dataset

#: Time-based split: days 0-119 train, 120-149 validation, 150-179 test.
VAL_FROM = 120
TEST_FROM = 150
SEED = 42

HERE = Path(__file__).resolve().parent


@dataclass
class Splits:
    train: Rows
    val: Rows
    test: Rows


@dataclass
class Trained:
    lr: Pipeline
    gb: HistGradientBoostingClassifier
    #: Chosen on validation data, never on test data.
    threshold: float
    base_rate: float


def _subset(rows: Rows, keep: Sequence[bool]) -> Rows:
    pick = [i for i, k in enumerate(keep) if k]
    return Rows(
        x=[rows.x[i] for i in pick],
        y=[rows.y[i] for i in pick],
        day_index=[rows.day_index[i] for i in pick],
        user_id=[rows.user_id[i] for i in pick],
    )


def split(rows: Rows) -> Splits:
    days = rows.day_index
    return Splits(
        train=_subset(rows, [d < VAL_FROM for d in days]),
        val=_subset(rows, [VAL_FROM <= d < TEST_FROM for d in days]),
        test=_subset(rows, [d >= TEST_FROM for d in days]),
    )


def choose_threshold(y: Sequence[int], scores: Sequence[float]) -> float:
    """The score cut-off with the best F1 (ties: the higher, more cautious cut-off)."""
    positives = sum(y)
    pairs = sorted(zip(scores, y, strict=True), reverse=True)
    best, best_f1, tp, fp = 0.5, -1.0, 0, 0
    # Walk down from the highest score; each distinct score is a candidate cut-off.
    for i, (score, label) in enumerate(pairs):
        tp += label
        fp += 1 - label
        if i + 1 < len(pairs) and pairs[i + 1][0] == score:
            continue
        f1 = 2 * tp / (tp + fp + positives) if tp else 0.0
        if f1 > best_f1:
            best, best_f1 = score, f1
    return float(best)


def train(splits: Splits) -> Trained:
    lr = Pipeline(
        [
            ("scaler", StandardScaler()),
            ("model", LogisticRegression(C=1.0, max_iter=2000)),
        ]
    )
    lr.fit(splits.train.x, splits.train.y)
    gb = HistGradientBoostingClassifier(max_depth=3, max_iter=150, random_state=SEED)
    gb.fit(splits.train.x, splits.train.y)
    val_scores = [float(p) for p in lr.predict_proba(splits.val.x)[:, 1]]
    return Trained(
        lr=lr,
        gb=gb,
        threshold=choose_threshold(splits.val.y, val_scores),
        base_rate=sum(splits.train.y) / len(splits.train.y),
    )


def main(argv: Sequence[str] | None = None) -> None:
    import evaluate as evaluate_module
    from evaluate import evaluate, write_report
    from export import write_app_files

    parser = argparse.ArgumentParser(description="Train, evaluate and export the risk model.")
    parser.add_argument("--data", type=Path, default=HERE / "data")
    parser.add_argument("--report", type=Path, default=HERE / "report.md")
    parser.add_argument("--app-dir", type=Path, default=HERE.parent / "app" / "src" / "ml")
    args = parser.parse_args(argv)

    data = load_dataset(args.data)
    splits = split(build_rows(data))
    trained = train(splits)
    report = evaluate(trained, splits)
    write_report(report, args.report)
    problems = evaluate_module.quality_problems(report)
    if problems:
        # The report is kept so the reason is visible; the app keeps its last good model.
        print("Quality gate failed, app model not updated:\n- " + "\n- ".join(problems))
        sys.exit(1)
    write_app_files(trained, data, args.app_dir)
    lr = report.models["logistic_regression"]
    print(f"PR-AUC {lr.pr_auc:.3f}, Brier {lr.brier:.3f} → {args.report}, {args.app_dir}")


if __name__ == "__main__":
    main()
