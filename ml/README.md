# ml/

Synthetic data generator (M4) and, from M5, the risk model. **Synthetic data
only — never real user data.** Nothing here describes real people; the numbers
are made-up assumptions chosen so a simple model has something to learn.

## Generate

```bash
make ml                      # = uv run python generate.py --users 200 --days 180 --seed 42
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
- **Craving (check-in)** rises with the same drivers as risk (0.5 + lift, sd 0.7),
  so strong cravings come before more slips.
- **Mood** goes up with sleep, down with stress and craving.
- **Missing data is not random:** on a slip day people are 25% less likely to
  check in. A model must not treat "no check-in" as "a good day".
- **Craving moments:** Poisson with rate 0.15 + 0.6 × craving level, mostly in
  the evening (mean 19:00); 35% use SOS; 85% pass with SOS, 70% without.
- Days run from 2026-01-05 (a Monday) unless `--start` is given.

## Tests

```bash
cd ml && uv run pytest -q     # shape, ranges, determinism, the pattern is measurable
```
