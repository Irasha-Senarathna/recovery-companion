# Tech stack

[Handbook home](README.md) · Previous: [System architecture](SYSTEM_ARCHITECTURE.md) · Next: [Backend guide](BACKEND_GUIDE.md)

Everything is free and open source, or has a free tier. Versions come from
`app/package.json` and the `pyproject.toml` files. Words you may not know are in
the [Glossary](GLOSSARY.md).

## Mobile app (`app/`)

| Technology | Version | Why it is used |
|---|---|---|
| **React Native** | 0.88 | One codebase in TypeScript for a real native Android app |
| **Expo SDK** (development build) | 58 | Native modules (SQLCipher, secure store, notifications) without Android Studio. Expo Go cannot run SQLCipher, so the app uses a **development build** ([architecture.md D1](../architecture.md#key-decisions)) |
| **TypeScript** | 6.0 | Types catch mistakes before runtime. `tsc --noEmit` runs in CI |
| **Expo Router** | 58 | File-based navigation: each file in `app/src/app/` is a screen. `Stack.Protected` guards private screens |
| **expo-sqlite with SQLCipher** | 58 | A full SQL database on the phone, **encrypted at rest** with a 256-bit key |
| **expo-secure-store** | 58 | Keeps the database key, PIN hash and circle tokens in the Android Keystore |
| **expo-local-authentication** | 58 | Optional fingerprint/face unlock |
| **expo-notifications** | 58 | Local reminders and nudges; Expo push tokens for supporters |
| **expo-audio, expo-image-picker** | 58 | Voice notes and photos for the reasons vault |
| **expo-sensors** | 58 | Accelerometer for optional shake-to-hide |
| **expo-screen-capture** | 58 | Sets Android's FLAG_SECURE for the whole app: no screenshots or screen recording, and a blank preview in the app switcher (`platform/secureScreen.ts`) |
| **expo-haptics, expo-linear-gradient, react-native-svg** | — | Gentle feedback, the calm visual design, charts and illustrations |
| **i18next + react-i18next** | 26 / 17 | Translations in English, Sinhala and Tamil |
| **@noble/hashes** | 2.4 | PBKDF2 for the PIN hash, in pure JavaScript (works on phone and web) |
| **sql.js** | 1.15 | SQLite compiled to WebAssembly: the **in-memory** database for the web demo only |
| **react-native-web** | 0.21 | Runs the app in a browser during development |

## Support-circle API (`server/`)

| Technology | Why it is used |
|---|---|
| **Python 3.12+** | Clear, well-known language for a small API |
| **FastAPI** | Typed request/response models, automatic validation, dependency injection for auth and limits |
| **Pydantic / pydantic-settings** | Request bodies that **forbid unknown fields**, and settings from environment variables |
| **SQLAlchemy 2** | Database access with typed models; SQLite in tests, Postgres in Docker |
| **Alembic** | Database migrations (`server/alembic/versions/0001_support_circle.py`) |
| **psycopg 3** | Postgres driver |
| **Postgres 17** | The server database (Docker image `postgres:17-alpine`) |
| **httpx** | Sends pushes to the Expo push service |
| **Uvicorn** | The web server, run with `--no-access-log` |

## Coach service (`coach/`)

| Technology | Why it is used |
|---|---|
| **FastAPI + Pydantic** | Same reasons as the API; strict request limits (500 characters, 6 turns) |
| **Ollama** | Runs a language model **locally**: free, and messages never go to a cloud AI company |
| **qwen2.5:7b** (default, `COACH_MODEL`) | A small multilingual model that runs on a laptop. Its Sinhala and Tamil replies have not been checked by native speakers |
| **httpx** | Calls Ollama's `/api/chat` |
| **Regular expressions** | The crisis check, topic guard and output checker are rule-based, so they are predictable and testable |

There is **no retrieval (RAG), no vector database and no cloud LLM** in this project.

## ML pipeline (`ml/`)

| Technology | Why it is used |
|---|---|
| **scikit-learn** | Logistic regression (the shipped model), gradient boosting (for comparison), metrics |
| **NumPy** | Numbers for the generator and features |
| **Python's `random.Random(seed)`** | Synthetic data that is identical on every run |

## Quality and testing

| Tool | Used for |
|---|---|
| **Jest + React Native Testing Library** (`jest-expo`) | 1,629 app tests |
| **pytest** | Server, coach, ML and tools tests |
| **ESLint** (`eslint-config-expo`, `eslint-plugin-i18next`) | App lint, including "no raw text" in components |
| **Prettier** | App formatting |
| **ruff** | Python lint and formatting |
| **mypy `--strict`** | Python type checks |
| **lychee** | Markdown link check |
| **actionlint, kubeconform** | Workflow and Kubernetes manifest checks (run by hand) |

## Delivery

| Technology | Used for |
|---|---|
| **uv** | Python package and environment manager (fast, with lock files) |
| **Docker + Docker Compose** | Runs Postgres, the API and the coach on a laptop |
| **GitHub Actions** | CI on every pull request; image builds |
| **GitHub Container Registry (GHCR)** | Stores the server and coach images |
| **EAS Build (Expo, free tier)** | Builds the Android APK in the cloud |
| **Caddy** | Optional HTTPS proxy with automatic certificates |
| **Kubernetes manifests + Kustomize** | Optional cluster deployment (`deploy/k8s/`) |

## What is deliberately **not** used

- No analytics, crash-reporting, advertising or AI-tracing SDKs. CI fails if one is
  added ([Testing and CI/CD](TESTING_AND_CI_CD.md#dependency-allow-list)).
- No cloud database or cloud backup for personal data.
- No cloud AI API.

## Related pages

- [System architecture](SYSTEM_ARCHITECTURE.md): how the parts connect
- [Setup and installation](SETUP_AND_INSTALLATION.md): installing these tools
