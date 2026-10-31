# Deploying Recovery Companion

Most of Recovery Companion runs on the phone. Only two small services ever run
on a server, and both are optional:

| Piece | What it does | Where it runs |
|---|---|---|
| **App** | Everything: check-ins, SOS, trigger map, slips, goals, finder | The phone. Built by EAS (see [App builds](#app-builds-eas)) |
| **Support-circle API** (`server/`) + Postgres | Relays "please check in on me" signals between random IDs | Laptop (Docker Compose), or a server or cluster |
| **Coach** (`coach/`) | Optional AI coping coach, stateless, in front of Ollama | The laptop next to Ollama. **Not meant for public hosting** |

The server never sees check-ins, cravings, substances, places or names. See
[privacy.md](privacy.md) for the full data inventory.

Contents: [CI/CD](#cicd) · [Docker Compose](#1-docker-compose-laptop-default) ·
[HTTPS with Compose](#2-docker-compose-with-https) · [Kubernetes](#3-kubernetes) ·
[OpenChoreo](#4-openchoreo) · [App builds](#app-builds-eas)

## CI/CD

Three GitHub Actions workflows live in `.github/workflows/`. Every action is
pinned to a full commit SHA, and every job starts with read-only repository access.

| Workflow | When | What |
|---|---|---|
| `ci.yml` | Every pull request and push to `main` | **app**: ESLint, `tsc`, Jest, web bundle build · **server**: ruff, mypy, pytest · **coach**: ruff, mypy, pytest, safety eval (scripted model; 100% required on crisis, self-harm, overdose, dosing and medical advice) · **ml**: ruff, mypy, pytest, `make ml` (synthetic data → train → evaluate, fails if the model stops beating its baselines) · **dependencies**: allow-list check (no analytics, ad or crash-reporting SDKs) · **links**: Markdown link check of `README.md` and `docs/` |
| `server-image.yml` | Pull requests that touch `server/` or `coach/` build the images. Pushes to `main` and `v*` tags also **push** them | `ghcr.io/<owner>/recovery-companion-server` and `-coach`, tagged `sha-<short>`, `latest` (main) and the version (tags) |
| `app-preview.yml` | **Manual only** (Actions → App preview → Run workflow) | Queues an Android APK on EAS Build (free tier) |

The safety eval and the model report are added to each run's summary page. The
model report and `model.json` are also uploaded as an artifact.

**Recommended repository settings** (Settings → Branches → `main`): require a pull
request, and require the `CI` checks to pass before merging.

Every CI job can be run locally with the same command:

```bash
make lint          # all linters and type checks, plus the dependency allow-list
make test          # app, server, ml, coach and tools tests
make ml            # synthetic data → train → evaluate (quality gate)
make safety-eval   # coach safety eval, stub model (ARGS="--live" for Ollama)
make links         # Markdown link check (Docker)
```

## 1. Docker Compose (laptop, default)

This is how the project runs day to day. Nothing is exposed to the internet.

```bash
cp .env.example .env    # set POSTGRES_PASSWORD
make up                 # server on :8000, coach on 127.0.0.1:8001, Postgres inside Docker
curl http://localhost:8000/health
```

Phones on the same Wi-Fi reach the API at `http://<laptop-ip>:8000`. That traffic
is **not encrypted**, so this setup is for development and demos only.

To run the images CI pushed instead of building locally:

```bash
docker pull ghcr.io/irasha-senarathna/recovery-companion-server:latest
```

For anything long-lived, pin by digest (`...-server@sha256:<digest>`; the digest is
in the workflow log and on the package page) so the image cannot change under you.

## 2. Docker Compose with HTTPS

For a server that phones reach over the internet, put the API behind
[Caddy](https://caddyserver.com/docs/), which gets and renews a Let's Encrypt
certificate by itself.

```bash
API_DOMAIN=api.example.org \
  docker compose -f docker-compose.yml -f deploy/docker-compose.tls.yml up -d
```

- The API's DNS name must point at the machine, with ports 80 and 443 open.
- The override removes the plain `:8000` port; only the proxy can reach the API.
- The API trusts the client address in `X-Forwarded-For` only from the proxy
  (`SERVER_TRUSTED_PROXIES`, set by the override). Without it, every user would share
  the proxy's address and its per-address rate limits.
- Pick a **neutral domain name** (not "recovery" or "rehab"): public certificates
  are listed in Certificate Transparency logs, which anyone can search.
- [`deploy/Caddyfile`](../deploy/Caddyfile) caps request bodies at 16 KB, sends
  HSTS, writes **no access log**, and discards Caddy's own logs (error lines can
  contain addresses and paths).
- Do not expose the coach this way. If it is ever used away from the laptop, give
  it its own TLS proxy and authentication first.

Then build the app with `EXPO_PUBLIC_CIRCLE_API_URL=https://api.example.org`
(see [App builds](#app-builds-eas)).

## 3. Kubernetes

Plain manifests are in [`deploy/k8s/`](../deploy/k8s). They deploy the API and a
demo Postgres. They pass `kubeconform -strict`.

| File | What |
|---|---|
| `namespace.yaml` | `recovery-companion` namespace with the **restricted** Pod Security Standard |
| `secret.example.yaml` | Shape of the `server-db` secret. **Example only**: create the real one with `kubectl` |
| `postgres.yaml` | Demo Postgres StatefulSet (1 Gi volume). Use a managed database for anything real |
| `server.yaml` | API Deployment and Service: non-root, read-only root filesystem, no capabilities, `/health` probes |
| `ingress.yaml` | HTTPS through ingress-nginx and cert-manager, 16 KB body limit, access log off |
| `networkpolicy.yaml` | Only the API may reach Postgres; only the ingress controller may reach the API; the API may reach only Postgres and DNS (allow `exp.host:443` too if push is turned on) |

```bash
kubectl apply -f deploy/k8s/namespace.yaml
kubectl -n recovery-companion create secret generic server-db \
  --from-literal=user=recovery --from-literal=password="$(openssl rand -base64 24)"
# Edit deploy/k8s/ingress.yaml: replace api.example.org with your domain.
kubectl apply -k deploy/k8s
kubectl -n recovery-companion rollout status deploy/server
```

Notes:

- Set `SERVER_TRUSTED_PROXIES` in `server.yaml` to your cluster's pod network, so the
  API trusts `X-Forwarded-For` only from the ingress controller and per-address rate
  limits see each client.
- ingress-nginx error logs can contain client addresses and paths. Lower
  `error-log-level` in the controller's ConfigMap, and keep log retention short.
- Use a neutral domain name (see section 2).
- The API runs database migrations when it starts, so keep **one replica**, or
  move migrations to a Kubernetes Job before scaling out.
- Pin the image by digest in `server.yaml` for real deployments.
- Push notifications stay off (`SERVER_PUSH_ENABLED=false`) until FCM is set up
  for the Expo project. Supporters still see requests when they open the app.
- To try it locally: `kind create cluster`, then install ingress-nginx and
  cert-manager, or skip `ingress.yaml` and use
  `kubectl -n recovery-companion port-forward svc/server 8000:80`.

## 4. OpenChoreo

[OpenChoreo](https://openchoreo.dev) is an open-source developer platform on
Kubernetes. It can run the API without hand-written Deployments, Services,
Ingress and NetworkPolicies. The mapping:

| Recovery Companion | OpenChoreo |
|---|---|
| The whole system | A **Project**: `recovery-companion` |
| `server/` | A **Component** of type Service, running the prebuilt GHCR image (CI already builds it, so OpenChoreo's build plane is not needed) |
| Port 8000, `/health` | A REST **endpoint**, exposed publicly over HTTPS by the platform gateway |
| Postgres | An external managed database, passed in as environment variables, with the password from a secret reference |
| Dev → prod | OpenChoreo **environments** and promotion of the same image |
| `networkpolicy.yaml` | Cell-based isolation: only the API's public endpoint is reachable from outside the project |

A sketch of the resources is below. **Check the field names against the
OpenChoreo version you run**: the API is `v1alpha1` and changes between releases.

```yaml
apiVersion: openchoreo.dev/v1alpha1
kind: Component
metadata:
  name: server
spec:
  owner:
    projectName: recovery-companion
  type: Service
---
apiVersion: openchoreo.dev/v1alpha1
kind: Workload
metadata:
  name: server
spec:
  owner:
    projectName: recovery-companion
    componentName: server
  containers:
    main:
      image: ghcr.io/irasha-senarathna/recovery-companion-server@sha256:<digest>
      env:
        - key: SERVER_DB_HOST
          value: <managed-postgres-host>
        - key: SERVER_DB_NAME
          value: recovery_companion
        # SERVER_DB_USER / SERVER_DB_PASSWORD come from a secret reference.
  endpoints:
    api:
      type: REST
      port: 8000
```

The same privacy rules apply on any platform: no access logs, no request-body
logging, no tracing that captures payloads, and no analytics add-ons.

## App builds (EAS)

The app is built in the cloud by [EAS Build](https://docs.expo.dev/build/introduction/)
(free tier). No signing keys or tokens are kept in this repository.

**Once:** create an access token at expo.dev (Account settings → Access tokens), then
add it as the `EXPO_TOKEN` secret in GitHub (Settings → Secrets and variables → Actions).

**Each build:** Actions → **App preview (EAS)** → Run workflow. It always uses the
`preview` profile: development builds include the dev menu and demo-data loader and
can load code from any dev server, so they are built from a laptop only, for your own phone.
The run queues the build and ends. The APK link appears on expo.dev under the
project's builds, usually after 10–20 minutes. Free-tier builds are limited each
month, which is why the workflow is manual.

The API address is read at build time from `EXPO_PUBLIC_CIRCLE_API_URL`. For a
preview build, set it as an EAS environment variable for the `preview` environment
(`eas env:create`). A preview build is not a development build, so it only accepts
`https://` addresses (plain `http://` only for `localhost`): use the HTTPS setup from
section 2 or 3. Leave `EXPO_PUBLIC_COACH_API_URL` empty: the coach is not meant for
public hosting, and the coach screen then says it is not available. Without a circle
address the circle screen says the same, while everything else works offline.

From a laptop, the same build is `cd app && npx eas-cli build --profile preview --platform android`.
Before the first laptop build, check what EAS would upload (it must not contain `.env`):

```bash
cd app && npx eas-cli build:inspect --platform android --profile preview \
  --stage archive --output /tmp/eas-archive && find /tmp/eas-archive -name '.env*'
```

The CI workflow installs packages before the Expo token is in the environment, pins
the EAS CLI version, and turns off Expo CLI telemetry (`EXPO_NO_TELEMETRY=1`).
Prefer an Expo **robot** token limited to this project over a personal token.
