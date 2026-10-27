# Recovery Companion

A privacy-first mobile app that supports people recovering from drug addiction
between treatment sessions. It does **not** replace treatment or give medical advice.

> Portfolio project, in progress. Demo and synthetic data only.
> See [docs/plan.md](docs/plan.md) for milestones and [docs/architecture.md](docs/architecture.md)
> and [docs/privacy.md](docs/privacy.md) for the design.

## Quick start

Requirements: Node.js 20+, [uv](https://docs.astral.sh/uv/), Docker (Desktop or Colima).

```bash
cp .env.example .env          # then change POSTGRES_PASSWORD
cp content/helplines.example.json content/helplines.json      # fill in from official sources
cp content/disclaimer.example.md  content/disclaimer.md       # review the wording
cd app && npm install && cd ..
cd server && uv sync && cd ..

make up      # backend: http://localhost:8000/health
make app     # Expo dev server — press w for the web demo
make test    # all tests
make lint    # lint + typecheck
```

### Running on an Android phone

The app uses native features (encrypted SQLite, push notifications) that Expo Go
does not support, so it runs as a **development build**:

```bash
make build-android            # EAS free tier; install the APK it links to
cd app && npx expo start --dev-client
```

Rebuild only when native dependencies change. JavaScript changes reload live.

### Web demo

`make web` runs the app in a browser for development. Phone-only features use
clearly labelled stand-ins, and a banner says it is not for real data.

## Repository

| Folder | What it is |
|---|---|
| `app/` | Expo app (TypeScript, Expo Router, i18n: English/Sinhala/Tamil) |
| `server/` | FastAPI support-circle API (relays "please check in" signals only) |
| `coach/` | Optional AI coping coach service (milestone 9) |
| `ml/` | Synthetic data, risk model, evaluation (milestones 4–5) |
| `content/` | Help contacts, disclaimer, coping exercises |
| `evals/` | AI coach safety tests (milestone 9) |
| `docs/` | Architecture, privacy and threat model, plan |
