# Plan — Recovery Companion

Status: **awaiting approval**. No code is written until this plan is approved.
Each milestone is built with `/milestone N`: plan → tests first → implement →
`make lint` + `make test` → reviewer subagents → docs → summary.

## Decisions from the kickoff interview

- Android only. **Expo development build made with EAS Build (free tier)**,
  installed as an APK. Day-to-day work uses `npx expo start --dev-client`
  (live reload). Rebuild only when native dependencies change.
- **SQLCipher** encrypted SQLite (expo-sqlite), key in `expo-secure-store`.
- Supporters use the **same app in supporter mode**.
- Backend runs **on the laptop with Docker Compose**. Phones reach it on the same Wi-Fi.
- AI coach is a **separate stateless `coach/` service** next to Ollama.
- Region: **Sri Lanka**. Languages: en / si / ta (si and ta marked `needs_review`).
- **No backup**. Data lives only on the device.
- **Web during development**: the app runs in the browser. Phone-only features
  use platform adapters (`*.native.ts` / `*.web.ts`) with clearly labelled demo
  stand-ins that never hold real sensitive data.

## Shared rules for every milestone

- All user-facing text lives in `app/src/i18n/{en,si,ta}.json`. A key-parity
  test and a no-raw-text lint rule enforce it.
- Every screen is wrapped in `ScreenLayout`, which renders the help button.
  A test checks that every registered route uses it.
- A shame-language test scans every locale file for banned words (e.g.
  "failure", "failed", "clean/dirty", "addict", "start over").
- Tests: Jest + React Native Testing Library (app); pytest (server, coach,
  ml, evals). Lint: ESLint + `tsc --noEmit`; ruff + mypy.

## Your personal tasks (Claude cannot do these)

- After M1: copy `content/helplines.example.json` → `content/helplines.json`
  and `content/disclaimer.example.md` → `content/disclaimer.md`, then fill them
  in from official sources (e.g. NDDCB, national emergency numbers) and add the
  date you checked them. Claude cannot create or edit these two files.
- Before M6: create a free Expo account and a free Firebase project, and add
  `google-services.json` (for FCM push). Keep it out of git.
- Before M10: ask a native speaker to review Sinhala and Tamil text.
- Optional: get feedback from a counsellor or recovery-support worker.

---

## M1 — Scaffold · DONE

**Goal:** a runnable, empty skeleton of every part, with tooling and tests wired up.

**Files**
- `app/` Expo TypeScript app (Expo Router, routes in `src/app/`): `app.json`
  (`allowBackup: false`; the SQLCipher plugin is added in M2), `eas.json` (development / preview profiles),
  `src/navigation/`, `src/i18n/{index.ts,en.json,si.json,ta.json}`,
  `src/theme/` (light/dark), `src/components/ScreenLayout.tsx`,
  `src/components/HelpButton.tsx` (stub), `jest.config.js`, `.eslintrc.js`
- `server/` FastAPI `app/main.py` (`/health`), `pyproject.toml`, `Dockerfile`, `tests/`
- `docker-compose.yml` (server + Postgres), `Makefile`, `.env.example`, `.easignore`, `.gitignore`
- `content/helplines.example.json`, `content/disclaimer.example.md`: **templates**
  marked "TO BE VERIFIED BY USER", with empty numbers. The developer copies them
  to `helplines.json` / `disclaimer.md` (hook-protected)
- `app/src/platform/` (platform-adapter pattern + `WebDemoBanner.tsx`)
- `ml/`, `evals/`, `coach/` (README stubs only)

**Acceptance criteria**
- `make up` starts the server and Postgres, and `GET /health` returns 200.
- `make app` starts the Expo dev server. `eas build --profile development -p android` is documented in the README.
- The app renders a Home screen in light and dark mode, and switches between en, si and ta.
- The app runs in the browser (`npx expo start`, press `w`) and shows a
  "Web demo — not for real data" banner there only.
- **Tests pass:** `server/tests/test_health.py`; `app/src/i18n/__tests__/locales.test.ts`
  (same keys in all 3 locales, si/ta marked `needs_review`, no shame language);
  `app/src/__tests__/routes.test.tsx` (every route shows the help button);
  `app/src/__tests__/settings.test.tsx` (language switch);
  `app/src/platform/__tests__/webDemo.test.tsx` (web banner only on web).
  `make lint` and `make test` are green.

**Result (M1):** 26 app tests + 3 server tests pass; ESLint, tsc, ruff and mypy
(strict) are clean; web export builds; `GET /health` → 200 in Docker.

## M2 — Secure foundation · DONE

**Goal:** encrypted storage, app lock, quick-hide, delete-all, onboarding, and a working help button.

**Files**
- `app/src/storage/{db.ts,key.ts,migrations/,deleteAll.ts}`
- `app/src/features/lock/{LockScreen.tsx,pin.ts,useAutoLock.ts}` (expo-local-authentication)
- `app/src/features/hide/{QuickHideScreen.tsx,useShakeToHide.ts}`
- `app/src/features/onboarding/` (disclaimer → nickname → set PIN → language)
- `app/src/features/help/{HelpScreen.tsx,helplines.ts}` (reads `content/helplines.json`)
- `app/src/safety/crisisDetector.ts` (en/si/ta word lists)
- `app/src/net/` (empty clients and the network-boundary rule)

**Acceptance criteria**
- The DB key is created on first launch and stored only in the secure store.
  The DB cannot be opened with a wrong key or no key.
- The app locks on launch and after 1 minute in the background. PINs are stored as salted hashes. Biometric login is optional.
- Quick-hide shows a neutral screen in one tap. Sensitive screens set `FLAG_SECURE`.
- Delete-all removes the DB, key, settings and scheduled notifications, then returns to onboarding.
- The help screen lists entries from `helplines.json` with their "last verified"
  date, and shows a warning for entries over 6 months old or still unverified.
- Crisis words in any text input open help resources immediately.
- **Tests pass:** `db.encryption.test.ts`, `pin.test.ts`, `autoLock.test.ts`,
  `deleteAll.test.ts`, `helplines.test.ts` (including the stale-date warning),
  `crisisDetector.test.ts` (3 languages), `noHardcodedNumbers.test.ts`,
  `networkBoundary.test.ts`. The privacy-reviewer reports no Critical or High findings.

**Result (M2):** 384 app tests + 3 server tests pass; ESLint, tsc, ruff and mypy
clean; web and Android bundles build. Onboarding order is language → disclaimer →
nickname → PIN (language first so the disclaimer can be read). Extra screens:
`/loading`, `/problem` (data cannot be opened → delete and set up again). Review
fixes: PIN cap after 15 failures (clock-tamper safe), biometric token invalidated
on new enrolment, weak-PIN check, keyboard learning off, wider crisis lists
(stems, romanised si/ta), unnamed/unchecked entries never shown as emergency.
Open items for the user: verify `content/helplines.json` (the "emergency" entry
is 1927, which may not be an emergency number), native-speaker review of si/ta text
and crisis lists, translated disclaimers.

## M3 — Craving SOS · DONE

**Goal:** one big button that takes the user through a coping exercise, their reasons, and support options.

**Files**
- `app/src/features/sos/{SosButton.tsx,SosFlow.tsx,BreathingWave.tsx,OutcomeScreen.tsx,sosRepo.ts,stats.ts}`
- `app/src/features/vault/{VaultScreen.tsx,AddReason.tsx,vaultRepo.ts}` (expo-image-picker, expo-av; BLOBs with size limits)
- `content/exercises/*.json` (6 exercises via `/add-coping-exercise`: 2 breathing, 2 grounding, 1 urge surfing, 1 distraction)

**Acceptance criteria**
- The home screen has a large SOS button (≥ 64 dp) with a screen-reader label.
- Flow: pick or auto-pick an exercise → guided steps with a breathing
  animation (respects reduce-motion) → one vault item → "Call my support
  person" / "Get help" / "I'm okay now" → "Did the craving pass?".
- The session's start, end, exercise and outcome are saved encrypted.
- The vault adds and deletes text, photos and voice notes, all stored inside the encrypted DB.
- Stats screen: "Cravings you got through: N. They usually pass in about M minutes" (median).
- **Tests pass:** `sosFlow.test.tsx`, `sosRepo.test.ts`, `stats.test.ts`,
  `vaultRepo.test.ts` (BLOB round trip, size limit), `exercises.schema.test.ts`
  (all 6 exercises complete in en/si/ta). The safety-reviewer reports no Critical or High findings.

**Result (M3):** 551 app tests + 3 server tests pass; ESLint, tsc, ruff and mypy
clean; web and Android bundles build. Uses `expo-audio` (the successor of
`expo-av`). Also added: a calm "dawn lagoon" visual theme for the whole app
(gradients, rounded cards, SVG illustrations, glowing SOS button, breathing
wave; light and dark; still with reduce-motion), a support person in Settings,
and `/progress`. Review fixes: urgent "Get help now" on the first SOS screen and
during exercises; the support number is stored and dialled in full; pause and
screen-reader-friendly exercises; the "usually pass in" figure appears only
after 3 cravings that passed; help next to a saved reason with crisis words;
unencrypted media copies deleted at once and swept at launch; playback stops
on lock/hide; microphone permission kept, camera and storage blocked.
Open items for the user: native-speaker review of the si/ta SOS and exercise
text (they reach people at a hard moment); test voice notes on a real phone.

## M4 — Daily check-in + synthetic data · DONE

**Goal:** a check-in that takes under 20 seconds, and a realistic synthetic dataset.

**Files**
- `app/src/features/checkin/{CheckInScreen.tsx,checkinRepo.ts,tags.ts,reminder.ts}`
- `app/src/i18n/*` — `notifications.*` namespace
- `app/src/dev/DevMenu.tsx` (load or clear demo data; dev builds only)
- `ml/{generate.py,schema.py,README.md,tests/test_generate.py}`

**Acceptance criteria**
- The check-in has 4 sliders (mood, sleep, stress, craving) plus optional tags, and saves in one tap.
- A daily reminder at a time the user picks, with neutral text.
- `ml/generate.py --users 200 --days 180 --seed 42` is deterministic and writes
  check-ins, cravings and slips with documented hidden patterns
  (e.g. poor sleep + high stress + weekend → higher risk).
- Every assumption is listed in `ml/README.md`.
- **Tests pass:** `checkinRepo.test.ts`, `checkinScreen.test.tsx`,
  `notificationText.test.ts` (banned terms, 3 languages), `test_generate.py`
  (shape, value ranges, determinism, the planted pattern can be measured).

**Result (M4):** 646 app tests, 3 server tests and 8 ml tests pass; ESLint, tsc,
ruff and mypy clean; Android and web bundles build. Check-in: four tap-or-drag
0–4 scales (one adjustable control for screen readers, light haptics, calm
no-bounce springs that respect reduce-motion) and 11 optional tags from
`content/checkin.json`, which `ml/` shares. One check-in per day, editable that
day. After saving: low mood offers people to talk to; a strong craving offers
SOS. Daily reminder in Settings with neutral text (tested in en/si/ta), shown
exactly in Settings, lock-screen visibility private, no exact-alarm
permission, "Simulate notification" on web. Dev menu (development builds only)
loads/clears demo rows marked `demo = 1`. `make ml` writes deterministic CSVs to
`ml/data/`. Design touches from the `apple-design` skill: instant press feedback,
tighter heading tracking. Review fixes: Sinhala wording, neutral colour for
stress/craving scales, calmer "Get help" button, help shown before SOS, an
app-name notice on the reminder, Firebase auto-init and analytics switched off
in the manifest (ready for M6), delete-all also clears shown notifications and
the channel, PIN failures counted before the check.
Needs a new phone build (`make build-android`): expo-notifications and
expo-haptics are native.
Carry-overs: **M5** must leave `demo = 1` rows out of risk features; **M6** must
fetch a push token only after the user opts in, and delete it on leave/delete-all;
**M9** add a safety case for the "In pain" tag (no medication advice);
**M10** neutral app name/icon option (the name shows on every notification).

---

## M5 — Trigger map + early warning · DONE

**Goal:** an explainable on-device risk model, a trigger-map screen, and neutral nudges.

**Files**
- `ml/{features.py,train.py,evaluate.py,export.py,report.md,tests/}`
- `app/src/ml/{model.json,featureBuilder.ts,predict.ts,explain.ts,patterns.ts,nudgeScheduler.ts}`
- `app/src/features/triggers/{TriggerMapScreen.tsx,CopingPlanScreen.tsx}`

**Acceptance criteria**
- Time-based split (days 1–120 / 121–150 / 151–180). Logistic regression is
  compared with a small gradient-boosted model and with base-rate and rule baselines.
- `ml/report.md` reports precision, recall, PR-AUC, Brier score, a calibration
  table, and the synthetic-data honesty note. Logistic regression beats both baselines on PR-AUC.
- `model.json` includes the version, feature spec, scaler, coefficients and threshold.
- Python and TS scores match within 1e-6 on fixture rows.
- The trigger map shows plain-language patterns ("Your hardest times are
  evenings after poor sleep") only after 14 or more check-ins. Charts have text alternatives.
- At most 1 nudge per day, before the predicted high-risk window, with quiet
  hours respected. Neutral text links to the user's coping plan. Nudges can be turned off.
- **Tests pass:** `ml/tests/test_features.py`, `test_train.py`, `test_export.py`;
  `predict.parity.test.ts`, `explain.test.ts`, `patterns.test.ts`,
  `nudgeScheduler.test.ts`, `notificationText.test.ts`. The safety-reviewer reports no Critical or High findings.

**Result (M5):** 800 app tests, 3 server tests and 21 ml tests pass; ESLint, tsc,
ruff and mypy clean; Android and web bundles build. `make ml` now generates,
trains, evaluates and exports. Test-day PR-AUC: logistic regression 0.53 vs
gradient boosting 0.53, simple rule 0.28, base rate 0.15 (`ml/report.md`, with the
honesty note). The synthetic check-in craving was made a noisy view of the day's
real pressure, so sleep, stress, weekends and tags carry their own signal.
App: `/triggers` "Your patterns" (plain sentences about the user's own past
check-ins after 14 of them, bar charts read out as sentences, hardest time from
SOS moments, demo label), a harder-day card on home and patterns (up to 3
reasons, a "rough guess" caveat, "Open my plan" and "Talk to someone"),
`/coping-plan` (early signs, what helps, who to contact; crisis words open help;
reach-out actions), and an opt-in heads-up (≤ 1 a day, an hour before the
user's usual hard time, never 22:00–08:00, neutral text, private channel).
Python and app scores agree within 1e-6 on 40 fixtures. The "pain" tag is never
given as a reason. Review fixes: wording describes the past ("In your
check-ins…") rather than predicting, a fuller honesty note above the toggle,
Tamil "forecast" word replaced, saved crisis words no longer re-open help on
every edit, delete-all removes both channels even if a step fails, a shown
heads-up is dismissed when turned off, the plan shows an error if saving fails.
Needs the new phone build from M4 (no new native modules in M5).
Carry-overs: **M7** add "days since last slip" to the features (both sides +
parity fixtures); **M10** native-speaker review of the new si/ta text; consider
a marker file so `model.json` can prove its data was synthetic.

---

## M6 — Support circle · DONE

**Goal:** invite up to 3 supporters and send a minimal "please check in on me" signal, with consent.

**Files**
- `server/app/{models.py,schemas.py,auth.py,ratelimit.py,push.py,purge.py}`,
  `server/app/routes/{accounts,invites,links,signals}.py`, `server/alembic/`,
  `server/tests/`
- `app/src/net/circleClient.ts`
- `app/src/features/circle/{CircleScreen.tsx,InviteScreen.tsx,SupporterModeScreen.tsx,ConsentSheet.tsx,circleRepo.ts}`

**Acceptance criteria**
- The account is created only when the user turns on the circle. Auth uses a random token; only its hash is stored.
- Invite codes are 10-character base32, single use, expire after 24 h, and are stored hashed. The member approves each supporter. Max 3.
- Sending asks for consent each time. Limit: 3 signals per day. Supporters get
  a neutral push ("A friend asked you to check in today"). The supporter app
  shows the local label they chose. The server stores no labels.
- Either side can revoke at any time. `DELETE /account` cascades. Signals over 7 days old are purged.
- The app's delete-all also deletes the server account (queued if offline).
- **Tests pass:** `test_auth.py`, `test_invites.py` (expiry, reuse, brute-force
  limit), `test_links.py` (max 3, revoke), `test_signals.py` (rate limit,
  purge), `test_schema_allowlist.py`, `test_delete_account.py`;
  `circleClient.test.ts`, `circleScreen.test.tsx`. The privacy-reviewer reports no Critical or High findings.

**Result (M6):** 909 app tests, 67 server tests and 21 ml tests pass; ESLint, tsc,
ruff and mypy clean; full flow checked by hand against Postgres in Docker (invite →
approve → signal → delete cascades). Server: SQLAlchemy + Alembic (migrations run
when the container starts), five allow-listed tables, short error codes the app
translates, in-memory rate limits (accounts 10/h per address; wrong invite codes
5/h per account and 20/h per address, counted before lookup), hourly purge, opt-in
CORS for the web demo, push through Expo **off by default** (`SERVER_PUSH_ENABLED`).
The database URL is built from parts, so any password character works. App:
`/circle` (turn on with a clear "what leaves this phone", approve with a check
code shown on both phones and a name kept only on the phone, remove, invite,
"Ask my circle to check in" with consent every time, turn off), `/circle-invite`
(code, share, new code), `/supporter` (join with code + local name, requests by
name, opt-in push, stop supporting, leave). Every send outcome also offers
"Get help" and "Open SOS", because a supporter may not see a request at once.
Delete-all deletes the server accounts first, queues them if offline (retried at
launch) and keeps the tokens if that step fails. Review fixes: si/ta push text
said "check on you" (now "check on them"), honest "may not see it straight away"
wording, rolling-24-hour wording, https required outside dev builds, approval
resets when requests become visible, thread-safe guess limiter, DB errors hide
parameters, one shared push client.
Needs: `app/.env` with `EXPO_PUBLIC_CIRCLE_API_URL`, and for real push a
`google-services.json` + FCM key in EAS, then `SERVER_PUSH_ENABLED=true` and a new
phone build.
Carry-overs: **M10** neutral app display name (it shows on supporters' lock
screens; both reviewers flagged this); **M11** TLS proxy for the API, digest-pinned
images, request-size cap and per-account limits on read routes; later: purge
accounts unseen for N days (needs a `last_seen_day` column), row locks so parallel
requests cannot exceed 3 signals or 3 supporters, a unique push token, a lock
around the pending-deletion queue, a guard against double account creation, and a
"this connection has ended" note for supporters. iOS Keychain survives uninstall
(not built for iOS).

## M7 — Shame-free slips, rebuild goals, progress · DONE

**Goal:** slips never erase progress. Goals and small wins are celebrated.

**Files**
- `app/src/features/slip/{SlipFlow.tsx,slipRepo.ts,progress.ts}`
- `app/src/features/goals/{GoalsScreen.tsx,goalsRepo.ts,moneySaved.ts}`
- `app/src/features/progress/ProgressScreen.tsx`

**Acceptance criteria**
- After a slip the app says, for example, "You had 45 strong days, and that
  still counts". Total strong days never goes back to 0.
- 3 optional, skippable gentle questions (where, feeling, what happened
  before). Answers feed the trigger-map features. The flow suggests reaching out.
- Goals: sleep, health, work/study, family, money saved, with small-win milestones.
- **Tests pass:** `progress.test.ts` (slips never reset the totals),
  `slipFlow.test.tsx` (all questions skippable; suggests reaching out),
  `goalsRepo.test.ts`, `moneySaved.test.ts`, `shameLanguage.test.ts`. The safety-reviewer reports no Critical or High findings.

**Result (M7):** 1070 app tests, 67 server tests and 24 ml tests pass; ESLint, tsc,
ruff and mypy clean; web bundle builds. **Strong days** = finished days since the
start without a slip: a slip removes only its own day, a slip today never lowers
the number, longest stretch never goes down. `/slip`: care first (with "if you or
someone with you feels unwell or may have taken too much, get help now", opening
Help with the urgent message), then "You have 45 strong days. They are still
yours." on a spring-filled ring, 3 optional tap-only questions (each skippable,
or all at once), and reaching out (support person, help, circle, plan); a mistaken
entry can be undone. `/progress`: animated ring between milestones, a 4-week
journey strip (slip days are hollow neutral dots, never red), stat tiles, the
start day ("counting from", movable back), removing a mistaken slip. `/goals`:
sleep, health, work/study, family, money; idea chips or own words; one small win
a day with milestone celebrations (spring + success haptic); "money towards your
life" = daily amount × strong days. Design (apple-design skill): critically damped
springs that start from the current value, press feedback on touch-down, tabular
numbers with tight display tracking, every animation off with reduced motion.
Model: `slip_recent` (a slip in the 3 days before) on both sides, model v2, test
PR-AUC 0.53 → 0.54; slip answers map to check-in tags and feed the trigger map
("Around your slips", counted once per day, only things noted on 2+ days).
Review fixes: urgent-help routing, overdose-risk wording, no dead end if saving
fails, no big zero on day one, present tense ("still yours"), "a hard moment
recently" as the home reason, slip count only in the screen-reader summary,
Sinhala "පසුබෑම" and Tamil "சறுக்கல்" for "slip", single slips removable, day only
(no exact time), demo rows never set the start day.
Needs from the user: verify `content/helplines.json` — the only "emergency" entry
is NDDCB 1927; add the ambulance number (e.g. 1990 Suwa Seriya) as `emergency`
after checking it, because the slip flow's urgent-help button leads there.
Carry-overs: **M10** native-speaker and clinician review of the slip wording
(en/si/ta), especially the overdose-risk line; a "mark goal as done" that keeps its
wins; demo slips in the dev menu.

## M8 — Treatment & support finder · TODO

**Goal:** a finder built only from a content file the developer has verified.

**Files**
- `content/support_places.json` (placeholder entries marked `"demo": true`)
- `content/first_visit.md` (plus si and ta versions)
- `app/src/features/finder/{FinderScreen.tsx,PlaceDetail.tsx,FirstVisitGuide.tsx,places.ts}`

**Acceptance criteria**
- Lists the name, type (treatment centre / counselling / support group), area,
  hours, contact and last-verified date. Can filter by type and area. Works offline.
- Demo entries show a "demo" badge. Entries verified more than 6 months ago show a warning.
- A "What happens at your first visit?" guide in 3 languages.
- **Tests pass:** `places.schema.test.ts`, `places.staleness.test.ts`,
  `finderScreen.test.tsx`.

## M9 — Optional AI coping coach + safety layer · TODO

**Goal:** an opt-in coach that only gives encouragement and coping skills, protected by layered safety checks.

**Files**
- `coach/app/{main.py,crisis.py,topic_guard.py,output_checker.py,prompts.py,ollama_client.py}`, `coach/tests/`, `coach/Dockerfile`
- `docker-compose.yml` (adds `coach` and `ollama`; the model is set by `.env`)
- `app/src/net/coachClient.ts`, `app/src/features/coach/{CoachScreen.tsx,CoachOptIn.tsx}`
- `evals/{safety_cases.yaml,run_eval.py,report.md}` (60+ cases via `/add-safety-test`)
- `CLAUDE.md` (add `coach/` to the folder list), `Makefile` (`safety-eval`)

**Acceptance criteria**
- Off by default. The opt-in screen says what is sent and that the coach is not a therapist.
- The on-device crisis detector runs before any network call. The coach
  service checks again, applies the topic guard (medical, dosing, withdrawal,
  drug use), and runs an output checker with a safe fallback reply.
- The service is stateless and never logs request bodies.
- Safety eval: 60+ cases across all categories and all 3 languages.
  **100% on crisis, self-harm, overdose and dosing cases; at least 90% overall.**
  Per-category results are in `evals/report.md`.
- **Tests pass:** `test_crisis.py`, `test_topic_guard.py`,
  `test_output_checker.py`, `test_no_body_logging.py`, `test_pipeline.py`
  (Ollama mocked); `coachScreen.test.tsx`; `make safety-eval` meets the thresholds.

## M10 — Accessibility, language coverage, polish · TODO

**Goal:** an accessible, calm, fully translated app that works offline.

**Files**
- Updates across `app/src/components` and `app/src/screens`
- `app/src/features/about/AboutScreen.tsx` (disclaimer + privacy summary)
- `app/src/components/EmptyState.tsx`, `app/src/i18n/*` (`needs_review` markers)

**Acceptance criteria**
- Every interactive element has an accessibility label and role, and a tap target of at least 48 dp.
- Text scales to 200% without clipping. Colour contrast is at least 4.5:1 in light and dark mode.
- Every si and ta key exists. Untranslated or unchecked strings are marked `needs_review`.
- Each list screen has an empty state. Every core feature apart from the circle and the coach works in airplane mode.
- **Tests pass:** `a11y.labels.test.tsx` (scans all screens), `contrast.test.ts`
  (theme tokens), `i18n.parity.test.ts`, `offline.test.tsx`, `aboutScreen.test.tsx`.

## M11 — CI/CD, demo, README · TODO

**Goal:** automated quality gates and a portfolio-ready presentation.

**Files**
- `.github/workflows/{ci.yml,server-image.yml,app-preview.yml}`
- `docs/deploy.md` (Docker Compose; Kubernetes/OpenChoreo option for the server)
- `README.md`

**Acceptance criteria**
- CI runs lint, tests, the safety eval and the ML evaluation on every PR.
- The server and coach images build and push to GHCR. An EAS preview APK builds (manual trigger, free tier).
- A dependency allow-list check fails if analytics or ad SDKs are added.
- The README includes: pitch, demo-video placeholder, screenshots, architecture
  diagram, privacy design, safety design and eval results, risk-model results,
  tech stack, quick start, ethics, limitations and future work.
- **Tests pass:** every CI job is green on a PR. `test_dependency_allowlist`
  passes. Links in the README are checked by a markdown link check.
