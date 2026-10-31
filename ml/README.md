# ml/

Synthetic data generator (M4) and the risk model (M5). **Synthetic data
only — never real user data.** Nothing here describes real people; the numbers
are made-up assumptions chosen so a simple model has something to learn.

## Generate

```bash
make ml                      # generate → train → evaluate → export (see below)
uv run python generate.py --users 20 --days 30 --seed 7 --out /tmp/demo
```

The same arguments always produce byte-identical files (`random.Random(seed)`,
no clock, no set ordering). Output goes to `ml/data/` (git-ignored).

| File | Columns |
| --- | --- |
| `users.csv` | `user_id`, `payday` (day of month) |
| `checkins.csv` | `user_id`, `day`, `mood`, `sleep`, `stress`, `craving` (all 0–4, as in the app), `tags` (`|`-separated) |
| `cravings.csv` | `user_id`, `day`, `hour`, `intensity` (1–4), `used_sos`, `passed` (0/1) |
| `slips.csv` | `user_id`, `day` |

Scale and tags come from `content/checkin.json`, the same file the app uses.

## Planted patterns

Each day has a hidden slip risk, `sigmoid(base + lift)`:

| Driver | Effect on log-odds |
| --- | --- |
| Per-user base | Normal(−4.8, 0.4) — roughly 1% on a calm day |
| Poor sleep (sleep ≤ 1) | +1.0 |
| High stress (stress ≥ 3) | +0.9 |
| Weekend | +0.3 to +0.7 (varies per user) |
| **Poor sleep + high stress + weekend together** | **+0.8 extra** |
| Payday and the day after | +0.7 |
| The 3 days after a slip | +0.6 |
| Tags `conflict` / `old_routine` / `risky_place` | +0.5 / +0.8 / +0.8 |

With seed 42 the slip rate is about **19%** on poor-sleep + high-stress + weekend
days versus about **2%** on other days; the tests check it is more than 4×.

## Assumptions (all made up)

- **Users:** each has a usual sleep (uniform 1.6–3.2) and stress (1.0–2.6)
  level, a check-in habit (65–95% of days) and a payday on the 1st, 10th or 25th.
- **Stress** carries over from the day before (60% usual level, 40% yesterday),
  is +0.4 on weekdays and −0.3 at weekends, with noise (sd 0.9).
- **Sleep** is worse when stress is high (−0.35 per stress step), noise sd 0.9.
- **Tags** follow the day: `tired` is likely after poor sleep, `work_stress` on
  stressful weekdays, `payday` on payday, `celebration`/`bored`/`old_routine`
  more at weekends. Fixed chances are in `generate.py`.
- **Craving (check-in)** is a noisy, partial view of the day's real pressure:
  0.5 + 0.6 × lift, noise sd 1.0. Strong reported cravings still come before
  more slips, but sleep, stress and weekends carry their own signal (in the
  first version the report copied the risk almost exactly, so the model
  learned nothing else).
- **Mood** goes up with sleep, down with stress and craving.
- **Missing data is not random:** on a slip day people are 25% less likely to
  check in. A model must not treat "no check-in" as "a good day".
- **Craving moments:** Poisson with rate 0.15 + 0.45 × (0.5 + lift), intensity
  0.5 + lift (noise sd 0.9), mostly in the evening (mean 19:00); 35% use SOS;
  85% pass with SOS, 70% without.
- Days run from 2026-01-05 (a Monday) unless `--start` is given.

## Risk model (M5)

`train.py` reads `ml/data/`, builds one row per check-in with `features.py`
(the app's `featureBuilder.ts` computes the same, checked by a parity test),
and predicts a **hard day**: a slip that day, or a strong craving (intensity
≥ 3) from 17:00 on.

- **Slips as a feature (M7):** `slip_recent` is 1 when the user logged a slip in
  the 3 days before the check-in (never the same day: that is the label). It
  matches the planted "3 days after a slip" pattern above and is explained in the
  app as "a slip in the last few days". The plan said "days since last slip"; a
  3-day flag was chosen because the risk in the data is a short step, which a
  linear model fits better as a flag than as a count. Model version 2.
- **Split by day:** days 0–119 train, 120–149 validation (threshold = best F1),
  150–179 test. No row from a later day is ever used to predict an earlier one.
- **Models:** logistic regression (shipped, explainable) vs a small gradient-boosted
  model, a base-rate baseline and a simple rule (strong craving, or poor sleep with
  high stress).
- **Results:** `ml/report.md` (PR-AUC, Brier, precision, recall, calibration table,
  strongest features, honesty note). The tests require logistic regression to
  beat both baselines on PR-AUC.
- **Export:** `app/src/ml/model.json` (version, features, scaler, coefficients,
  intercept, threshold) and `fixtures.json` (synthetic histories with expected
  features and scores; app and Python must agree within 1e-6).

## Tests

```bash
cd ml && uv run pytest -q     # generator, features, split, baselines, export
```
