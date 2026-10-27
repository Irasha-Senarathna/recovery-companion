.PHONY: help up down logs app web build-android test test-app test-server lint lint-app lint-server ml safety-eval

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
	cd app && npx expo start

web:
	cd app && npx expo start --web

build-android: ## development APK via EAS free tier
	cd app && npx eas-cli build --profile development --platform android

test: test-app test-server

test-app:
	cd app && npx jest

test-server:
	cd server && uv run pytest -q

lint: lint-app lint-server

lint-app:
	cd app && npx eslint . && npx tsc --noEmit

lint-server:
	cd server && uv run ruff check . && uv run ruff format --check . && uv run mypy

ml:
	@echo "Not built yet: synthetic data arrives in milestone 4, the risk model in milestone 5."

safety-eval:
	@echo "Not built yet: the AI coach safety eval arrives in milestone 9."
