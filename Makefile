.PHONY: up down build backend-dev cli-run db-logs

up:
	docker compose up -d

build:
	docker compose up --build -d

down:
	docker compose down

backend-dev:
	cd backend && ./run.sh

cli-run:
	cd cli && go run .

db-logs:
	docker compose logs -f db
