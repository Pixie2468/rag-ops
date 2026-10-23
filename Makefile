.PHONY: dev up down build backend-dev frontend-dev cli-run db-logs status help

help:
	@echo "RAGOps Single-Command Commands:"
	@echo "  make dev         - Launch backend API and frontend Web Dashboard together (native)"
	@echo "  make up          - Start full containerized stack (DB + Backend + Frontend)"
	@echo "  make down        - Stop containerized stack"
	@echo "  make build       - Rebuild and start containerized stack"
	@echo "  make cli-run     - Run Go CLI against local backend"
	@echo "  make status      - Check API and DB health"

dev:
	./dev.sh

up:
	docker compose up -d

build:
	docker compose up --build -d

down:
	docker compose down

backend-dev:
	cd backend && ./run.sh

frontend-dev:
	cd frontend && bun dev

cli-run:
	cd cli && go run .

db-logs:
	docker compose logs -f db

status:
	@curl -s http://localhost:8000/health | python3 -m json.tool || echo "RAGOps backend is offline."
