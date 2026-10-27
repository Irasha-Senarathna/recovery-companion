# Prompts — Recovery Companion

Copy each prompt into Claude Code **one at a time**.
After each milestone: try it on your phone → `git commit` → type `/clear` → next prompt.

---

## Prompt 0 — Kickoff (Plan mode: press Shift+Tab until it says "plan mode")

```
I am building a portfolio project: Recovery Companion, a privacy-first mobile
app that supports people recovering from drug addiction between treatment
sessions. Read CLAUDE.md first. The safety and privacy rules are strict.

Features:
1. Craving SOS: one big button → guided coping exercise (urge surfing,
   breathing, grounding), the user's own "reasons" vault (text, photo,
   voice note recorded on a good day), one-tap "call my support person",
   and an outcome question afterwards ("Did it pass?").
2. Daily check-in (20 seconds): mood, sleep, stress, craving level, and
   optional tags for places/people/situations.
3. Trigger map + early warning: an explainable on-device risk model trained
   on synthetic data finds personal risk patterns and sends a neutral nudge
   before high-risk times, with the user's own coping plan.
4. Support circle: user invites 2–3 trusted people; with consent, sends a
   minimal "please check in on me" signal. No details are ever shared.
5. Shame-free slips: logging a slip keeps past progress visible, asks 3
   gentle questions to improve the trigger map, and suggests reaching out.
6. Rebuild-your-life goals: sleep, health, work/study, family, money saved.
7. Treatment & support finder from a user-verified content file.
8. Optional AI coping coach (Ollama, local) with a strict safety layer and a
   safety eval suite. It never gives medical or drug-use advice.
Also: English/Sinhala/Tamil, app lock, quick-hide, delete-all-data,
and a help button on every screen.

Zero cost. Demo/synthetic data only.

Before planning, interview me with up to 8 questions you cannot infer.
Then create:
1. docs/architecture.md: Mermaid diagrams (system, data flow showing what
   stays on device vs. what reaches the server, risk-model pipeline)
2. docs/privacy.md: data inventory and threat model
3. docs/plan.md: 11 milestones, each with goal, files, and acceptance
   criteria that end in passing tests. Mark each as TODO.
Do not write code until I approve the plan.
```

---

## Prompt 1 — Scaffold

```
/milestone 1: scaffold the repo (app/, server/, ml/, content/, evals/, docs/).
Expo app with TypeScript, navigation, i18n (en/si/ta), dark mode, and a test
setup. FastAPI server with /health, Postgres, Docker Compose. Makefile with the
targets in CLAUDE.md, .env.example, linting for both. Create content/
disclaimer.md and content/helplines.json as PLACEHOLDER files with a clear
"TO BE VERIFIED BY USER" note and empty numbers. I will fill them in myself.
```

> ✋ **Your task after Prompt 1:** fill in `content/helplines.json` and
> `content/disclaimer.md` yourself, using official sources (for example the
> NDDCB website for Sri Lanka). Claude is blocked from editing these files on purpose.

## Prompt 2 — Secure foundation

```
/milestone 2: encrypted on-device storage (encrypted SQLite, key in the secure
store), app lock with PIN/biometrics, quick-hide (shake or button → neutral
screen), and "delete all my data". Onboarding: show the disclaimer, ask for a
nickname (no real name), and set up the help button that appears on every
screen, reading from content/helplines.json. Then run the privacy-reviewer
subagent.
```

## Prompt 3 — Craving SOS

```
/milestone 3: build Craving SOS. Big button on the home screen → choose or
auto-pick an exercise → guided exercise with a calm wave animation that
follows breathing → show one item from the user's reasons vault → options:
"Call my support person", "Get help", "I'm okay now". Afterwards ask "Did the
craving pass?" and save the outcome and duration. Build the reasons vault
(text, photo, voice note, stored encrypted). Use the add-coping-exercise
skill to create 6 exercises. Show stats: "Cravings beaten: 23. They usually
pass in about 12 minutes."
```

## Prompt 4 — Daily check-in + synthetic data

```
/milestone 4: daily check-in screen (under 20 seconds: sliders and tags) with a
neutral daily reminder notification. In ml/, write a synthetic data
generator that creates 200 realistic fake users over 180 days with check-ins,
cravings, slips and hidden trigger patterns (e.g. poor sleep + stress +
weekend → higher risk). Document every assumption in ml/README.md.
Add a "load demo data" option in the app's developer menu.
```

## Prompt 5 — Trigger map + early warning

```
/milestone 5: train an explainable risk model in ml/ (start with logistic
regression; compare with a small gradient-boosted model) on the synthetic
data. Evaluate with a time-based split and report precision, recall, and
calibration in ml/report.md. Export the model to run on-device. In the app:
a trigger map screen ("Your hardest times are evenings after poor sleep")
with simple charts, and early-warning notifications that use NEUTRAL text
(nothing about drugs on the lock screen) and link to the user's coping plan.
Then run the safety-reviewer subagent.
```

## Prompt 6 — Support circle

```
/milestone 6: support circle. The user invites up to 3 people with an invite
code (no phone book access needed). With explicit consent, the user can send
"Please check in on me today". The server only stores pseudonymous IDs and
the signal, nothing else. Push notifications to supporters use neutral text.
Users can revoke anyone at any time. Add auth, rate limiting and tests on the
server. Then run the privacy-reviewer subagent.
```

## Prompt 7 — Shame-free slips + rebuild goals + progress

```
/milestone 7: slip logging that never resets progress: show "You had 45
strong days, and that still counts", ask 3 gentle optional questions (where,
feeling, what happened before), feed the answers into the trigger map, and
suggest reaching out. Build rebuild-your-life goals (sleep, health,
work/study, family, money saved) and a progress dashboard that celebrates
small wins. Run the safety-reviewer subagent on all wording.
```

## Prompt 8 — Treatment & support finder

```
/milestone 8: a support finder screen that reads only from content/
support_places.json (placeholder entries marked "demo"). Show name, type
(treatment centre, counselling, support group), area, hours, contact, and a
"last verified" date. Add a "What happens at your first visit?" guide.
Show a warning when an entry's verification is older than 6 months.
```

## Prompt 9 — Optional AI coping coach (with safety layer)

```
/milestone 9: optional AI coping coach, off by default. Uses Ollama via the
server (configurable model). Safety layer BEFORE and AFTER the LLM:
1) a crisis detector (keywords + small classifier) that shows help resources
   immediately, 2) a topic guard that refuses medical, dosing, withdrawal and
   drug-use questions and suggests professionals, 3) an output checker that
   blocks unsafe replies. The coach only offers encouragement and coping
   skills, and reminds users it is not a therapist. Use the add-safety-test
   skill to create 60+ test cases across all categories and 3 languages.
   Add `make safety-eval` and report pass rates per category in evals/report.md.
```

Then push the safety score up with:
```
/goal make safety-eval passes 100% of crisis, self-harm, overdose and dosing cases, at least 90% overall, and make test passes
```

## Prompt 10 — Accessibility + polish

```
/milestone 10: accessibility pass (screen reader labels, large text support,
contrast, tap targets), full Sinhala and Tamil coverage with "needs_review"
markers, offline mode testing, empty states, and a calm, consistent visual
design. Add an in-app "About this app" page with the disclaimer and privacy
summary.
```

## Prompt 11 — CI/CD, demo, README

```
/milestone 11: GitHub Actions: lint, tests, safety eval and ML evaluation on
every PR; build the server image and push to GHCR; build an Expo preview.
Write docs/deploy.md (Docker Compose + Kubernetes/OpenChoreo option for the
server). Write a recruiter-friendly README.md: pitch, demo video placeholder,
screenshots, architecture diagram, privacy design (what stays on device),
safety design and safety eval results, risk model results, tech stack, quick
start, ethical considerations, limitations, and future work.
```

---

## Useful commands while working

| Command | What it does |
|---|---|
| `/clear` | Start fresh after a milestone (CLAUDE.md keeps the important context) |
| `/rewind` | Undo Claude's last changes |
| `/agents` | See your subagents |
| `/hooks` | See your active hooks |
| `/code-review` | Review your changes before committing |
| `/security-review` | Security check of your changes |
| `/goal <condition>` | Keep Claude working until a condition is true |
