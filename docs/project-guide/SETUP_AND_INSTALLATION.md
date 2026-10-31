# Setup and installation

[Handbook home](README.md) · Previous: [Safety and privacy](SAFETY_AND_PRIVACY.md) · Next: [Testing and CI/CD](TESTING_AND_CI_CD.md)

This page takes you from a fresh clone to the app running in a browser and on an
Android phone. All commands run from the repository root unless a `cd` is shown.

## 1. Install the tools

| Tool | Version | Needed for |
|---|---|---|
| Git | any recent | Cloning |
| Node.js | 20 or newer (CI uses 24) | The app |
| [uv](https://docs.astral.sh/uv/) | recent (CI pins 0.11.27) | All Python parts; it also installs Python 3.12+ |
| Docker Desktop or Colima | recent | Postgres, the API and the coach |
| Make | any | The `make` shortcuts (built into macOS and Linux) |
| [Ollama](https://ollama.com) | optional | The AI coach |
| An Expo account | free | Building the Android app with EAS |
| Google Chrome | optional | `make screenshots` |

## 2. Get the code and create config files

```bash
git clone https://github.com/Irasha-Senarathna/recovery-companion.git
cd recovery-companion

cp .env.example .env                 # then set a strong POSTGRES_PASSWORD
cp app/.env.example app/.env         # server and coach addresses for the app (optional)
```

`.env` and `app/.env` are git-ignored. Never commit them or paste their values anywhere.

### Safety content (check before real use)

`content/helplines.json` and `content/disclaimer.md` are committed with entries that
were checked by hand from official sources. If you change region or update them,
start from the templates and verify every number yourself:

```bash
cp content/helplines.example.json content/helplines.json
cp content/disclaimer.example.md  content/disclaimer.md
```

Each helpline entry needs a "last verified" date. See
[Safety and privacy](SAFETY_AND_PRIVACY.md#helpline-numbers).

## 3. Install dependencies

```bash
cd app && npm install && cd ..
cd server && uv sync && cd ..
cd coach && uv sync && cd ..
cd ml && uv sync && cd ..
cd tools && uv sync && cd ..
```

`make` targets also run `uv run`, which syncs Python packages on first use.

## 4. Run the backend (optional)

The app works without any backend; only the support circle and the coach need one.

```bash
make up                                # Postgres + API (:8000) + coach (127.0.0.1:8001)
curl http://localhost:8000/health      # {"status":"ok"}
make logs                              # follow the API logs
make down                              # stop everything
```

## 5. Run the web demo (no phone needed)

```bash
make web            # Expo dev server for the browser; opens http://localhost:8081
```

1. Pick a language, accept the disclaimer, choose a nickname and a PIN.
2. **Settings → Developer tools → Load demo data** to fill the trigger map with
   30 days of made-up check-ins.
3. To try the circle in the browser, set in `app/.env`:
   `EXPO_PUBLIC_CIRCLE_API_URL=http://localhost:8000`, and in `.env`:
   `SERVER_CORS_ORIGINS=http://localhost:8081`. Restart both.

The web demo stores everything **in memory, unencrypted**, and loses it on reload.
A yellow banner says so. Never type real personal information into it.

## 6. Install on an Android phone

The app uses native modules (SQLCipher, secure store, push) that **Expo Go does not
support**, so it runs as a **development build** made by EAS.

```bash
cd app
npx eas-cli login                      # your free Expo account
cd .. && make build-android            # EAS builds a development APK in the cloud
```

1. When the build finishes (about 10–20 minutes), open the link it prints on the
   phone and install the APK (allow "install unknown apps" for the browser).
2. Start the dev server and open the app on the phone:

   ```bash
   make app                            # npx expo start --dev-client
   ```

3. Scan the QR code with the installed app. JavaScript changes reload live. Rebuild
   only when native dependencies change.

> The project's `app/app.json` contains the original author's EAS `owner` and
> `projectId`. On your own Expo account, change or remove them and run
> `npx eas-cli init` first.

### Connecting the phone to the backend

| Service | Easiest way | `app/.env` value |
|---|---|---|
| Support-circle API | Same Wi-Fi as the laptop | `EXPO_PUBLIC_CIRCLE_API_URL=http://<laptop-ip>:8000` |
| Coach | USB cable and `adb reverse tcp:8001 tcp:8001` | `EXPO_PUBLIC_COACH_API_URL=http://localhost:8001` |

Plain `http://` to another computer works **only in development builds**; release and
preview builds accept only `https://` (or `localhost`) (`app/src/net/baseUrl.ts`).
Restart Expo after changing `app/.env`.

### A preview (installable) build

For a build that does not need the dev server, use the manual GitHub workflow or
`cd app && npx eas-cli build --profile preview --platform android`. See
[Deployment guide](DEPLOYMENT_GUIDE.md#android-builds-with-eas).

## 7. The optional AI coach

```bash
ollama pull qwen2.5:7b          # a download of several GB; 16 GB of RAM is comfortable
make up                         # starts the coach on 127.0.0.1:8001
make safety-eval ARGS="--live"  # check the real model against the safety cases
```

By default the coach container reaches the Mac's own Ollama (`host.docker.internal`),
which uses the GPU. To run Ollama in Docker instead, set
`COACH_OLLAMA_URL=http://ollama:11434` and run `docker compose --profile ollama up -d`.
Then turn the coach on in the app's settings.

## 8. Check everything works

```bash
make lint          # all linters, type checks and the dependency allow-list
make test          # app, server, ml, coach and tools tests
make ml            # synthetic data → train → evaluate → export
make safety-eval   # coach safety eval with the scripted model
make links         # Markdown link check (needs Docker)
```

## Troubleshooting

| Problem | Fix |
|---|---|
| `docker compose` not found | The Makefile also accepts `docker-compose` (Colima/Homebrew) |
| Port 8081 in use | Another Expo server is running; stop it or use `npx expo start --port 8082` |
| Circle says "not set up on this version" | `EXPO_PUBLIC_CIRCLE_API_URL` is empty or rejected (plain http on a non-development build) |
| Coach says it is unavailable | Ollama is not running, the model is not pulled, or the URL is wrong |
| App shows the "problem" screen on a phone | The database could not open, for example on a build without SQLCipher |
| `make ml` exits with "Quality gate failed" | A change made the model worse than its baselines; read `ml/report.md` |

## Related pages

- [Testing and CI/CD](TESTING_AND_CI_CD.md): what `make test` and `make lint` check
- [Developer guide](DEVELOPER_GUIDE.md): where to start reading code
- [Deployment guide](DEPLOYMENT_GUIDE.md): running the backend beyond a laptop
