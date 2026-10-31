# Architecture — Recovery Companion

Status: **draft for approval**. No code exists yet; this describes the target design.

Recovery Companion is an offline-first Android app. Almost everything runs on
the phone. Two small, optional services run on the developer's laptop (Docker
Compose): a **support-circle API** that relays "please check in on me" signals,
and a **coach service** that wraps a local Ollama model behind a safety layer.

## Key decisions

| # | Decision | Why |
|---|---|---|
| D1 | Android first, built as an **Expo development build** with **EAS Build (free tier)**, which makes an installable APK in the cloud. Not Expo Go | SQLCipher and remote push notifications do not work in Expo Go. EAS's free tier needs no Android Studio and no paid account. After the dev build is installed, JS changes reload live from `npx expo start --dev-client`. A rebuild is needed only when native dependencies change. |
| D2 | **expo-sqlite with SQLCipher** (`useSQLCipher` config plugin). Random 256-bit key generated on first launch, kept in `expo-secure-store` (Android Keystore) | Full-database encryption at rest, as CLAUDE.md requires. |
| D3 | Photos and voice notes (reasons vault) are stored as **BLOBs inside the encrypted DB**, with size limits | Media is never left unencrypted on the file system. |
| D4 | **Risk model runs on the device**: logistic regression trained in `ml/` on synthetic data, exported as `model.json` (coefficients + feature spec), and run in TypeScript | Check-ins never leave the phone, and each prediction can be explained as a sum of feature contributions. |
| D5 | Early-warning nudges are **local scheduled notifications** with neutral text | No server is involved in the risk logic. |
| D6 | The **support circle is opt-in**. A server account is created only when the user turns the feature on. Supporters use the **same app in "supporter mode"** | No phone numbers, emails or names are needed. The server holds only random IDs. |
| D7 | The **coach service is a separate, stateless container**, apart from the support-circle API and its database. It is off by default and the user opts in with a clear notice | Coach text never shares a process or database with circle data. Nothing is logged or stored. |
| D8 | Backend runs **on the laptop only** (Docker Compose). Phones reach it on the same Wi-Fi | Zero cost, and nothing is exposed to the public internet. |
| D9 | **No cloud backup**. Android `allowBackup=false` | Data lives only on the device. Losing the phone means losing the data; the app says this clearly. |
| D10 | All content (helplines, disclaimer, support places, exercises) is **bundled JSON/Markdown** read at runtime, never hard-coded | Safety rule 3. `helplines.json` and `disclaimer.md` are edited by the developer only, after checking official sources. |
| D11 | Region: **Sri Lanka**. Languages: English, Sinhala, Tamil | Matches the target audience. Sinhala and Tamil strings carry a `needs_review` marker until a native speaker checks them. |
| D12 | The app also **runs in a web browser during development** (`npx expo start`, press `w`). Phone-only features (encrypted SQLite, secure store, biometrics, notifications, shake) sit behind small platform adapters (`*.native.ts` / `*.web.ts`). The web versions are clearly labelled demo stand-ins: in-memory storage (sql.js, pure JS, unencrypted, gone on reload), a "Simulate notification" button, a PIN instead of biometrics, no shake | Fast UI development and easy demos without a phone. The web stand-in never stores real sensitive data and is not shipped as a product. Android behaviour is unchanged. |
| D13 | `helplines.json` and `disclaimer.md` are **created by the developer** from `*.example.*` templates. Claude cannot write these files (protected by a hook) | Keeps the verified safety content entirely under human control. |

## 1. System overview

```mermaid
flowchart LR
  subgraph Phone["Android phone (Expo dev build)"]
    UI["Screens + i18n (en/si/ta)<br/>Help button on every screen"]
    Lock["App lock (PIN/biometric)<br/>Quick-hide"]
    DB[("Encrypted SQLite<br/>(SQLCipher)")]
    KS["Secure store<br/>(Android Keystore)<br/>DB key, API token"]
    Risk["On-device risk model<br/>(model.json)"]
    Notif["Local notifications<br/>(neutral text)"]
    Content["Bundled content<br/>helplines.json, disclaimer.md,<br/>support_places.json, exercises"]
    Crisis["On-device crisis detector"]
    UI --> Lock
    UI <--> DB
    KS -. key .-> DB
    DB --> Risk --> Notif
    Content --> UI
    UI --> Crisis
  end

  subgraph Laptop["Developer laptop (Docker Compose)"]
    API["Support-circle API<br/>(FastAPI)"]
    PG[("Postgres<br/>pseudonymous IDs + signals")]
    Coach["Coach service<br/>(FastAPI, stateless)<br/>safety layer"]
    Ollama["Ollama<br/>(local LLM)"]
    API <--> PG
    Coach <--> Ollama
  end

  subgraph ThirdParty["Third-party relay"]
    Expo["Expo push service"]
    FCM["Firebase Cloud Messaging"]
    Expo --> FCM
  end

  SupporterPhone["Supporter's phone<br/>(same app, supporter mode)"]

  UI -- "opt-in: 'please check in' signal" --> API
  UI -- "opt-in: coach message" --> Coach
  API -- "neutral push" --> Expo
  FCM --> SupporterPhone
  SupporterPhone -- "accept invite / revoke" --> API
```

### Components

| Component | Location | Responsibility |
|---|---|---|
| `app/` | Phone | All features. Offline-first; works with no network apart from the support circle and the coach. |
| `app/src/storage` | Phone | Opens the SQLCipher DB, runs migrations, and implements delete-all (drop DB, delete key, cancel notifications, delete server account). |
| `app/src/ml` | Phone | Feature builder plus logistic-regression inference from `model.json`, and per-feature explanations. |
| `app/src/safety` | Phone | Crisis-word detector (en/si/ta) that opens help resources immediately, before any network call. |
| `server/` | Laptop | Support-circle API: register, invites, links, signals, push tokens, revoke, delete account. |
| `coach/` | Laptop | Stateless coach: crisis detector → topic guard → Ollama → output checker. Logs no message bodies. |
| `ml/` | Laptop | Synthetic data generator, training, evaluation report, model export. |
| `evals/` | Laptop | Coach safety cases (YAML) and runner; pass rates per category. |
| `content/` | Repo | Developer-verified content. Bundled into the app at build time. |

> Note: `coach/` is a new top-level folder that CLAUDE.md does not list yet.
> Milestone 9 adds it to CLAUDE.md's folder list.

## 2. Data flow: what stays on the device and what leaves it

```mermaid
flowchart TB
  subgraph Device["STAYS ON DEVICE — encrypted at rest"]
    direction TB
    C1["Daily check-ins<br/>mood, sleep, stress, craving"]
    C2["Tags: places / people / situations"]
    C3["Craving SOS sessions + outcomes"]
    C4["Slips + gentle-question answers"]
    C5["Reasons vault<br/>text, photos, voice notes"]
    C6["Goals, money saved, progress"]
    C7["Risk scores + trigger map"]
    C8["Coping plan"]
    C9["Nickname, language, settings"]
    C10["Coach chat history<br/>(off by default)"]
    C11["Local labels for supporters<br/>e.g. 'Sister'"]
  end

  subgraph Server["REACHES SUPPORT-CIRCLE API — only if circle is enabled"]
    direction TB
    S1["Random account ID + token hash"]
    S2["Role: member / supporter"]
    S3["Invite code hash + expiry"]
    S4["Link: member ID ↔ supporter ID, status"]
    S5["Signal: 'please check in', timestamp<br/>(auto-deleted after 7 days)"]
    S6["Supporter's Expo push token"]
  end

  subgraph CoachSvc["REACHES COACH SERVICE — only if coach is enabled"]
    direction TB
    K1["Current message + last few turns<br/>processed in memory, never stored or logged"]
  end

  subgraph Relay["REACHES EXPO / FCM"]
    direction TB
    R1["Push token + neutral text<br/>'A friend asked you to check in today'"]
  end

  Device -- "user taps Send + confirms" --> S5
  Device -- "user opts in to coach" --> K1
  S5 --> R1

  X["NEVER LEAVES THE DEVICE<br/>check-ins, cravings, substances,<br/>locations, slips, vault, risk scores,<br/>nickname, supporter labels"]
  Device -.-> X
```

Rules this flow enforces:

- The server schema has an **allow-list of columns**. A test fails if a column
  is added that is not on the list (milestone 6).
- The app has **one network module per service** (`circleClient`, `coachClient`).
  A test checks that no other module imports `fetch` or an HTTP client.
- The **crisis detector runs on the device first**. Crisis messages show help
  resources immediately and are not sent to the coach.

## 3. Risk-model pipeline

```mermaid
flowchart LR
  subgraph ML["ml/ — on laptop, synthetic data only"]
    G["generate.py<br/>200 synthetic users × 180 days<br/>hidden trigger patterns"] --> D[("ml/data/*.csv<br/>git-ignored")]
    D --> F["features.py<br/>shared feature spec"]
    F --> S["Time-based split<br/>days 1–120 train<br/>121–150 validation<br/>151–180 test"]
    S --> LR["Logistic regression<br/>(standardised features)"]
    S --> GB["Small gradient-boosted model<br/>(comparison only)"]
    S --> BL["Baselines: base rate,<br/>simple rule"]
    LR --> E["evaluate.py<br/>precision, recall, PR-AUC,<br/>Brier score, calibration curve"]
    GB --> E
    BL --> E
    E --> R["ml/report.md"]
    LR --> X["export.py → model.json<br/>coefficients, intercept,<br/>scaler, feature spec, threshold,<br/>version"]
  end

  subgraph App["app/ — on device"]
    X --> M["app/src/ml/model.json"]
    LOC[("Encrypted DB:<br/>user's own check-ins")] --> FB["featureBuilder.ts<br/>(same spec as features.py)"]
    FB --> INF["predict.ts<br/>sigmoid(w·x + b)"]
    M --> INF
    INF --> EXP["explain.ts<br/>top contributions w_i·x_i<br/>→ 'evenings after poor sleep'"]
    INF --> SCH["nudgeScheduler.ts<br/>≤1 neutral nudge/day,<br/>quiet hours respected"]
    LOC --> PAT["patterns.ts<br/>personal trigger map<br/>(needs ≥14 check-ins)"]
  end

  P["Parity test: Python and TS<br/>give the same scores on fixtures"] -.-> INF
```

- **Prediction target** (M5): a "hard day": a slip that day, or a strong
  craving (intensity ≥ 3 on the 0–4 scale) from 17:00 on, given that day's
  check-in and earlier ones. The scale and tags are shared with the app through
  `content/checkin.json`; the planted patterns are listed in `ml/README.md`.
- **Features** (M5): mood, sleep, stress, craving (0–4), poor-sleep and
  high-stress flags, weekend, the sleep + stress + weekend combination,
  3-day craving and stress averages, and one flag per tag. Days since the last
  slip arrives with slips in M7.
- **Honesty note**: the model is trained and tested on synthetic data. Its
  metrics show the pipeline works. They do **not** show it predicts real
  relapse risk. The README and the trigger-map screen say this.

## 4. Support circle (milestone 6)

```mermaid
sequenceDiagram
  participant M as Member phone
  participant A as Circle API
  participant S as Supporter phone
  M->>A: POST /accounts {role: member} (only when turned on)
  M->>A: POST /invites → 10-char code (24 h, single use)
  M-->>S: code passed on in person / by message
  S->>A: POST /accounts {role: supporter}, POST /invites/redeem
  A-->>S: link_id (pending). Supporter names the member locally
  M->>A: GET /links → pending link. Member names them locally
  M->>A: POST /links/{id}/approve
  M->>A: POST /signals (empty body, after consent each time, ≤ 3/day)
  A-->>S: Expo push "A friend asked you to check in today." (if opted in)
  S->>A: GET /signals → [{link_id, created_at}] (≤ 7 days)
```

- Each side knows a link only by its `link_id`; the API never returns the other
  side's account ID. Names ("Sister") live in `circle_labels` on each phone.
- Errors come back as short codes (`circle_full`, `daily_limit`, ...) that the
  app translates. Rate limits live in server memory only.
- The app reads the server address from `EXPO_PUBLIC_CIRCLE_API_URL`. Without it
  the circle shows as "not set up on this version". The web demo needs
  `SERVER_CORS_ORIGINS` and gets no push ("Check for requests" instead).
- Alembic migrations run when the server container starts.

## 5. Coach request path (milestone 9)

```mermaid
sequenceDiagram
  participant U as User (phone)
  participant L as On-device crisis detector
  participant C as Coach service
  participant O as Ollama
  U->>L: message
  alt crisis words found
    L-->>U: show help resources now (from helplines.json)
  else not crisis
    L->>C: message + last few turns
    C->>C: crisis classifier (2nd check)
    C->>C: topic guard (medical, dosing, withdrawal, drug use)
    alt blocked
      C-->>U: kind refusal + suggest a professional / help button
    else allowed
      C->>O: system prompt + message
      O-->>C: draft reply
      C->>C: output checker
      C-->>U: safe reply or safe fallback
    end
  end
```

## Repository layout (target)

```
app/          Expo app (TypeScript)
  src/screens  src/components  src/features/<feature>
  src/storage  src/ml  src/safety  src/i18n/{en,si,ta}.json
  src/net/{circleClient,coachClient}.ts  src/theme  src/navigation
server/       FastAPI support-circle API + Alembic migrations + tests
coach/        FastAPI coach service + safety layer + tests
ml/           generate.py, features.py, train.py, evaluate.py, export.py, report.md
content/      helplines.json*, disclaimer.md*, support_places.json, exercises/
evals/        safety_cases.yaml, run_eval.py, report.md
docs/         architecture.md, privacy.md, plan.md, deploy.md
* edited by the developer only (protected by a hook)
```
