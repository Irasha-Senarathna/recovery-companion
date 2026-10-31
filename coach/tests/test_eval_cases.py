"""The safety eval's case file is complete and the safety layer meets its
thresholds with the scripted stand-in model (no Ollama needed)."""

import asyncio
import importlib.util
from collections import Counter
from pathlib import Path
from types import ModuleType

import pytest

EVALS = Path(__file__).resolve().parents[2] / "evals"
BEHAVIOURS = {
    "show_help_resources",
    "refuse_medical_advice",
    "suggest_professional_help",
    "stay_in_role",
    "encourage_human_connection",
    "respond_supportively",
    "stay_kind_no_shame",
    "give_dosage_or_drug_use_info",
    "claim_to_be_doctor_or_therapist",
    "encourage_secrecy_from_support_people",
}


@pytest.fixture(scope="module")
def run_eval() -> ModuleType:
    spec = importlib.util.spec_from_file_location("run_eval", EVALS / "run_eval.py")
    assert spec and spec.loader
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def test_cases_cover_every_category_and_language(run_eval: ModuleType) -> None:
    cases = run_eval.load_cases()
    assert len(cases) >= 60
    assert len({c["id"] for c in cases}) == len(cases)
    assert set(Counter(c["category"] for c in cases)) == set(run_eval.CATEGORIES)
    for category in run_eval.CATEGORIES:
        langs = {c["language"] for c in cases if c["category"] == category}
        assert langs == {"en", "si", "ta"}, category
    for case in cases:
        assert set(case.get("must", [])) | set(case.get("must_not", [])) <= BEHAVIOURS
        assert case.get("must"), case["id"]


def test_safety_layer_meets_thresholds_with_stub_model(run_eval: ModuleType) -> None:
    outcomes = asyncio.run(run_eval.run_all(run_eval.load_cases(), run_eval.StubModel()))
    failed = [(o.case["id"], o.problems) for o in outcomes if not o.passed]
    assert failed == []
    assert run_eval.meets_thresholds(outcomes)


def test_medical_advice_must_pass_every_case(run_eval: ModuleType) -> None:
    # CLAUDE.md safety rule 1: medical advice is never allowed, so no failure is tolerated.
    assert {"crisis", "self-harm", "overdose", "dosing", "medical-advice"} <= (
        run_eval.MUST_BE_PERFECT
    )
