.PHONY: help up down logs app web build-android test test-app test-server test-ml test-coach test-tools lint lint-app lint-server lint-ml lint-coach lint-tools ml safety-eval deps-check links screenshots

# Works with Docker Desktop (`docker compose`) and Colima/Homebrew (`docker-compose`).
# No usage data to Expo from the CLI (privacy rule: no tracking).
export EXPO_NO_TELEMETRY := 1

COMPOSE := $(shell docker compose version >/dev/null 2>&1 && echo "docker compose" || echo docker-compose)

help:
	@echo "make up | down | app | web | build-android | test | lint | ml | safety-eval | deps-check | links"

up:            ## start backend (server + Postgres + coach)
	$(COMPOSE) up -d --build

down:
	$(COMPOSE) down

logs:
	$(COMPOSE) logs -f server

app:           ## start Expo dev server (press w for the web demo)
	cd app && npx expo start --dev-client

web:
	cd app && npx expo start --web

build-android: ## development APK via EAS free tier
	cd app && npx eas-cli build --profile development --platform android

test: test-app test-server test-ml test-coach test-tools

test-app:
	cd app && npx jest

test-server:
	cd server && uv run pytest -q

lint: lint-app lint-server lint-ml lint-coach lint-tools deps-check

lint-app:
	cd app && npx eslint . && npx tsc --noEmit

lint-server:
	cd server && uv run ruff check . && uv run ruff format --check . && uv run mypy

test-ml:
	cd ml && uv run pytest -q

test-coach:
	cd coach && uv run pytest -q

lint-ml:
	cd ml && uv run ruff check . && uv run ruff format --check . && uv run mypy

ml:            ## synthetic data, then train + evaluate + export the risk model
	cd ml && uv run python generate.py --users 200 --days 180 --seed 42 && uv run python train.py

lint-coach:
	cd coach && uv run ruff check . ../evals && uv run ruff format --check . ../evals && uv run mypy && uv run mypy ../evals/run_eval.py

# Stub model by default. Real model: make safety-eval ARGS="--live"; some cases: ARGS="--ids s001 s020"
safety-eval:
	cd coach && uv run python ../evals/run_eval.py $(ARGS)

test-tools:
	cd tools && uv run pytest -q

lint-tools:
	cd tools && uv run ruff check . && uv run ruff format --check . && uv run mypy

# Fails if a dependency is not on tools/dependency_allowlist.json, or is an analytics/ad SDK.
deps-check:
	cd tools && uv run python check_dependencies.py

# Markdown link check, the same tool CI uses (needs Docker).
links:
	docker run --rm -v "$(CURDIR)":/input -w /input lycheeverse/lychee:0.24.2 --config lychee.toml README.md 'docs/**/*.md'

# README screenshots from the running web demo (start `make web` first). Demo data only.
screenshots:
	cd tools && uv run --with playwright python screenshots.py
