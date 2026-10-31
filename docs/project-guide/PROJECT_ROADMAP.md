# Project roadmap

[Handbook home](README.md) · Previous: [Developer guide](DEVELOPER_GUIDE.md) · Next: [Glossary](GLOSSARY.md)

The project was built in 11 milestones. Each had a goal, files and acceptance criteria
ending in passing tests. Full detail, including the results of each milestone, is in
[plan.md](../plan.md).

## Completed milestones

| # | Milestone | What it delivered |
|---|---|---|
| M1 | Scaffold | Folders, Expo app with navigation, i18n and dark mode; FastAPI `/health`; Docker Compose; Makefile; placeholder content files |
| M2 | Secure foundation | SQLCipher database with a Keystore key, PIN and biometric lock, quick-hide, delete-all, help button on every screen, crisis detector, network boundary |
| M3 | Craving SOS | Guided exercises, reasons vault (text, photo, voice), call my support person, outcome question, stats |
| M4 | Daily check-in + synthetic data | 20-second check-in, neutral reminder, synthetic data generator |
| M5 | Trigger map + early warning | Logistic regression trained on synthetic data, on-device scoring and explanations, personal patterns, coping plan, at most one neutral nudge a day |
| M6 | Support circle | FastAPI + Postgres API, invites with check codes, consent sheet, supporter mode, optional push |
| M7 | Shame-free slips, goals, progress | Strong days that never reset, gentle slip questions, rebuild-your-life goals, money towards your life |
| M8 | Treatment and support finder | Verified places file, filters, first-visit guide in 3 languages |
| M9 | Optional AI coping coach | Coach service with crisis check, topic guard, output checker; 78-case safety eval |
| M10 | Accessibility and polish | Labels and roles everywhere, contrast, large text, full si/ta coverage marked `needs_review`, offline tests, About page, neutral app name |
| M11 | CI/CD, demo, README | GitHub Actions, GHCR images, EAS preview workflow, dependency allow-list, ML quality gate, deployment guide, portfolio README |

## Partially done or needs a person

| Item | Status | What is needed |
|---|---|---|
| Sinhala and Tamil text, crisis and shame word lists, first-visit guides | **Partial** | Native-speaker review (strings are marked `needs_review`) |
| Slip and coach wording | **Partial** | A clinician's read |
| Support-circle push notifications | **Partial** | FCM setup for the Expo project; until then supporters see requests in the app |
| Demo video | **Planned** | Record a 2-minute walk-through; the README has a placeholder |
| Live safety-eval report | **Partial** | Re-run `make safety-eval ARGS="--live"` after changes and commit `evals/report.md` |
| Branch protection | **Planned** | Require the CI checks on `main` in GitHub settings |
| OpenChoreo deployment | **Planned** | Only a mapping and sketch exist ([deploy.md](../deploy.md#4-openchoreo)) |

## Carry-overs (known, deliberately left for later)

From the milestone results in [plan.md](../plan.md):

- **Neutral Android package ID and URL scheme.** `dev.recoverycompanion.app` and the
  `recoverycompanion` scheme can be seen by other apps. Changing them needs a fresh
  install and re-registered EAS/FCM.
- Load the coach's word lists at start-up, so a missing file fails fast.
- An offline test through the real `SessionProvider` (queued server deletions at launch).
- "Mark goal as done" that keeps its wins; demo slips in the developer tools.
- Digest-pinned base images, with Dependabot or Renovate to update them.
- Server: purge accounts unseen for a long time (needs a `last_seen_day` column),
  row locks so parallel requests cannot exceed the 3-signal or 3-supporter limits,
  a unique push token, a guard against double account creation, and a "this
  connection has ended" note for supporters.
- TLS for the coach, if it is ever used away from the laptop.

## Future improvements

| Idea | Why |
|---|---|
| iOS build | Reach more people (needs iOS-specific privacy work, such as the app-switcher snapshot) |
| Larger, reviewed safety eval set | 78 cases is small; rule-based checks can miss new phrasing |
| A small, consented pilot with a treatment partner | Learn whether the features help before any real-data modelling |
| Real-data risk model (only after ethics approval) | The current model says nothing about real people |
| More regions and languages | Content files are region-specific and must be verified per country |

## Related pages

- [plan.md](../plan.md): acceptance criteria and results for every milestone
- [Features](FEATURES.md): what is built today
