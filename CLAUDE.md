# Recovery Companion

A privacy-first mobile app that supports people recovering from drug addiction
between treatment sessions. It does NOT replace treatment or give medical advice.

Core features: Craving SOS · daily check-ins · trigger map and early warnings ·
support circle · shame-free relapse handling · rebuild-your-life goals ·
treatment and support finder · optional AI coping coach (strict guardrails).

## Stack (all free)
- Mobile: React Native + Expo (TypeScript), offline-first
- On-device storage: encrypted SQLite; keys in the device secure store
- Backend (only for support-circle signals): FastAPI + Postgres, Docker Compose
- Notifications: Expo push notifications
- Risk model: simple, explainable model (e.g. logistic regression) trained on SYNTHETIC data
- Optional AI coach: Ollama (local), behind a safety layer
- i18n: English, Sinhala, Tamil

## Folder structure
- `app/`        Expo mobile app
- `server/`     FastAPI backend for support-circle signals
- `ml/`         synthetic data generator, risk model, model evaluation
- `content/`    coping exercises, `helplines.json`, `disclaimer.md`
- `evals/`      safety test cases for the AI coach + runner
- `docs/`       architecture, plan, privacy design, threat model

## Commands
- `make up` start backend · `make app` start Expo
- `make test` all tests · `make lint` lint + typecheck
- `make ml` generate synthetic data, train and evaluate risk model
- `make safety-eval` run AI coach safety tests

## Safety rules (never break these)
1. Never give medical, dosing, drug-use, tapering or withdrawal advice. Point to professionals.
2. The emergency/help button is visible on every screen.
3. Never hard-code helpline numbers. Read them from `content/helplines.json`
   (user-verified, with a "last verified" date). Claude must not edit that file.
4. Crisis words (self-harm, overdose, "can't go on") → show help resources immediately.
5. No shame language. A slip is never "failure" and never resets progress to nothing.
6. Use synthetic/demo data only. Never real user data.

## Privacy rules
- Personal data stays on the device by default, encrypted at rest.
- The server only sees what the user explicitly shares (e.g. "please check in"),
  never check-ins, cravings, substances or locations.
- No real names required. App lock (PIN/biometric) and a quick "hide" screen.
- No third-party analytics or ad SDKs.

## Coding rules
- Tests first. Type everything. Small components and functions.
- All user-facing text goes through i18n files, never hard-coded strings.
- Accessible UI: large tap targets, screen-reader labels, works in dark mode.
- No secrets in code; config in `.env` (see `.env.example`).

## Definition of done
Tests pass · lint clean · safety and privacy rules respected · docs updated ·
summary of what changed and how to try it.

- The app must run in the web browser (`npx expo start`, press w) during
  development. For phone-only features (encrypted SQLite, secure store,
  biometrics, notifications, shake), use a platform check and a clearly
  labelled web stand-in (e.g. in-memory storage, a "Simulate notification"
  button). Real behaviour must stay unchanged on iOS/Android.
- Never store real sensitive data in the web stand-in; it is for demo only.
