.PHONY: help install build test lint clean docker-build docker-run deploy pre-commit

# Default target
help:
	@echo "Available commands:"
	@echo "  install        - Install all dependencies (frontend, backend, shared)"
	@echo "  build          - Build all components"
	@echo "  test           - Run all tests"
	@echo "  test-coverage  - Run tests with coverage reports"
	@echo "  lint           - Run linting on all code"
	@echo "  lint-fix       - Run linting with auto-fix"
	@echo "  clean          - Clean build artifacts"
	@echo "  docker-build   - Build Docker image"
	@echo "  docker-run     - Run application in Docker"
	@echo "  deploy         - Deploy to production"
	@echo "  pre-commit     - Set up pre-commit hooks"
	@echo "  dev-frontend   - Start frontend development server"
	@echo "  dev-backend    - Start backend development server"

# Installation
install:
	cd shared && npm install
	cd frontend && yarn install
	cd backend && python -m venv venv && source venv/bin/activate && pip install -r requirements.txt

# Build
build:
	yarn build

build-frontend:
	yarn build:frontend

build-shared:
	yarn build:shared

# Testing
test:
	yarn test

test-frontend:
	yarn test:frontend

test-backend:
	yarn test:backend

test-coverage:
	yarn test:coverage

# Linting
lint:
	yarn lint

lint-frontend:
	yarn lint:frontend

lint-backend:
	yarn lint:backend

lint-fix:
	yarn lint:fix

# Development servers
dev-frontend:
	yarn dev:frontend

dev-backend:
	yarn start:backend:dev

# Cleanup
clean:
	yarn clean
	rm -rf backend/htmlcov
	rm -rf frontend/coverage
	rm -rf backend/.pytest_cache
	rm -rf frontend/.next
	find . -name "__pycache__" -type d -exec rm -rf {} +
	find . -name "*.pyc" -delete

# Docker
docker-build:
	docker build -t frl-wb .

docker-run:
	docker run -p 8080:8080 frl-wb

docker-compose-up:
	docker-compose up --build

docker-compose-down:
	docker-compose down

# Pre-commit
pre-commit:
	pip install pre-commit
	pre-commit install

pre-commit-run:
	pre-commit run --all-files

# Deployment
deploy-staging:
	./scripts/deploy-staging.sh

deploy-production:
	./scripts/deploy-production.sh

deploy-firestore-rules:
	./scripts/deploy-firestore-rules.sh

# Database
db-backup:
	@echo "Creating Firestore backup..."
	gcloud firestore export gs://$(GCS_BACKUP_BUCKET)/$(shell date +%Y%m%d_%H%M%S)

# Monitoring
logs-backend:
	gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=frl-wb-backend" --limit=50

logs-frontend:
	@echo "Frontend logs are handled by the browser and CDN"

# Security
audit-frontend:
	cd frontend && yarn audit

audit-backend:
	cd backend && source venv/bin/activate && pip-audit

# Performance
lighthouse:
	cd frontend && yarn lighthouse

# Environment setup
setup-env:
	@echo "Setting up environment files..."
	@echo "Please copy .env.example to .env and fill in your values"
	cp backend/.env.example backend/.env || true
	cp frontend/.env.example frontend/.env || true
