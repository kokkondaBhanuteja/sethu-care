.DEFAULT_GOAL := help
SHELL := /bin/bash

# 5434, not 5432 — this machine has a native Homebrew postgres on [::1]:5432 and another
# project's container on 5433. See docker-compose.yml.
DB_URL ?= postgres://sethu:sethu@127.0.0.1:5434/sethu?sslmode=disable
MIGRATIONS := db/migrations

export GOOSE_DRIVER := postgres
export GOOSE_DBSTRING := $(DB_URL)
export GOOSE_MIGRATION_DIR := $(MIGRATIONS)

.PHONY: help up down migrate migrate-down migrate-status generate test lint run check psql reset

help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-16s\033[0m %s\n", $$1, $$2}'

up: ## Start Postgres (PostGIS) and wait for it to be healthy
	@docker compose up -d
	@until [ "$$(docker inspect --format='{{.State.Health.Status}}' sethu-postgres 2>/dev/null)" = "healthy" ]; do sleep 1; done
	@echo "postgres healthy on 5434"

down: ## Stop Postgres
	@docker compose down

reset: ## Destroy the database volume and rebuild from migrations. Local only.
	@docker compose down -v
	@$(MAKE) up
	@$(MAKE) migrate

migrate: ## Apply all pending migrations
	@goose up

migrate-down: ## Roll back the most recent migration
	@goose down

migrate-status: ## Show which migrations have been applied
	@goose status

generate: ## Regenerate type-safe Go from db/queries. Run after ANY schema or query change.
	@sqlc generate
	@echo "sqlc: ok"

test: ## Run every test with the race detector
	@go test -race ./...

lint: ## Vet + golangci-lint (includes the `exhaustive` switch check)
	@go vet ./...
	@golangci-lint run

run: ## Run the API against local Postgres
	@go run ./cmd/api

check: lint test ## What CI runs. Run this before you commit.

psql: ## Open a psql shell on the SETHU database
	@PGPASSWORD=sethu psql -h 127.0.0.1 -p 5434 -U sethu -d sethu
