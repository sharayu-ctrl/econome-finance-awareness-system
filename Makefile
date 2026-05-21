# EconoMe — Makefile
# Shortcuts for common development tasks

.PHONY: help setup keys env up down logs test seed migrate lint

help:
	@echo ""
	@echo "  EconoMe Development Commands"
	@echo "  ──────────────────────────────────────────────────"
	@echo "  make setup     Install Python deps + generate JWT keys"
	@echo "  make env       Copy .env.example → .env"
	@echo "  make up        Start full Docker stack"
	@echo "  make down      Stop Docker stack"
	@echo "  make logs      Tail API logs"
	@echo "  make migrate   Run Alembic DB migrations"
	@echo "  make seed      Populate DB with sample data"
	@echo "  make test      Run full test suite"
	@echo "  make lint      Run ruff linter"
	@echo "  make api       Start API server (no Docker)"
	@echo "  make worker    Start Celery worker (no Docker)"
	@echo ""

# ── Setup ─────────────────────────────────────────────────────────────────────
setup:
	@echo "→ Creating virtual environment..."
	cd backend && python -m venv .venv
	@echo "→ Installing dependencies..."
	cd backend && .venv/bin/pip install --upgrade pip && .venv/bin/pip install -r requirements.txt
	@echo "→ Generating JWT RS256 keys..."
	mkdir -p backend/keys
	openssl genrsa -out backend/keys/private.pem 2048
	openssl rsa -in backend/keys/private.pem -pubout -out backend/keys/public.pem
	@echo "✓ Setup complete"

env:
	@if [ ! -f backend/.env ]; then \
		cp backend/.env.example backend/.env; \
		echo "✓ Created backend/.env — fill in your values"; \
	else \
		echo "⚠  backend/.env already exists — skipping"; \
	fi

# ── Docker ────────────────────────────────────────────────────────────────────
up:
	docker-compose up -d
	@echo "✓ Stack running — API at http://localhost:8000"
	@echo "  Docs:   http://localhost:8000/docs"
	@echo "  Flower: http://localhost:5555"

down:
	docker-compose down

logs:
	docker-compose logs -f api

# ── Database ──────────────────────────────────────────────────────────────────
migrate:
	cd backend && .venv/bin/alembic upgrade head

seed:
	cd backend && .venv/bin/python seed.py

# ── Dev Servers (without Docker) ─────────────────────────────────────────────
api:
	cd backend && .venv/bin/uvicorn main:app --host 0.0.0.0 --port 8000 --reload

worker:
	cd backend && .venv/bin/celery -A workers.tasks.celery_app worker --loglevel=info

beat:
	cd backend && .venv/bin/celery -A workers.tasks.celery_app beat --loglevel=info

# ── Testing ───────────────────────────────────────────────────────────────────
test:
	cd backend && .venv/bin/pytest tests/ -v --tb=short

test-cov:
	cd backend && .venv/bin/pytest tests/ --cov=. --cov-report=html --cov-report=term
	@echo "✓ Coverage report: backend/htmlcov/index.html"

# ── Linting ───────────────────────────────────────────────────────────────────
lint:
	cd backend && .venv/bin/ruff check . --fix

# ── Frontend ──────────────────────────────────────────────────────────────────
frontend-install:
	cd frontend && npm install

frontend-dev:
	cd frontend && npm run dev

frontend-build:
	cd frontend && npm run build
