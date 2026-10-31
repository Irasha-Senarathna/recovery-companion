# System architecture

[Handbook home](README.md) · Previous: [Features](FEATURES.md) · Next: [Tech stack](TECH_STACK.md)

The main idea: **almost everything runs on the phone**. Two small services are
optional, and they see only what the person chooses to send. For the original
design decisions (D1–D13), see [architecture.md](../architecture.md).

## The big picture

```mermaid
flowchart LR
  subgraph Phone["Android phone: all personal data"]
    UI["Screens (Expo Router)<br/>i18n en/si/ta"]
    DB[("Encrypted SQLite<br/>(SQLCipher)")]
    KS["Secure store<br/>(Android Keystore)"]
    Risk["Risk model<br/>model.json"]
    Crisis["Crisis detector"]
    Content["Bundled content<br/>helplines, places, exercises"]
    Notif["Local notifications"]
    KS -. "DB key" .-> DB
    UI <--> DB
    DB --> Risk --> UI
    Risk --> Notif
    Content --> UI
    UI --> Crisis
  end

  subgraph Server["Support-circle API (optional)"]
    API["FastAPI"]
    PG[("Postgres<br/>random IDs, hashes,<br/>signals")]
    API <--> PG
  end

  subgraph Laptop["Coach (optional, laptop)"]
    Coach["Coach service<br/>safety layer"]
    Ollama["Ollama<br/>qwen2.5:7b"]
    Coach <--> Ollama
  end

  ML["ml/ (laptop)<br/>synthetic data → train → evaluate"] -- "model.json<br/>(build time)" --> Risk
  UI -- "opt-in: 'please check in'" --> API
  API -- "neutral push (if enabled)" --> Expo["Expo push → FCM"]
  UI -- "opt-in: coach message<br/>(only if no crisis words)" --> Coach
```

## The five parts

| Part | Folder | Runs on | Job |
|---|---|---|---|
| **Mobile app** | `app/` | The phone (and a browser for development) | All features, all personal data |
| **Support-circle API** | `server/` | Laptop by default; a server or cluster if deployed | Relays "please check in" between random IDs |
| **Coach service** | `coach/` | The laptop, next to Ollama | Safety layer in front of a local language model |
| **ML pipeline** | `ml/` | The laptop and CI | Makes synthetic data, trains and checks the risk model, exports `model.json` |
| **Content** | `content/` | Bundled into the app (and two files into the coach image) | Help contacts, places, exercises, word lists, disclaimer |

## 1. The mobile app (frontend)

**Technology:** React Native + Expo (TypeScript), Expo Router. See [Tech stack](TECH_STACK.md).

### Layers inside the app

```mermaid
flowchart TB
  Routes["app/src/app/*.tsx<br/>one file per screen (route)"]
  Features["app/src/features/&lt;feature&gt;/<br/>screens, hooks, *Repo.ts"]
  Components["app/src/components/<br/>ScreenLayout, HelpButton, ActionButton…"]
  ML["app/src/ml/<br/>featureBuilder, predict, explain,<br/>patterns, nudgeScheduler"]
  Safety["app/src/safety/<br/>crisisDetector"]
  Net["app/src/net/<br/>circleClient, coachClient<br/>(the only network code)"]
  Storage["app/src/storage/<br/>db, migrations, settings, deleteAll"]
  Platform["app/src/platform/<br/>*.ts (phone) / *.web.ts (browser)"]
  Routes --> Features
  Features --> Components
  Features --> ML
  Features --> Safety
  Features --> Net
  Features --> Storage
  Storage --> Platform
  Features --> Platform
```

- **Routes** (`app/src/app/`) are thin: most re-export a screen from `features/`.
- **Repositories** (`*Repo.ts`, e.g. `checkinRepo.ts`) are the only code that runs SQL
  for a feature.
- **Only `src/net/` may use the network.** A test enforces this.
- **Platform adapters** (`src/platform/`) hide phone-only features. Metro picks
  `x.web.ts` in the browser and `x.ts` on the phone.

### Navigation and start-up

`app/src/app/_layout.tsx` wraps everything in `SessionProvider`. At launch
`features/session/boot.ts`:

1. clears any leftover temporary media,
2. retries queued support-circle account deletions (in the background),
3. gets or creates the 256-bit database key in the secure store,
4. opens the encrypted database and runs migrations,
5. loads settings and decides where to start: **onboarding** or **lock**.

```mermaid
stateDiagram-v2
  [*] --> Boot
  Boot --> Onboarding: not onboarded or no PIN
  Boot --> Locked: onboarded
  Boot --> Problem: database could not open
  Onboarding --> Unlocked: PIN set
  Locked --> Unlocked: PIN or biometric
  Unlocked --> Locked: back after ≥ 60 s in background
  Unlocked --> Hidden: Hide button / shake (also locks)
  Hidden --> Locked: long-press the neutral screen, then PIN
```

Private screens sit inside `Stack.Protected` with `guard={unlocked}`, so they cannot
be reached while locked or hidden.

## 2. The support-circle API (backend)

**Technology:** Python 3.12, FastAPI, SQLAlchemy, Alembic, Postgres. Full detail in
[Backend guide](BACKEND_GUIDE.md) and [API reference](API_REFERENCE.md).

- 11 endpoints under 4 routers (`server/app/routes/`): accounts, invites, links, signals.
- Auth: a random bearer token per account. The server stores only its SHA-256 hash.
- 5 tables: `account`, `invite`, `link`, `signal`, `push_token`. No names, contacts,
  free text or health data. A test checks every column against an allow-list.
- An hourly background task deletes signals older than 7 days and expired invites.
- No access log (`uvicorn --no-access-log`).

## 3. The coach service (AI)

**Technology:** FastAPI + Ollama (local language model). Detail in [AI and ML](AI_AND_ML.md).

One endpoint, `POST /coach`. **Stateless:** no database, no files, and no message
text in any log. The pipeline (`coach/app/pipeline.py`):

```mermaid
flowchart LR
  In["message + up to 6 earlier turns"] --> C{"Crisis words?<br/>(crisis.py)"}
  C -- yes --> Crisis["kind: crisis"]
  C -- no --> T{"Asking for medical,<br/>dosing, withdrawal,<br/>drug-use advice<br/>or rule changes?<br/>(topic_guard.py)"}
  T -- yes --> Refusal["kind: refusal + topic"]
  T -- no --> M["Ollama<br/>(system prompt)"]
  M --> O{"Output checker<br/>(output_checker.py)"}
  O -- unsafe --> Fallback["kind: fallback"]
  O -- safe --> Reply["kind: reply + text"]
```

The phone runs its own crisis check first, so crisis messages never reach the coach.

## 4. The ML pipeline

**Technology:** Python, scikit-learn, NumPy. Detail in [AI and ML](AI_AND_ML.md#the-risk-model).

```mermaid
flowchart LR
  G["generate.py<br/>synthetic users"] --> D[("ml/data/*.csv<br/>git-ignored")]
  D --> F["features.py"] --> T["train.py<br/>split by day"]
  T --> E["evaluate.py<br/>metrics + quality gate"]
  E --> R["ml/report.md"]
  T --> X["export.py"] --> J["app/src/ml/model.json<br/>+ fixtures.json"]
  J --> P["app: predict.ts<br/>(same maths in TypeScript)"]
```

The model is trained on a laptop (or in CI) and shipped **inside the app** as a small
JSON file. Scoring happens on the phone, so check-ins never leave it.

## 5. Data flow: what leaves the phone

| Data | Leaves the phone? | Where it goes |
|---|---|---|
| Check-ins, cravings, SOS sessions, slips, goals, vault, coping plan, nickname | **Never** | Encrypted DB only |
| Risk scores and patterns | **Never** | Computed on the phone |
| Support person's name and number | **Never** | Encrypted settings |
| Support-circle account | Only if the circle is turned on | A random ID and a token hash on the server |
| "Please check in" | Only when the member taps and confirms | A timestamp on the server, kept 7 days |
| Supporter push token | Only if a supporter turns on notifications | Server, then Expo and Firebase with fixed neutral text |
| Coach message | Only if the coach is turned on and the message has no crisis words | The coach service, in memory only |

Full inventory: [privacy.md](../privacy.md#data-inventory).

## Related pages

- [Tech stack](TECH_STACK.md): the tools behind each part
- [Developer guide](DEVELOPER_GUIDE.md): finding your way in the code
- [Deployment guide](DEPLOYMENT_GUIDE.md): how the services are run
