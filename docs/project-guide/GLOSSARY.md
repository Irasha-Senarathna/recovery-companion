# Glossary

[Handbook home](README.md) · Previous: [Project roadmap](PROJECT_ROADMAP.md)

Technical words used in this handbook, in plain English. Grouped by topic, A–Z inside each group.

## Recovery Companion terms

| Term | Meaning |
|---|---|
| **Check code** | 4 characters shown on both phones when a supporter joins, so the member can confirm it is the right person |
| **Coping plan** | The person's own list of warning signs, what helps and who to contact (`/coping-plan`) |
| **Harder day** | A day the on-device model scores above its threshold. Shown gently, never as "at risk" |
| **Heads-up / nudge** | The optional single daily notification before a usual hard time, with neutral text |
| **Member** | The person in recovery who uses the app and may invite supporters |
| **Quick-hide** | Switching instantly to a neutral "Notes" screen |
| **Reasons vault** | The person's saved reasons for recovery: text, photos, voice notes |
| **Signal** | "Please check in on me", sent from member to supporters with no content |
| **Slip** | A return to drug use. The app treats it kindly and never resets progress |
| **SOS** | The big button for a craving: guided exercise, reasons, support person |
| **Strong days** | Finished days since the start without a slip. A slip removes only its own day |
| **Supporter** | A trusted person who uses the same app in supporter mode |
| **Trigger map** | Patterns from the person's own check-ins, such as "cravings were stronger on stressful days" |

## Mobile app

| Term | Meaning |
|---|---|
| **APK** | The file used to install an Android app |
| **Biometric unlock** | Unlocking with a fingerprint or face instead of the PIN |
| **Development build** | An Expo app build that includes native modules and loads code from a dev server; needed because Expo Go cannot run SQLCipher |
| **EAS Build** | Expo's cloud service that builds the APK (free tier used) |
| **Expo** | A toolkit around React Native that handles native modules and builds |
| **Expo Go** | A ready-made Expo app for quick testing; not usable here |
| **Expo Router** | Navigation where each file in `app/src/app/` is a screen |
| **FLAG_SECURE** | An Android setting that blocks screenshots and blanks the app-switcher preview |
| **i18n** | "Internationalisation": keeping text in language files so the app can be translated |
| **Metro** | The JavaScript bundler Expo uses; it picks `.web.ts` files for the browser |
| **Platform adapter** | A small module with a phone version and a web version (`x.ts` / `x.web.ts`) |
| **React Native** | A framework to build native mobile apps in JavaScript/TypeScript |
| **Secure store / Android Keystore** | Hardware-backed storage on the phone for small secrets such as keys |
| **SQLCipher** | A version of SQLite that encrypts the whole database file |
| **TypeScript** | JavaScript with types, checked before the code runs |

## Backend and data

| Term | Meaning |
|---|---|
| **Alembic** | A tool that applies database schema changes (migrations) to Postgres |
| **API / endpoint** | A URL the app calls to ask the server to do one thing, e.g. `POST /signals` |
| **Bearer token** | A secret string sent in the `Authorization` header to prove who you are |
| **Cascade delete** | Deleting a row also deletes rows that depend on it |
| **CORS** | Browser rules for which websites may call an API; used only for the web demo |
| **FastAPI** | A Python framework for building typed web APIs |
| **Hash (SHA-256)** | A one-way fingerprint of data. The server stores hashes of tokens, not the tokens |
| **Migration** | An ordered change to a database schema |
| **PBKDF2** | A slow hashing method used to store the PIN safely |
| **Postgres** | The server's relational database |
| **Pydantic** | Python library that validates request and response data |
| **Rate limit** | A cap on how often something can be done, e.g. 3 signals a day |
| **Schema allow-list** | A test that lists every allowed database column, so personal fields cannot slip in |
| **SQLAlchemy** | A Python library for working with databases through Python classes |
| **X-Forwarded-For** | A header a proxy adds with the real client address; trusted only from known proxies |

## AI and ML

| Term | Meaning |
|---|---|
| **Baseline** | A simple reference model the real model must beat |
| **Brier score** | How close predicted probabilities are to what happened; lower is better |
| **Calibration** | Whether "30% risk" really happens about 30% of the time |
| **Feature** | One input number for the model, such as "poor sleep: yes/no" |
| **Gradient boosting** | A more complex model, used here only for comparison |
| **Guardrail / safety layer** | Code around an AI model that blocks unsafe input or output |
| **LLM** | Large language model: an AI that generates text |
| **Logistic regression** | A simple, explainable model: a weighted sum turned into a probability |
| **Ollama** | A program that runs language models locally on a computer |
| **Output checker** | The coach layer that inspects every model reply before it is shown |
| **Parity test** | A test that the phone and Python compute the same scores |
| **PR-AUC** | A score for how well a model ranks rare positive cases; higher is better |
| **Precision / recall** | Of flagged days, how many were hard (precision); of hard days, how many were flagged (recall) |
| **Prompt injection** | A message that tries to make an AI ignore its rules |
| **RAG** | Retrieval-augmented generation: giving an LLM documents to read. **Not used** in this project |
| **Safety eval** | A test set of messages that checks the coach behaves safely |
| **Synthetic data** | Made-up data generated by code, with no real people in it |
| **System prompt** | Hidden instructions given to the language model before the conversation |
| **Threshold** | The score above which a day counts as a "harder day" |
| **Topic guard** | The coach layer that refuses medical, dosing, withdrawal and drug-use questions |

## Delivery and quality

| Term | Meaning |
|---|---|
| **CI/CD** | Continuous integration / delivery: automatic checks and builds on every change |
| **Container / Docker image** | A packaged app with everything it needs to run |
| **Docker Compose** | Runs several containers together from one file |
| **GHCR** | GitHub Container Registry, where the images are stored |
| **GitHub Actions** | GitHub's automation that runs the CI workflows |
| **HTTPS / TLS** | Encrypted web traffic |
| **Ingress** | The Kubernetes entry point that routes outside traffic to a service |
| **Kubernetes** | A system that runs and manages containers on a cluster |
| **Lint** | Automatic checks for style and likely mistakes |
| **Lock file** | A file listing exact versions of every installed package |
| **NetworkPolicy** | A Kubernetes rule for which pods may talk to which |
| **OpenChoreo** | An open-source developer platform built on Kubernetes |
| **Pull request (PR)** | A proposed change on GitHub, reviewed and checked before merging |
| **Quality gate** | A check that must pass before a change can ship |
| **Reverse proxy (Caddy)** | A server in front of the API that handles HTTPS |
| **uv** | A fast Python package and environment manager |
