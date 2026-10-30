.PHONY: help up down logs app web build-android test test-app test-server test-ml lint lint-app lint-server lint-ml ml safety-eval

# Works with Docker Desktop (`docker compose`) and Colima/Homebrew (`docker-compose`).
COMPOSE := $(shell docker compose version >/dev/null 2>&1 && echo "docker compose" || echo docker-compose)

help:
	@echo "make up | down | app | web | build-android | test | lint | ml | safety-eval"

up:            ## start backend (server + Postgres)
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

test: test-app test-server test-ml

test-app:
	cd app && npx jest

test-server:
	cd server && uv run pytest -q

lint: lint-app lint-server lint-ml

lint-app:
	cd app && npx eslint . && npx tsc --noEmit

lint-server:
	cd server && uv run ruff check . && uv run ruff format --check . && uv run mypy

test-ml:
	cd ml && uv run pytest -q

lint-ml:
	cd ml && uv run ruff check . && uv run ruff format --check . && uv run mypy

ml:            ## synthetic data, then train + evaluate + export the risk model
	cd ml && uv run python generate.py --users 200 --days 180 --seed 42 && uv run python train.py

safety-eval:
	@echo "Not built yet: the AI coach safety eval arrives in milestone 9."
