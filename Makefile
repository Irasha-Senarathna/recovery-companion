.PHONY: help up down logs app web build-android test test-app test-server test-ml test-coach lint lint-app lint-server lint-ml lint-coach ml safety-eval

# Works with Docker Desktop (`docker compose`) and Colima/Homebrew (`docker-compose`).
COMPOSE := $(shell docker compose version >/dev/null 2>&1 && echo "docker compose" || echo docker-compose)

help:
	@echo "make up | down | app | web | build-android | test | lint | ml | safety-eval"

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

test: test-app test-server test-ml test-coach

test-app:
	cd app && npx jest

test-server:
	cd server && uv run pytest -q

lint: lint-app lint-server lint-ml lint-coach

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
